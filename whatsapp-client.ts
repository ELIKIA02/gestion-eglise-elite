import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

let baileys: any = null;
async function getBaileys() {
  if (!baileys) baileys = await import('@whiskeysockets/baileys');
  return baileys;
}

let sock: any = null;
let status: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
let lastError: string | null = null;
let reconnectAttempt = 0;
let cachedGroups: { id: string; name: string; subject: string }[] = [];
let groupsLastFetch = 0;
let keepAliveTimer: any = null;
let presenceTimer: any = null;
let initPromise: Promise<void> | null = null;
let initCounter = 0;
const MAX_RECONNECT_DELAY = 60000;

function getReconnectDelay(): number {
  const delay = Math.min(2000 * Math.pow(2, reconnectAttempt), MAX_RECONNECT_DELAY);
  return delay + Math.random() * 1000;
}

function getAuthDir() {
  return path.join(process.cwd(), 'wa_auth');
}

export function exportAuthAsBase64(): string | null {
  const authDir = getAuthDir();
  if (!fs.existsSync(authDir)) return null;
  try {
    const files: Record<string, string> = {};
    const entries = fs.readdirSync(authDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        files[entry.name] = fs.readFileSync(path.join(authDir, entry.name), 'base64');
      }
    }
    const json = JSON.stringify(files);
    const compressed = zlib.gzipSync(Buffer.from(json, 'utf-8'));
    return compressed.toString('base64');
  } catch { return null; }
}

export function restoreAuthFromBase64(data: string): boolean {
  try {
    const authDir = getAuthDir();
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
    const raw = Buffer.from(data, 'base64');
    let json: string;
    if (raw[0] === 0x1f && raw[1] === 0x8b) {
      json = zlib.gunzipSync(raw).toString('utf-8');
    } else {
      json = raw.toString('utf-8');
    }
    const files: Record<string, string> = JSON.parse(json);
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(authDir, name), Buffer.from(content, 'base64'));
    }
    console.log(`[WA] Restored ${Object.keys(files).length} auth files from env`);
    return true;
  } catch (err) {
    console.error('[WA] Failed to restore auth from env:', err);
    return false;
  }
}

function startKeepAlive() {
  stopKeepAlive();
  keepAliveTimer = setInterval(() => {
    if (sock?.ws?.readyState === 1) {
      try { sock.ws.keepAlive?.(); } catch {}
    }
  }, 25000);
  presenceTimer = setInterval(async () => {
    if (sock && status === 'connected') {
      try { await sock.sendPresenceUpdate('available'); } catch {}
    }
  }, 120000);
}

function stopKeepAlive() {
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
  if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = null; }
}

