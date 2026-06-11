import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';

let sock: ReturnType<typeof makeWASocket> | null = null;
let currentQR: string | null = null;
let status: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
let reconnectAttempt = 0;
let cachedGroups: { id: string; name: string; subject: string }[] = [];
let groupsLastFetch = 0;
const MAX_RECONNECT_DELAY = 60000;

function getReconnectDelay(): number {
  const delay = Math.min(2000 * Math.pow(2, reconnectAttempt), MAX_RECONNECT_DELAY);
  return delay + Math.random() * 1000; // add jitter
}

export async function initWhatsApp() {
  const authDir = path.join(process.cwd(), 'wa_auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: ['Gestion Eglise', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        currentQR = qr;
        reconnectAttempt = 0;
      }
      if (connection === 'connecting') { status = 'connecting'; }
      if (connection === 'open') {
        status = 'connected';
        currentQR = null;
        reconnectAttempt = 0;
        // Fetch groups after a delay to let sync complete
        setTimeout(() => { fetchGroups().catch(() => {}); }, 10000);
      }
      if (connection === 'close') {
        const error = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const isLoggedOut = error === DisconnectReason.loggedOut;
        const isRestartRequired = error === DisconnectReason.restartRequired;
        status = 'disconnected';
        currentQR = null;

        if (isLoggedOut) {
          fs.rmSync(authDir, { recursive: true, force: true });
          reconnectAttempt = 0;
        }

        if (!isLoggedOut || isRestartRequired) {
          reconnectAttempt++;
          const delay = getReconnectDelay();
          setTimeout(() => initWhatsApp(), delay);
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);
  } catch (err) {
    reconnectAttempt++;
    const delay = getReconnectDelay();
    setTimeout(() => initWhatsApp(), delay);
  }
}

export const getQR = () => currentQR;
export const getStatus = () => status;

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
  reconnectAttempt = 0;
  cachedGroups = [];
  groupsLastFetch = 0;
  if (sock) { sock.end(undefined); sock = null; }
}

export async function resetWhatsApp(shouldLogout = false) {
  cleanup();
  const authDir = path.join(process.cwd(), 'wa_auth');
  if (fs.existsSync(authDir)) {
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
