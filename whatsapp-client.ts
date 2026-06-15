import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as net from 'net';
import * as dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);
const dnsResolve = promisify(dns.resolve);

// Dynamic import for ESM-only baileys (incompatible with esbuild CJS output)
let baileys: any = null;
async function getBaileys() {
  if (!baileys) baileys = await import('@whiskeysockets/baileys');
  return baileys;
}

let sock: any = null;
let currentQR: string | null = null;
let status: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
let lastError: string | null = null;
let reconnectAttempt = 0;
let cachedGroups: { id: string; name: string; subject: string }[] = [];
let groupsLastFetch = 0;
let keepAliveTimer: any = null;
let presenceTimer: any = null;
let initPromise: Promise<void> | null = null;
const MAX_RECONNECT_DELAY = 60000;

function getReconnectDelay(): number {
  const delay = Math.min(2000 * Math.pow(2, reconnectAttempt), MAX_RECONNECT_DELAY);
  return delay + Math.random() * 1000; // add jitter
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
        const filePath = path.join(authDir, entry.name);
        files[entry.name] = fs.readFileSync(filePath, 'base64');
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
    // Try gzip first, fall back to raw JSON (backward compat)
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
  // Socket-level keepalive every 25s (WhatsApp server closes idle WS)
  keepAliveTimer = setInterval(() => {
    if (sock?.ws?.readyState === 1) {
      try { sock.ws.keepAlive?.(); } catch {}
    }
  }, 25000);
  // Presence update every 2 min to simulate activity
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

export async function initWhatsApp() {
  // Prevent concurrent init calls
  if (initPromise) return initPromise;
  const authDir = getAuthDir();
  let authTimeout: any;

  initPromise = (async () => {
    // Clean up previous socket before creating a new one
    if (sock) {
      try { sock.end(undefined); } catch {}
      sock = null;
    }

    // Restore auth from env var if present
    if (process.env.WA_AUTH_DATA) {
      restoreAuthFromBase64(process.env.WA_AUTH_DATA);
    }

    console.log('[WA] Initializing WhatsApp...');
    if (!fs.existsSync(authDir)) {
      console.log('[WA] Auth directory does not exist, creating');
      fs.mkdirSync(authDir, { recursive: true });
    }

    try {
      const b = await getBaileys();
      const { useMultiFileAuthState, DisconnectReason } = b;

      console.log('[WA] Loading auth state...');
      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      console.log('[WA] Auth state loaded, creating socket...');

      lastError = null;

      sock = b.default({
        auth: state,
        printQRInTerminal: true,
        browser: ['Gestion Eglise', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: false,
        keepAliveIntervalMs: 25000,
      });

      // Monitor: if no QR appears and no connection after 20s, wipe stale creds
      authTimeout = setTimeout(() => {
        if (status !== 'connected' && !currentQR) {
          console.log('[WA] Auth timeout — no QR and no connection in 20s, wiping stale creds');
          try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}
          status = 'disconnected';
          currentQR = null;
          reconnectAttempt = 0;
          initPromise = null;
          initWhatsApp();
        }
      }, 20000);

      sock.ev.on('connection.update', (update: any) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          currentQR = qr;
          reconnectAttempt = 0;
          clearTimeout(authTimeout);
          console.log('[WA] QR ready');
        }
        if (connection === 'connecting') {
          status = 'connecting';
        }
        if (connection === 'open') {
          status = 'connected';
          currentQR = null;
          reconnectAttempt = 0;
          clearTimeout(authTimeout);
          startKeepAlive();
          console.log('[WA] Connected');
          setTimeout(() => { fetchGroups().catch(() => {}); }, 10000);
        }
        if (connection === 'close') {
          stopKeepAlive();
          clearTimeout(authTimeout);
          const errCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const errMsg = (lastDisconnect?.error as Boom)?.message || (lastDisconnect?.error + '') || 'unknown';
          const isLoggedOut = errCode === DisconnectReason.loggedOut;
          const reason = isLoggedOut ? 'logged-out' : errCode || errMsg || 'unknown';
          status = 'disconnected';
          currentQR = null;
          lastError = `Disconnected: ${reason}`;
          console.log('[WA] Disconnected, reason:', reason, '| msg:', errMsg);

          if (isLoggedOut) {
            fs.rmSync(authDir, { recursive: true, force: true });
            reconnectAttempt = 0;
          }

          reconnectAttempt++;

          // After 3 failed attempts with same creds, wipe for fresh QR
          if (reconnectAttempt >= 3 && !isLoggedOut) {
            console.log('[WA] Too many reconnect failures — clearing auth for fresh QR');
            fs.rmSync(authDir, { recursive: true, force: true });
            reconnectAttempt = 0;
          }

          const delay = getReconnectDelay();
          console.log(`[WA] Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempt})`);
          initPromise = null;
          setTimeout(() => initWhatsApp(), delay);
        }
      });

      sock.ev.on('creds.update', saveCreds);
      console.log('[WA] Waiting for connection or QR...');
    } catch (err) {
      clearTimeout(authTimeout);
      lastError = `Init error: ${err}`;
      console.error('[WA] Init error:', err);
      reconnectAttempt++;
      const delay = getReconnectDelay();
      initPromise = null;
      setTimeout(() => initWhatsApp(), delay);
    }
  })();

  return initPromise;
}