export async function initWhatsApp(skipAuthRestore = false, pendingPhoneForPairing?: string) {
  if (initPromise && !pendingPhoneForPairing) return initPromise;
  if (pendingPhoneForPairing) initPromise = null;
  const authDir = getAuthDir();
  const myInitId = ++initCounter;

  initPromise = (async () => {
    if (sock) {
      try { sock.end(undefined); } catch {}
      sock = null;
    }

    if (!skipAuthRestore && process.env.WA_AUTH_DATA) {
      console.log(`[WA] init #${myInitId} - Restoring auth from env var...`);
      restoreAuthFromBase64(process.env.WA_AUTH_DATA);
    }

    console.log(`[WA] init #${myInitId} - Starting WhatsApp socket...`);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    let authFiles: string[] = [];
    try { authFiles = fs.readdirSync(authDir).filter(f => f !== '.' && f !== '..'); } catch {}
    if (authFiles.length > 0) {
      console.log(`[WA] init #${myInitId} - ${authFiles.length} auth files found`);
    }

    try {
      const b = await getBaileys();
      const { useMultiFileAuthState, DisconnectReason } = b;

      const { state, saveCreds } = await useMultiFileAuthState(authDir);

      const WA_VERSION = [2, 3000, 1018828887];
      lastError = null;
      const browserId = Math.random().toString(36).slice(2, 8);

      console.log(`[WA] init #${myInitId} - Creating socket (browser=GestionEglise/${browserId})...`);
      sock = b.default({
        auth: state,
        version: WA_VERSION,
        browser: ['GestionEglise', 'Chrome', browserId],
        syncFullHistory: false,
        markOnlineOnConnect: false,
        keepAliveIntervalMs: 25000,
        mobile: false,
      });

      sock.ev.on('connection.update', (update: any) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'connecting') {
          status = 'connecting';
        }
        if (connection === 'open') {
          status = 'connected';
          reconnectAttempt = 0;
          startKeepAlive();
          console.log(`[WA] init #${myInitId} - Connected ✓`);
          setTimeout(() => { fetchGroups().catch(() => {}); }, 10000);
        }
        if (connection === 'close') {
          stopKeepAlive();
          const errCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const errMsg = (lastDisconnect?.error as Boom)?.message || (lastDisconnect?.error + '') || 'unknown';
          const isLoggedOut = errCode === DisconnectReason.loggedOut;
          const reason = isLoggedOut ? 'logged-out' : errCode || errMsg || 'unknown';
          status = 'disconnected';
          lastError = `Disconnected: ${reason}`;
          console.log(`[WA] init #${myInitId} - Disconnected. reason: ${reason}`);

          if (isLoggedOut) {
            try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}
            reconnectAttempt = 0;
          }

          reconnectAttempt++;
          const delay = getReconnectDelay();
          console.log(`[WA] init #${myInitId} - Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempt})`);
          initPromise = null;
          setTimeout(() => initWhatsApp(true), delay);
        }
      });

      sock.ev.on('creds.update', saveCreds);
      console.log(`[WA] init #${myInitId} - Socket ready.`);

      // If a phone number was provided for pairing, request code immediately
      if (pendingPhoneForPairing) {
        const cleanPhone = pendingPhoneForPairing.replace(/[^0-9]/g, '');
        if (cleanPhone.length >= 8) {
          console.log(`[WA] init #${myInitId} - Requesting pairing code for ${cleanPhone}...`);
          // Don't await — let the pairing happen in background
          sock.requestPairingCode(cleanPhone).then((code: string) => {
            lastPairingCode = code;
            console.log(`[WA] init #${myInitId} - Pairing code: ${code}`);
            if (pendingPairingResolve) {
              pendingPairingResolve(code);
              pendingPairingResolve = null;
            }
          }).catch((err: any) => {
            lastError = err.message;
            console.error(`[WA] init #${myInitId} - Pairing error:`, err.message);
            if (pendingPairingResolve) {
              pendingPairingResolve(null);
              pendingPairingResolve = null;
            }
          });
        }
      }
    } catch (err) {
      lastError = `Init error: ${err}`;
      console.error(`[WA] init #${myInitId} - Init error:`, err);
      reconnectAttempt++;
      const delay = getReconnectDelay();
      initPromise = null;
      setTimeout(() => initWhatsApp(true), delay);
    }
  })();

  return initPromise;
}

export const getStatus = () => status;
export const getLastError = () => lastError;

export async function sendMessage(to: string, text: string): Promise<boolean> {
  if (!sock || status !== 'connected') throw new Error('WhatsApp non connecté');
  const cleanNumber = to.replace(/[^0-9]/g, '');
  if (!cleanNumber) throw new Error(`Numéro invalide: ${to}`);
  await sock.sendMessage(`${cleanNumber}@s.whatsapp.net`, { text });
  return true;
}

export async function sendImageMessage(to: string, imageBase64: string, caption: string): Promise<boolean> {
  if (!sock || status !== 'connected') throw new Error('WhatsApp non connecté');
  const cleanNumber = to.replace(/[^0-9]/g, '');
  if (!cleanNumber) throw new Error(`Numéro invalide: ${to}`);
  const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  await sock.sendMessage(`${cleanNumber}@s.whatsapp.net`, { image: buffer, caption });
  return true;
}

export async function sendBulkImage(
  recipients: { phone: string; name: string }[],
  imageBase64: string,
  caption: string
): Promise<{ success: number; failed: number; total: number; errors: { phone: string; name: string; error: string }[] }> {
  let success = 0;
  let failed = 0;
  const errors: { phone: string; name: string; error: string }[] = [];
  for (let i = 0; i < recipients.length; i++) {
    try {
      await sendImageMessage(recipients[i].phone, imageBase64, caption);
      success++;
    } catch (err: any) {
      failed++;
      errors.push({ phone: recipients[i].phone, name: recipients[i].name, error: err.message });
    }
    if (i < recipients.length - 1) await new Promise(r => setTimeout(r, 1500));
  }
  return { success, failed, total: recipients.length, errors };
}

