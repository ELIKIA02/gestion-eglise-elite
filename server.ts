import express from "express";
import path from "path";
import fs from "fs";
import { Mistral } from "@mistralai/mistralai";
import dotenv from "dotenv";
import QRCode from "qrcode";
import multer from "multer";
import { initWhatsApp, getStatus, getQR, sendBulk, sendBulkImage, fetchGroups, getGroups, resetGroupsCache, sendGroupMessage, sendGroupImage, cleanup, resetWhatsApp, exportAuthAsBase64, restoreAuthFromBase64, sendMessage, sendDocumentMessage } from "./whatsapp-client";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

dotenv.config();

// --- Scheduled messages ---
interface ScheduledEntry {
  id: string;
  title: string;
  text: string;
  imageBase64?: string;
  groupJid?: string;
  targetGroup: string;
  recipientCount: number;
  recipients: { name: string; phone: string }[];
  scheduledAt: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  result?: string;
  createdAt: string;
}

const SCHED_FILE = path.join(process.cwd(), 'scheduled-messages.json');

function loadScheduled(): ScheduledEntry[] {
  try {
    if (fs.existsSync(SCHED_FILE)) {
      return JSON.parse(fs.readFileSync(SCHED_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveScheduled(entries: ScheduledEntry[]) {
  fs.writeFileSync(SCHED_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

// Background scheduler: check every 30 seconds
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

function startScheduler() {
  if (schedulerInterval) return;
  schedulerInterval = setInterval(async () => {
    const entries = loadScheduled();
    const now = new Date();
    let changed = false;

    for (const entry of entries) {
      if (entry.status !== 'pending') continue;
      const scheduledTime = new Date(entry.scheduledAt);
      if (scheduledTime > now) continue;

      // Time to send
      entry.status = 'sending';
      saveScheduled(entries);
      changed = true;

      try {
        if (getStatus() !== 'connected') {
          entry.status = 'failed';
          entry.result = 'WhatsApp non connecté au moment de l\'envoi.';
        } else if (entry.groupJid) {
          if (entry.imageBase64) {
            await sendGroupImage(entry.groupJid, entry.imageBase64, entry.text);
          } else {
            await sendGroupMessage(entry.groupJid, entry.text);
          }
          entry.status = 'sent';
          entry.result = 'Envoyé au groupe WhatsApp.';
        } else if (entry.imageBase64) {
          const result = await sendBulkImage(entry.recipients, entry.imageBase64, entry.text);
          const total = result.success + result.failed;
          entry.status = result.failed > 0 ? (result.success > 0 ? 'sent' : 'failed') : 'sent';
          entry.result = `${result.success}/${total} envoyés${result.failed > 0 ? `, ${result.failed} échecs` : ''}`;
        } else {
          const result = await sendBulk(entry.recipients, entry.text);
          const total = result.success + result.failed;
          entry.status = result.failed > 0 ? (result.success > 0 ? 'sent' : 'failed') : 'sent';
          entry.result = `${result.success}/${total} envoyés${result.failed > 0 ? `, ${result.failed} échecs` : ''}`;
        }
      } catch (err: any) {
        entry.status = 'failed';
        entry.result = err.message;
      }
      changed = true;
    }

    if (changed) saveScheduled(entries);
  }, 30000);
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

async function startServer() {
  const app = express();
  const API_PORT = parseInt(process.env.API_PORT || '3001', 10);
  const isDev = process.env.NODE_ENV !== "production";

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve uploaded files
  const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  app.use('/uploads', express.static(UPLOADS_DIR));

  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  const SYSTEM_PROMPTS: Record<string, string> = {
    sermon: "Tu es un pasteur théologien compétent et bienveillant. Crée un plan de prédication structuré et inspirant en français. Inclue : Versets de référence, Thème principal, une introduction marquante, 3 points principaux expliqués avec des exemples de la vie quotidienne, et une conclusion chaleureuse avec une prière de consécration. Réoriente toujours vers l'espérance chrétienne. Réponds en Markdown soigné.",
    sms: "Tu es responsable de la communication d'une église chaleureuse. Rédige un modèle de message court, engageant et fraternel pour les fidèles (format SMS ou WhatsApp, environ 120-160 mots). Utilise UNIQUEMENT le formatage WhatsApp compatible : *gras*, _italique_, ~barré~, `code`. Pas de #, pas de **, pas de -, pas de listes Markdown. Utilise des émojis appropriés. Le nom et le téléphone de l'église te seront fournis dans le message — inclus-les naturellement dans le texte (ex: « À l'église X, contactez-nous au Y »). Ne mets PAS d'en-tête ni de titre, réponds uniquement avec le corps du message.",
    advice: "Tu es un consultant spirituel et d'administration d'église chevronné. Analyse les statistiques de l'église (finances ou assiduité en baisse) données par l'utilisateur et écris un rapport d'analyse de 3 courts paragraphes en français : d'abord des paroles d'encouragement pastoral pour l'équipe, ensuite 3 pistes d'actions concrètes (par ex. relancer la prière, visites de soutien, aménagement des cultes), et enfin une courte prière scellée de grâce.",
    event: "Tu es rédacteur d'annonces paroissiales. Rédige une description engageante pour un événement d'église en français. Inclus : titre accrocheur, date/lieu, programme, appel à participation. Format Markdown.",
    'bible-study': "Tu es un enseignant de la Bible pédagogue. Crée une étude biblique structurée en français : versets, contexte historique, questions de réflexion, application pratique, prière. Utilise le Markdown.",
    report: "Tu es un consultant expert en administration et gestion d'église. Rédige un rapport d'analyse détaillé et professionnel en français structuré ainsi :\n\n## 1. Résumé Exécutif\nSynthèse des points clés en 2-3 phrases.\n\n## 2. Analyse Financière\nExamine les revenus (dîmes, offrandes), dépenses, solde, tendances. Souligne les forces et les points de vigilance.\n\n## 3. Analyse de l'Assistance\nAnalyse la participation aux cultes, tendances (hausse/baisse), fidélisation.\n\n## 4. Analyse des Membres\nRépartition par statut (actif, inactif, observation), ministères, engagement.\n\n## 5. Pistes de Solutions & Recommandations\nPropose 3 à 5 actions concrètes, réalisables et priorisées avec pour chaque : objectif, bénéfice attendu, difficulté (faible/moyenne/élevée).\n\n## 6. Plan d'Action sur 90 Jours\nCalendrier avec étapes clés par mois.\n\n## 7. Conclusion & Prière\nEncouragement pastoral et vision.\n\nUtilise des titres clairs, des listes à puces, des tableaux si pertinent et des émojis avec parcimonie. Format Markdown professionnel.",
    exhortation: "Tu es un pasteur théologien spécialiste du grec et de l'hébreu. Tu rédiges des exhortations quotidiennes structurées, profondes et accessibles.\n\nStructure OBLIGATOIRE pour chaque jour :\n*Jour N — [Thème du jour]*\n_Sous-thème : [sujet spécifique]_\n\n*1. Verset du jour* : [référence précise]\n*2. Contexte* : [cadre historique ou littéraire en 1-2 phrases]\n*3. Mot clé en grec/hébreu* :\n• [Mot en grec/hébreu] : *[translittération]* = « [définition contextuelle] ». [Explique la richesse que la traduction française ne rend pas]\n• (si pertinent) [Second mot] : *[translittération]* = « [définition] »\n*4. Histoire biblique* : [récit biblique, parabole, personnage, ou anecdote patristique/missionnaire illustrant le thème — 3-5 phrases]\n*5. Enseignement* : [développement spirituel liant le mot grec/hébreu et l'histoire à la vie quotidienne — 2-3 paragraphes]\n*6. Application pratique* : [1-2 actions concrètes pour aujourd'hui]\n\n_Prière_ : [prière finale courte]\n\nRègles de formatage :\n• Utilise *gras* pour : les titres de sections, les mots grecs/hébreux, les mots-clés importants\n• Utilise _italique_ pour : le sous-thème du jour, les concepts théologiques\n• ~Barré~ si pertinent\n• `code` si pertinent\n• Chaque jour : 300-500 mots\n• Émojis : 1-2 max par jour\n• PAS de #, pas de **, pas de -, pas de listes Markdown\n\nPour le mode SÉRIE (plusieurs jours consécutifs — jusqu'à 7 jours) :\n• L'utilisateur donne : thème global + nombre de jours (2 à 7)\n• GÉNÈRE TOUS LES JOURS D'UN SEUL COUP dans cette même réponse. Ne t'arrête PAS après 3 jours. Ne demande JAMAIS de confirmation. Ne dis PAS « Je continue si vous voulez ». Écris TOUS les jours demandés immédiatement.\n• Progression logique sur la série :\n  - Jour 1 : Fondations — définition du thème, termes clés, introduction\n  - Jours 2 à N-1 : Développement progressif — chaque jour approfondit un aspect différent\n  - Dernier jour : Synthèse — récapitulation, engagement, prière de clôture\n• Chaque jour commence EXACTEMENT par : *Jour N — [titre]*\n• Chaque jour est autonome (un lecteur peut commencer par n'importe quel jour)"
  };

  function getSystemMessage(action: string): string {
    return SYSTEM_PROMPTS[action] || SYSTEM_PROMPTS.advice;
  }

  function getMistralClient(apiKey: string): Mistral {
    return new Mistral({ apiKey });
  }

  // Legacy non-streaming endpoint
  app.post("/api/assistant", async (req, res) => {
    try {
      const { action, prompt, apiKey } = req.body;
      const effectiveKey = apiKey || process.env.MISTRAL_API_KEY;
      if (!effectiveKey) {
        return res.status(400).json({
          success: false,
          error: "Clé d'API Mistral manquante. Configurez-la dans les Paramètres de l'application ou via MISTRAL_API_KEY dans .env.local"
        });
      }
      const client = getMistralClient(effectiveKey);
      const response = await client.chat.complete({
        model: "mistral-large-latest",
        messages: [
          { role: "system", content: getSystemMessage(action) },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        maxTokens: 8192,
      });
      res.json({ success: true, text: response.choices?.[0]?.message?.content || "" });
    } catch (err: any) {
      console.error("Mistral Assistant Route Error:", err);
      res.status(500).json({ success: false, error: err.message || "Erreur de génération avec l'IA." });
    }
  });

  // Streaming endpoint (SSE)
  app.post("/api/assistant/stream", async (req, res) => {
    try {
      const { action, prompt, apiKey } = req.body;
      const effectiveKey = apiKey || process.env.MISTRAL_API_KEY;
      if (!effectiveKey) {
        return res.status(400).json({ success: false, error: "Clé d'API Mistral manquante." });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const client = getMistralClient(effectiveKey);
      const stream = await client.chat.stream({
        model: "mistral-large-latest",
        messages: [
          { role: "system", content: getSystemMessage(action) },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        maxTokens: 8192,
      });

      for await (const chunk of stream) {
        const content = chunk.data.choices?.[0]?.delta?.content;
        if (content) {
          res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err: any) {
      console.error("Mistral Stream Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: err.message || "Erreur de streaming." });
      } else {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
    }
  });

  // WhatsApp Baileys endpoints
  app.get("/api/whatsapp/status", (_req, res) => {
    res.json({ status: getStatus(), qr: getQR() });
  });

  app.post("/api/whatsapp/send-bulk", async (req, res) => {
    try {
      const { recipients, text } = req.body;
      if (!recipients?.length || !text) {
        return res.status(400).json({ success: false, error: "Destinataires ou message manquants." });
      }
      if (getStatus() !== 'connected') {
        return res.status(400).json({ success: false, error: "WhatsApp non connecté.", qr: getQR() });
      }
      const result = await sendBulk(recipients, text);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/whatsapp/send-bulk-image", async (req, res) => {
    try {
      const { recipients, text, imageBase64 } = req.body;
      if (!recipients?.length || !imageBase64) {
        return res.status(400).json({ success: false, error: "Destinataires ou image manquants." });
      }
      if (getStatus() !== 'connected') {
        return res.status(400).json({ success: false, error: "WhatsApp non connecté.", qr: getQR() });
      }
      const result = await sendBulkImage(recipients, imageBase64, text || '');
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/whatsapp/groups", async (_req, res) => {
    try {
      const groups = await fetchGroups();
      res.json(groups);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/whatsapp/groups/refresh", async (_req, res) => {
    try {
      resetGroupsCache();
      const groups = await fetchGroups();
      res.json(groups);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/whatsapp/send-group", async (req, res) => {
    try {
      const { groupJid, text, imageBase64 } = req.body;
      if (!groupJid) return res.status(400).json({ success: false, error: "Groupe manquant." });
      if (getStatus() !== 'connected') return res.status(400).json({ success: false, error: "WhatsApp non connecté." });
      if (imageBase64) {
        await sendGroupImage(groupJid, imageBase64, text || '');
      } else {
        await sendGroupMessage(groupJid, text || '');
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Pinned groups
  const PINNED_FILE = path.join(process.cwd(), 'pinned-groups.json');
  function loadPinned(): string[] {
    try { if (fs.existsSync(PINNED_FILE)) return JSON.parse(fs.readFileSync(PINNED_FILE, 'utf-8')); } catch {}
    return [];
  }
  function savePinned(ids: string[]) { fs.writeFileSync(PINNED_FILE, JSON.stringify(ids, null, 2), 'utf-8'); }

  app.get("/api/whatsapp/groups/pinned", (_req, res) => {
    res.json(loadPinned());
  });

  app.post("/api/whatsapp/groups/pin", (req, res) => {
    try {
      const { groupId } = req.body;
      if (!groupId) return res.status(400).json({ success: false, error: "ID groupe manquant." });
      const pinned = loadPinned();
      if (!pinned.includes(groupId)) pinned.push(groupId);
      savePinned(pinned);
      res.json({ success: true, pinned });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  app.post("/api/whatsapp/groups/unpin", (req, res) => {
    try {
      const { groupId } = req.body;
      if (!groupId) return res.status(400).json({ success: false, error: "ID groupe manquant." });
      const pinned = loadPinned().filter(id => id !== groupId);
      savePinned(pinned);
      res.json({ success: true, pinned });
    } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
  });

  // Scheduled messages
  app.post("/api/whatsapp/schedule", (req, res) => {
    try {
      const { title, text, targetGroup, recipients, scheduledAt, imageBase64, groupJid } = req.body;
      if (!title || !text || (!recipients?.length && !groupJid) || !scheduledAt) {
        return res.status(400).json({ success: false, error: "Champs manquants." });
      }
      const entries = loadScheduled();
      const entry: ScheduledEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title, text, targetGroup, recipientCount: recipients?.length || 0,
        recipients: recipients || [], scheduledAt, status: 'pending',
        createdAt: new Date().toISOString()
      };
      if (imageBase64) entry.imageBase64 = imageBase64;
      if (groupJid) entry.groupJid = groupJid;
      entries.push(entry);
      saveScheduled(entries);
      res.json({ success: true, entry });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/whatsapp/scheduled", (_req, res) => {
    const entries = loadScheduled();
    entries.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
    res.json(entries);
  });

  app.delete("/api/whatsapp/scheduled/:id", (req, res) => {
    try {
      let entries = loadScheduled();
      const idx = entries.findIndex(e => e.id === req.params.id);
      if (idx === -1) return res.status(404).json({ success: false, error: "Introuvable." });
      const removed = entries[idx];
      if (removed.status !== 'pending') {
        return res.status(400).json({ success: false, error: "Seuls les messages en attente peuvent être annulés." });
      }
      entries.splice(idx, 1);
      saveScheduled(entries);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/whatsapp/reset", async (_req, res) => {
    try {
      await resetWhatsApp();
      res.json({ success: true, message: "WhatsApp réinitialisé. Un nouveau QR va apparaître dans quelques secondes." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/whatsapp/qr-image", async (_req, res) => {
    try {
      const qr = getQR();
      if (!qr) {
        return res.status(404).json({ error: "Aucun QR disponible" });
      }
      const qrDataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
      const base64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
      const buf = Buffer.from(base64, 'base64');
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': buf.length,
      });
      res.end(buf);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/whatsapp/qr-text", (_req, res) => {
    const qr = getQR();
    if (!qr) {
      return res.status(404).json({ error: "Aucun QR disponible" });
    }
    res.json({ qr });
  });

  app.get("/api/whatsapp/export-auth", (_req, res) => {
    const data = exportAuthAsBase64();
    if (!data) {
      return res.status(404).json({ error: "Aucune session WhatsApp trouvée" });
    }
    res.json({ success: true, data, hint: "Copiez ce data et ajoutez-le comme variable WA_AUTH_DATA sur Render" });
  });

  app.post("/api/whatsapp/import-auth", (req, res) => {
    try {
      const { data } = req.body;
      if (!data) return res.status(400).json({ success: false, error: "Données manquantes" });
      const ok = restoreAuthFromBase64(data);
      if (ok) {
        res.json({ success: true, message: "Session restaurée. Redémarrez WhatsApp." });
      } else {
        res.status(500).json({ success: false, error: "Échec de la restauration" });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/whatsapp/reconnect", async (_req, res) => {
    try {
      cleanup();
      await initWhatsApp();
      res.json({ success: true, message: "Reconnexion en cours..." });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Data persistence (sync from browser localStorage)
  const DATA_FILE = path.join(process.cwd(), 'app-data.json');

  app.post("/api/data/save", (req, res) => {
    try {
      const data = req.body;
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ success: false, error: "Données invalides" });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/data/load", (_req, res) => {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        return res.json({ success: true, data });
      }
      res.json({ success: true, data: null });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/renseignement/form", (_req, res) => {
    const appName = process.env.APP_NAME || "ELIKIA EKLESIA";
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Fiche de Renseignement — ${appName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9;color:#1e293b;padding:16px;padding-bottom:100px}
  .container{max-width:560px;margin:0 auto}
  .header{text-align:center;margin-bottom:20px;padding-top:10px}
  .header h1{font-size:20px;font-weight:800}
  .header p{font-size:12px;color:#64748b}
  .section{background:#fff;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .section h2{font-size:13px;font-weight:700;color:#4f46e5;margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px}
  .field{margin-bottom:12px}
  .field label{display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:3px}
  .field input,.field select{width:100%;padding:12px;font-size:15px;border:1.5px solid #e2e8f0;border-radius:8px;background:#fff;color:#1e293b;outline:none;-webkit-appearance:none;appearance:none}
  .field input:focus,.field select:focus{border-color:#4f46e5}
  .field .radio-group{display:flex;gap:8px}
  .field .radio-group label{font-size:15px;font-weight:500;display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:8px;flex:1;justify-content:center;background:#f8fafc;transition:all .15s;user-select:none;-webkit-user-select:none}
  .field .radio-group label:has(input:checked){border-color:#4f46e5;background:#eef2ff;color:#4f46e5;font-weight:600}
  .field .radio-group input[type="radio"]{width:18px;height:18px;accent-color:#4f46e5;margin:0;cursor:pointer}
  select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px}
  .actions{position:fixed;bottom:0;left:0;right:0;padding:12px 16px;background:#fff;border-top:1px solid #e2e8f0;z-index:100}
  .actions button{width:100%;padding:14px;font-size:15px;font-weight:700;border:none;border-radius:10px;cursor:pointer;background:#4f46e5;color:#fff;transition:opacity .15s}
  .actions button:active{opacity:.7}
  .actions button:disabled{opacity:.5}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${appName}</h1>
    <p>Fiche de Renseignement — Nouveau Membre</p>
  </div>

  <form action="/api/renseignement/submit" method="POST">
  <div class="section"><h2>État Civil</h2>
    <div class="field"><label>Nom & Prénoms *</label><input type="text" name="name" placeholder="Votre nom complet" required></div>
    <div class="field" style="display:flex;gap:10px">
      <div style="flex:1"><label>Date de Naissance</label><input type="date" name="birthday"></div>
      <div style="flex:1"><label>Lieu de Naissance</label><input type="text" name="birthPlace" placeholder="Ville, Pays"></div>
    </div>
    <div class="field" style="display:flex;gap:10px">
      <div style="flex:1"><label>Nationalité</label><input type="text" name="nationality" placeholder="Congolaise"></div>
      <div style="flex:1"><label>Sexe</label><div class="radio-group"><label><input type="radio" name="gender" value="M"> Masculin</label><label><input type="radio" name="gender" value="F"> Féminin</label></div></div>
    </div>
    <div class="field"><label>Situation Matrimoniale</label>
      <select name="maritalStatus"><option value="">Sélectionnez...</option><option>Célibataire</option><option>Marié(e)</option><option>Divorcé(e)</option><option>Veuf(ve)</option></select>
    </div>
    <div class="field" style="display:flex;gap:10px">
      <div style="flex:1"><label>Profession</label><input type="text" name="profession" placeholder="Votre métier"></div>
      <div style="flex:1"><label>Téléphone *</label><input type="tel" name="phone" placeholder="+242 XX XXX XXXX" required></div>
    </div>
    <div class="field" style="display:flex;gap:10px">
      <div style="flex:1"><label>Email</label><input type="email" name="email" placeholder="exemple@email.com"></div>
      <div style="flex:1"><label>Adresse</label><input type="text" name="address" placeholder="22 rue Owando, Talangaï"></div>
    </div>
  </div>
  <div style="height:80px"></div>
</div>
<div class="actions">
  <button type="submit" id="sendBtn">📤 Envoyer à l'Église</button>
</div>
</form>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });

  app.post("/api/renseignement/submit", async (req, res) => {
    try {
      const isForm = req.headers['content-type']?.includes('application/x-www-form-urlencoded');
      const data = isForm ? req.body : req.body.data;
      if (!data || !data.name) {
        const errMsg = "Données incomplètes — nom requis";
        if (isForm) return res.send(successPage(false, errMsg));
        return res.status(400).json({ success: false, error: errMsg });
      }

      const format = (v: any) => (v && v.trim ? v.trim() : v) || '—';
      const message = [
        "📋 *NOUVELLE FICHE DE RENSEIGNEMENT*",
        "",
        "━ *État Civil* ━",
        `👤 Nom : ${format(data.name)}`,
        `🎂 Né(e) le ${format(data.birthday)} à ${format(data.birthPlace)}`,
        `🌍 Nationalité : ${format(data.nationality)}  ⚤ Sexe : ${format(data.gender)}`,
        `💍 Situation : ${format(data.maritalStatus)}`,
        `💼 Profession : ${format(data.profession)}`,
        `📧 Email : ${format(data.email)}  📞 Tél : ${format(data.phone)}`,
        `🏠 Adresse : ${format(data.address)}`,
        "",
        "📎 *Envoyé depuis le formulaire mobile*"
      ].join('\n');

      const targetPhone = process.env.CHURCH_WHATSAPP || '';
      try {
        if (targetPhone) {
          await sendMessage(targetPhone, message);
          const jsonBuffer = Buffer.from(JSON.stringify({ data: { name: data.name, email: data.email || '', phone: data.phone || '', birthday: data.birthday || '', birthPlace: data.birthPlace || '', nationality: data.nationality || '', gender: data.gender || '', maritalStatus: data.maritalStatus || '', profession: data.profession || '', address: data.address || '' } }, null, 2), 'utf-8');
          await sendDocumentMessage(targetPhone, jsonBuffer, `Fiche-${data.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`, 'application/json');
        }
      } catch (e) {
        console.error("[FORM] Échec envoi WhatsApp:", e);
      }

      if (isForm) {
        return res.send(successPage(true));
      }
      res.json({ success: true });
    } catch (err: any) {
      const isForm = req.headers['content-type']?.includes('application/x-www-form-urlencoded');
      if (isForm) return res.send(successPage(false, err.message));
      res.status(500).json({ success: false, error: err.message });
    }
  });

  function successPage(success: boolean, error?: string): string {
    const appName = process.env.APP_NAME || "ELIKIA EKLESIA";
    if (success) {
      return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Merci — ${appName}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;margin:0}.card{background:#fff;border-radius:16px;padding:32px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08);max-width:400px}.icon{font-size:48px;margin-bottom:12px}h1{font-size:20px;color:#059669;margin:0 0 8px}p{font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.5}.btn{display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600}</style></head><body><div class="card"><div class="icon">✅</div><h1>Fiche envoyée avec succès !</h1><p>Merci ! Vos informations ont bien été transmises à l'église.<br>Nous vous contacterons dès que possible.</p><a class="btn" href="/api/renseignement/form">⬅ Retour</a></div></body></html>`;
    }
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Erreur — ${appName}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;margin:0}.card{background:#fff;border-radius:16px;padding:32px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08);max-width:400px}.icon{font-size:48px;margin-bottom:12px}h1{font-size:20px;color:#dc2626;margin:0 0 8px}p{font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.5}.btn{display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600}</style></head><body><div class="card"><div class="icon">❌</div><h1>Erreur</h1><p>${error || 'Impossible d\'envoyer la fiche. Veuillez réessayer.'}</p><a class="btn" href="/api/renseignement/form">⬅ Réessayer</a></div></body></html>`;
  }

  app.post("/api/renseignement/send-form", async (req, res) => {
    try {
      const { phone, htmlContent } = req.body;
      if (!phone || !htmlContent) {
        return res.status(400).json({ success: false, error: "Numéro et contenu HTML requis" });
      }

      const waStatus = getStatus();
      if (waStatus !== 'connected') {
        return res.status(400).json({ success: false, error: "WhatsApp non connecté", waStatus });
      }

      const buffer = Buffer.from(htmlContent, 'utf-8');
      await sendDocumentMessage(phone, buffer, 'Formulaire-Renseignement.html', 'text/html');

      await sendMessage(phone, "📋 *Formulaire de Renseignement* 📋\n\nVous recevez ce formulaire à remplir.\n1. Ouvrez le fichier ci-joint (.html)\n2. Remplissez tous les champs\n3. Appuyez sur « Envoyer à l'Église »\n4. Les données nous parviendront directement par WhatsApp\n\nMerci et que Dieu vous bénisse ! 🙏");

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Upload image pour Enseignement
  app.post("/api/upload-image", upload.single('image'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ success: false, error: "Image requise" });
      const ext = path.extname(file.originalname) || '.jpg';
      const filename = `ens_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), file.buffer);
      res.json({ success: true, url: `/uploads/${filename}` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- Facebook Graph API (avancé) ---

  // Upload d'image vers Facebook Page → retourne l'ID photo
  app.post("/api/facebook/upload-image", upload.single('image'), async (req, res) => {
    try {
      const { pageId, accessToken } = req.body;
      const file = req.file;
      if (!pageId || !accessToken || !file) {
        return res.status(400).json({ success: false, error: "pageId, accessToken et image requis" });
      }
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
      const bodyParts: string[] = [];
      bodyParts.push(`--${boundary}\r\nContent-Disposition: form-data; name="source"; filename="${file.originalname}"\r\nContent-Type: ${file.mimetype}\r\n\r\n`);
      const bodyStart = Buffer.from(bodyParts.join(''), 'utf-8');
      const bodyEnd = Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="access_token"\r\n\r\n${accessToken}\r\n--${boundary}--\r\n`, 'utf-8');
      const body = Buffer.concat([bodyStart, file.buffer, bodyEnd]);
      const fbRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body,
      });
      const data: any = await fbRes.json();
      if (data.id) {
        res.json({ success: true, photoId: data.id, url: data.images?.[0]?.source || null });
      } else {
        res.status(400).json({ success: false, error: data.error?.message || 'Erreur Facebook' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Publier un article (texte seul OU texte + images multiples en album)
  function buildAttachedMedia(photoIds: string[]): { media_fbid: string }[] {
    return photoIds.map(id => ({ media_fbid: id }));
  }

  async function uploadLocalImageToFacebook(imageUrl: string, pageId: string, accessToken: string): Promise<string | null> {
    try {
      let buffer: Buffer;
      if (imageUrl.startsWith('/uploads/')) {
        const localPath = path.join(process.cwd(), imageUrl);
        if (!fs.existsSync(localPath)) return null;
        buffer = fs.readFileSync(localPath);
      } else {
        const resp = await fetch(imageUrl);
        buffer = Buffer.from(await resp.arrayBuffer());
      }
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
      const bodyParts: string[] = [];
      bodyParts.push(`--${boundary}\r\nContent-Disposition: form-data; name="source"; filename="image.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`);
      const bodyStart = Buffer.from(bodyParts.join(''), 'utf-8');
      const bodyEnd = Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="access_token"\r\n\r\n${accessToken}\r\n--${boundary}--\r\n`, 'utf-8');
      const fbBody = Buffer.concat([bodyStart, buffer, bodyEnd]);
      const fbRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body: fbBody,
      });
      const data: any = await fbRes.json();
      return data.id || null;
    } catch { return null; }
  }

  app.post("/api/facebook/post-article", async (req, res) => {
    try {
      const { pageId, message, photoIds, imageUrls, scheduledTime, accessToken } = req.body;
      if (!pageId || !message || !accessToken) {
        return res.status(400).json({ success: false, error: "pageId, message et accessToken requis" });
      }

      const body: Record<string, any> = { message, access_token: accessToken };

      // Collecter tous les IDs (photoIds déjà sur Facebook + imageUrls locales à uploader)
      const allPhotoIds: string[] = Array.isArray(photoIds) ? [...photoIds] : [];
      if (Array.isArray(imageUrls)) {
        for (const url of imageUrls) {
          if (!url) continue;
          const pid = await uploadLocalImageToFacebook(url, pageId, accessToken);
          if (pid) allPhotoIds.push(pid);
        }
      }

      if (allPhotoIds.length > 0) {
        body.attached_media = JSON.stringify(buildAttachedMedia(allPhotoIds));
      }

      // Mode programmé
      if (scheduledTime) {
        body.scheduled_publish_time = Math.floor(new Date(scheduledTime).getTime() / 1000);
        body.published = false;
      }

      const fbRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: any = await fbRes.json();
      if (data.id) {
        res.json({
          success: true,
          postId: data.id,
          type: (Array.isArray(photoIds) && photoIds.length > 0) ? 'article' : 'text',
          imageCount: Array.isArray(photoIds) ? photoIds.length : 0,
          scheduled: !!scheduledTime,
        });
      } else {
        res.status(400).json({ success: false, error: data.error?.message || 'Erreur Facebook inconnue' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vérifier le token et lister les pages
  app.post("/api/facebook/verify", async (req, res) => {
    try {
      const { accessToken } = req.body;
      if (!accessToken) return res.status(400).json({ success: false, error: "accessToken requis" });
      const fbRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`);
      const data: any = await fbRes.json();
      if (data.data) {
        res.json({ success: true, pages: data.data.map((p: any) => ({ id: p.id, name: p.name, category: p.category, picture: p.picture?.data?.url || null })) });
      } else {
        res.status(400).json({ success: false, error: data.error?.message || 'Token invalide' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Déboguer un token (vérifier permissions et type)
  app.post("/api/facebook/debug-token", async (req, res) => {
    try {
      const { accessToken } = req.body;
      if (!accessToken) return res.status(400).json({ success: false, error: "accessToken requis" });
      // Vérifier le type de token (user vs page)
      const meRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name,permissions&access_token=${accessToken}`);
      const meData: any = await meRes.json();
      // Vérifier si c'est un token de page
      const accountsRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`);
      const accountsData: any = await accountsRes.json();
      const info: any = { type: 'unknown', id: meData.id, name: meData.name, permissions: [], pages: [], error: null };
      if (meData.error) {
        info.error = meData.error.message;
      } else {
        info.id = meData.id;
        info.name = meData.name;
        info.permissions = (meData.permissions?.data || []).map((p: any) => ({ permission: p.permission, status: p.status }));
        info.type = 'user';
      }
      if (accountsData.data) {
        info.type = 'page';
        info.pages = accountsData.data.map((p: any) => ({ id: p.id, name: p.name }));
      } else if (accountsData.error) {
        info.error = accountsData.error.message;
      }
      res.json({ success: true, info });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Serve Frontend Assets (production only — dev uses Vite on port 5173)
  if (!isDev) {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Initialize WhatsApp client (non-blocking)
  initWhatsApp().catch(err => console.error("[WA] Init error:", err));
  startScheduler();

  app.listen(API_PORT, "0.0.0.0", () => {
    console.log(`API server on http://0.0.0.0:${API_PORT} [${isDev ? 'dev' : 'prod'}]`);
  });
}

process.on('SIGINT', () => { stopScheduler(); cleanup(); process.exit(0); });
process.on('SIGTERM', () => { stopScheduler(); cleanup(); process.exit(0); });

startServer().catch((error) => {
  console.error("Server start-up failed dangerously:", error);
});