export async function runDiagnostic(): Promise<{
  dns: string; tcp: string; dnsWww: string; tcpWww: string; authDir: string; authFiles: string[]; baileysVersion: string;
}> {
  const result = {
    dns: 'pending', tcp: 'pending', dnsWww: 'pending', tcpWww: 'pending',
    authDir: 'pending', authFiles: [] as string[], baileysVersion: 'unknown',
  };
  try {
    const addr = await dnsLookup('web.whatsapp.com');
    result.dns = `${addr.address} (${addr.family})`;
  } catch (e: any) { result.dns = `FAIL: ${e.message}`; }

  try {
    const addrs = await dnsResolve('web.whatsapp.com');
    result.dnsWww = addrs.slice(0, 3).join(', ');
  } catch (e: any) { result.dnsWww = `FAIL: ${e.message}`; }

  try {
    await new Promise<void>((resolve, reject) => {
      const s = net.createConnection(443, 'web.whatsapp.com', () => { s.end(); resolve(); });
      s.on('error', reject);
      s.setTimeout(5000, () => { s.destroy(); reject(new Error('timeout')); });
    });
    result.tcp = 'OK (port 443 reachable)';
  } catch (e: any) { result.tcp = `FAIL: ${e.message}`; }

  try {
    await new Promise<void>((resolve, reject) => {
      const s = net.createConnection(443, 'web.whatsapp.com', () => { s.end(); resolve(); });
      s.on('error', reject);
      s.setTimeout(5000, () => { s.destroy(); reject(new Error('timeout')); });
    });
    result.tcpWww = 'OK (port 443 reachable)';
  } catch (e: any) { result.tcpWww = `FAIL: ${e.message}`; }

  const authDir = getAuthDir();
  result.authDir = fs.existsSync(authDir) ? 'exists' : 'missing';
  if (fs.existsSync(authDir)) {
    result.authFiles = fs.readdirSync(authDir).filter(f => f !== '.' && f !== '..');
  }

  try {
    const b = await getBaileys();
    result.baileysVersion = b.__version || b.version || 'loaded';
  } catch { result.baileysVersion = 'failed to load'; }

  return result;
}

export const getQR = () => currentQR;
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
  if (sock) { sock.end(undefined); sock = null; }
}

export async function resetWhatsApp(shouldLogout = false) {
  stopKeepAlive();
  cleanup();
  const authDir = getAuthDir();
  if (shouldLogout && fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
  }
  status = 'disconnected';
  currentQR = null;
  reconnectAttempt = 0;
  await initWhatsApp();
}

export async function fetchGroups(): Promise<{ id: string; name: string; subject: string }[]> {
  if (!sock || status !== 'connected') return cachedGroups;
  if (Date.now() - groupsLastFetch < 5000) return cachedGroups;
  try {
    if (typeof sock.groupFetchAllParticipating !== 'function') {
      console.error('[WA] groupFetchAllParticipating not available');
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
    console.log('[WA] groupFetchAllParticipating returned empty - will retry later');
  } catch (err) {
    console.error('[WA] Failed to fetch groups:', err);
  }
  return cachedGroups;
}

export function resetGroupsCache() {
  groupsLastFetch = 0;
}

export const getGroups = () => cachedGroups;

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