export async function sendBulk(
  recipients: { phone: string; name: string }[],
  text: string
): Promise<{ success: number; failed: number; total: number; errors: { phone: string; name: string; error: string }[] }> {
  let success = 0;
  let failed = 0;
  const errors: { phone: string; name: string; error: string }[] = [];
  for (let i = 0; i < recipients.length; i++) {
    try {
      await sendMessage(recipients[i].phone, text);
      success++;
    } catch (err: any) {
      failed++;
      errors.push({ phone: recipients[i].phone, name: recipients[i].name, error: err.message });
    }
    if (i < recipients.length - 1) await new Promise(r => setTimeout(r, 1500));
  }
  return { success, failed, total: recipients.length, errors };
}

export function cleanup() {
  stopKeepAlive();
  reconnectAttempt = 0;
  cachedGroups = [];
  groupsLastFetch = 0;
  initPromise = null;
  if (sock) { sock.end(undefined); sock = null; }
}

export async function resetWhatsApp() {
  stopKeepAlive();
  const authDir = getAuthDir();
  if (fs.existsSync(authDir)) {
    try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}
  }
  if (sock) { try { sock.end(undefined); } catch {} sock = null; }
  status = 'disconnected';
  lastError = null;
  reconnectAttempt = 0;
  initPromise = null;
  console.log('[WA] Reset complete — restarting fresh');
  await initWhatsApp(true);
}

export async function fetchGroups(): Promise<{ id: string; name: string; subject: string }[]> {
  if (!sock || status !== 'connected') return cachedGroups;
  if (Date.now() - groupsLastFetch < 5000) return cachedGroups;
  try {
    if (typeof sock.groupFetchAllParticipating !== 'function') {
      return cachedGroups;
    }
    const groups = await sock.groupFetchAllParticipating();
    if (groups && typeof groups === 'object') {
      const entries = Object.entries(groups);
      if (entries.length > 0) {
        cachedGroups = entries.map(([id, g]: any) => ({
          id,
          name: g.subject || g.name || id,
          subject: g.subject || g.name || ''
        }));
        groupsLastFetch = Date.now();
        console.log(`[WA] Fetched ${cachedGroups.length} groups`);
        return cachedGroups;
      }
    }
  } catch { /* ignore */ }
  return cachedGroups;
}

export function resetGroupsCache() { groupsLastFetch = 0; }
export const getGroups = () => cachedGroups;

let lastPairingCode: string | null = null;
let pendingPairingPhone: string | null = null;
let pendingPairingResolve: ((code: string | null) => void) | null = null;
export function getLastPairingCode() { return lastPairingCode; }

export async function requestPairingCode(phoneNumber: string): Promise<string | null> {
  const clean = phoneNumber.replace(/[^0-9]/g, '');
  if (clean.length < 8) { lastError = 'Numéro invalide (minimum 8 chiffres)'; return null; }
  if (status === 'connected') { lastError = 'Déjà connecté'; return null; }

  // Kill old socket and re-init with phone number for pairing
  console.log('[WA] Pairing: restarting with pairing code request...');
  initPromise = null;
  if (sock) { try { sock.end(undefined); } catch {} sock = null; }
  status = 'disconnected';

  // Return a promise that resolves when the pairing code arrives
  return new Promise<string | null>((resolve) => {
    pendingPairingResolve = resolve;
    initWhatsApp(true, clean);
    // Safety timeout: 30s total
    setTimeout(() => {
      if (pendingPairingResolve) {
        pendingPairingResolve(null);
        pendingPairingResolve = null;
        lastError = 'Délai écoulé (30s). Réessaie.';
      }
    }, 30000);
  });
}

export async function sendGroupMessage(groupJid: string, text: string): Promise<boolean> {
  if (!sock || status !== 'connected') throw new Error('WhatsApp non connecté');
  await sock.sendMessage(groupJid, { text });
  return true;
}

export async function sendGroupImage(groupJid: string, imageBase64: string, caption: string): Promise<boolean> {
  if (!sock || status !== 'connected') throw new Error('WhatsApp non connecté');
  const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  await sock.sendMessage(groupJid, { image: buffer, caption });
  return true;
}

export async function sendDocumentMessage(to: string, buffer: Buffer, fileName: string, mimetype: string): Promise<boolean> {
  if (!sock || status !== 'connected') throw new Error('WhatsApp non connecté');
  const cleanNumber = to.replace(/[^0-9]/g, '');
  if (!cleanNumber) throw new Error(`Numéro invalide: ${to}`);
  await sock.sendMessage(`${cleanNumber}@s.whatsapp.net`, {
    document: buffer,
    fileName,
    mimetype,
  });
  return true;
}
