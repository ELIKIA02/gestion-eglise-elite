import express from "express";
import path from "path";
import fs from "fs";
import { Mistral } from "@mistralai/mistralai";
import dotenv from "dotenv";
import QRCode from "qrcode";
import { initWhatsApp, getStatus, getQR, sendBulk, sendBulkImage, fetchGroups, getGroups, resetGroupsCache, sendGroupMessage, sendGroupImage, cleanup, resetWhatsApp, exportAuthAsBase64, restoreAuthFromBase64 } from "./whatsapp-client";

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

  app.use(express.json());

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
