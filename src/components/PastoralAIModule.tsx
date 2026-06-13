import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, BookOpen, MessageSquare, Heart, Copy, Printer, Loader2, History, Send, Users, Calendar, FileText, FileDown, Sun, CheckSquare, Square, Clock, Bookmark } from 'lucide-react';
import { ChurchSettings, Member, FinanceTransaction, ChurchEvent } from '../types';

interface PastoralAIModuleProps {
  settings: ChurchSettings | null;
  members: Member[];
  transactions: FinanceTransaction[];
  events: ChurchEvent[];
  onNavigate: (tab: string, text?: string) => void;
}

type AiMode = 'sermon' | 'sms' | 'advice' | 'event' | 'bible-study' | 'exhortation' | 'reference';
type SmsTone = 'fervent' | 'formel' | 'urgent';

const MODE_CONFIG: Record<AiMode, { label: string; icon: React.ElementType; placeholder: string; systemPrompt: string }> = {
  sermon: {
    label: 'Plan de Prédication',
    icon: BookOpen,
    placeholder: 'Thème, versets clés, contexte...',
    systemPrompt: "Tu es un pasteur théologien compétent et bienveillant. Crée un plan de prédication structuré et inspirant en français. Inclus : Versets de référence, Thème principal, introduction marquante, 3 points principaux expliqués avec des exemples de la vie quotidienne, et conclusion chaleureuse avec prière. Réponds en Markdown soigné."
  },
  sms: {
    label: 'SMS & WhatsApp',
    icon: MessageSquare,
    placeholder: 'Date, heure, objet de l\'annonce...',
    systemPrompt: "Tu es responsable de la communication d'une église. Rédige un message court, engageant et fraternel (120-160 mots). Utilise des émojis avec parcimonie. Adapte le ton selon l'instruction."
  },
  advice: {
    label: 'Conseil & Croissance',
    icon: Heart,
    placeholder: 'Problématique observée (baisse, conflit, etc.)...',
    systemPrompt: "Tu es un consultant spirituel et d'administration d'église chevronné. Analyse les données fournies et écris un rapport de 3 paragraphes : encouragement pastoral, 3 pistes d'actions concrètes, prière de clôture."
  },
  event: {
    label: 'Desc. d\'Événement',
    icon: Calendar,
    placeholder: 'Type d\'événement, date, public cible...',
    systemPrompt: "Tu es rédacteur d'annonces paroissiales. Rédige une description engageante pour un événement d'église en français. Inclus : titre accrocheur, date/lieu, programme, appel à participation. Format Markdown."
  },
  'bible-study': {
    label: 'Étude Biblique',
    icon: Sparkles,
    placeholder: 'Livre, chapitre, thème d\'étude...',
    systemPrompt: "Tu es un enseignant de la Bible pédagogue. Crée une étude biblique structurée en français : versets, contexte historique, questions de réflexion, application pratique, prière. Utilise le Markdown."
  },
  reference: {
    label: 'Référence Biblique',
    icon: Bookmark,
    placeholder: '',
    systemPrompt: ""
  },
  exhortation: {
    label: 'Exhortation',
    icon: Sun,
    placeholder: 'Thème de l\'exhortation (espérance, foi, persévérance...)',
    systemPrompt: "Tu es un pasteur spirituel qui rédige des exhortations quotidiennes. Écris un texte court, puissant et encourageant (80-120 mots). Ton sobre, chaleureux mais pas excessif. Structure : verset du jour, message d'encouragement, application pratique courte, prière. Très peu d'émojis. Pas de #, pas de **, pas de listes Markdown."
  }
};

const SUGGESTED_PROMPTS: Record<AiMode, string[]> = {
  sermon: [
    "Thème : Marcher par l'Esprit. Versets : Galates 5:16-25. Contexte : Encourager les jeunes à persévérer.",
    "Thème : L'amour qui pardonne. Versets : Luc 15:11-32 (Fils prodigue). Public : Familles et couples.",
    "Thème : La foi en action. Versets : Jacques 2:14-26. Contexte : Service chrétien et œuvres."
  ],
  sms: [
    "Rappel culte dimanche 10h avec collation fraternelle. Ambiance chaleureuse et louange.",
    "Invitation jeûne communautaire mercredi 06h-18h. Thème : Délivrance et renouveau.",
    "Campagne de dons pour familles démunies de la paroisse. Dépôt au secrétariat."
  ],
  advice: [
    "Baisse de participation de 20% aux activités en semaine. Comment relancer l'intérêt ?",
    "Conflit entre deux départements de service. Comment restaurer l'unité ?",
    "Budget trésorerie serré ce trimestre. Conseils pour mobiliser les offrandes."
  ],
  event: [
    "Concert de louange le samedi 15 juillet à 18h. Entrée libre. Artistes invités.",
    "Séminaire de mariage chrétien sur 2 jours. Thème : Construire un foyer solide.",
    "Camp de jeunesse du 10 au 14 août. Inscriptions ouvertes aux 15-25 ans."
  ],
  'bible-study': [
    "Étude du Psaume 23 : 'L'Éternel est mon berger'. Thème : La confiance en Dieu.",
    "Étude de Matthieu 5-7 (Sermon sur la montagne). Thème : Les Béatitudes.",
    "Étude de Romains 12 : Le sacrifice vivant et les dons spirituels."
  ],
  exhortation: [
    "Thème : L'espérance qui ne déçoit pas. Série de 7 jours sur la confiance en Dieu.",
    "Thème : Marcher par la foi et non par la vue. Quotidien avec des versets clés.",
    "Thème : La paix intérieure dans un monde agité. Exhortations pour l'âme."
  ],
  reference: []
};

const SERIES_STORAGE_KEY = 'exhortation-saved-series';

function loadSavedSeries(): { days: { day: number; text: string }[]; prompt: string; theme: string } | null {
  try {
    const raw = localStorage.getItem(SERIES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { console.error('[IA] loadSavedSeries failed:', e); return null; }
}

function saveSeriesToStorage(days: { day: number; text: string }[], prompt: string, theme: string) {
  try {
    localStorage.setItem(SERIES_STORAGE_KEY, JSON.stringify({ days, prompt, theme }));
  } catch (e) { console.error('[IA] saveSeriesToStorage failed:', e); }
}

function clearSavedSeries() {
  try { localStorage.removeItem(SERIES_STORAGE_KEY); } catch (e) { console.error('[IA] clearSavedSeries failed:', e); }
}

export default function PastoralAIModule({ settings, members, transactions, events, onNavigate }: PastoralAIModuleProps) {
  const [action, setAction] = useState<AiMode>('sermon');
  const [promptInput, setPromptInput] = useState('');
  const [response, setResponse] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [smsTone, setSmsTone] = useState<SmsTone>('fervent');
  const [history, setHistory] = useState<{ prompt: string; response: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [numberOfDays, setNumberOfDays] = useState(7);
  const [parsedDays, setParsedDays] = useState<{ day: number; text: string }[]>(() => {
    const saved = loadSavedSeries();
    return saved?.days || [];
  });
  const [seriesMode, setSeriesMode] = useState(() => {
    const saved = loadSavedSeries();
    return saved?.days ? true : false;
  });
  const [seriesStartDate, setSeriesStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [seriesStartTime, setSeriesStartTime] = useState('08:00');
  const [schedulingSeries, setSchedulingSeries] = useState(false);
  const [scheduleTargetGroup, setScheduleTargetGroup] = useState('Tous');
  const [scheduleResult, setScheduleResult] = useState<string | null>(null);
  const [waStatus, setWaStatus] = useState<string>('checking');
  const [waGroups, setWaGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedGroupJid, setSelectedGroupJid] = useState('');
  const [savedSeriesInfo, setSavedSeriesInfo] = useState<string>(() => {
    const saved = loadSavedSeries();
    return saved ? saved.theme : '';
  });
  const responseRef = useRef<HTMLDivElement>(null);

  const BIBLE_BOOKS = [
    { name: 'Genèse', chapters: 50 }, { name: 'Exode', chapters: 40 }, { name: 'Lévitique', chapters: 27 },
    { name: 'Nombres', chapters: 36 }, { name: 'Deutéronome', chapters: 34 }, { name: 'Josué', chapters: 24 },
    { name: 'Juges', chapters: 21 }, { name: 'Ruth', chapters: 4 }, { name: '1 Samuel', chapters: 31 },
    { name: '2 Samuel', chapters: 24 }, { name: '1 Rois', chapters: 22 }, { name: '2 Rois', chapters: 25 },
    { name: '1 Chroniques', chapters: 29 }, { name: '2 Chroniques', chapters: 36 }, { name: 'Esdras', chapters: 10 },
    { name: 'Néhémie', chapters: 13 }, { name: 'Esther', chapters: 10 }, { name: 'Job', chapters: 42 },
    { name: 'Psaumes', chapters: 150 }, { name: 'Proverbes', chapters: 31 }, { name: 'Ecclésiaste', chapters: 12 },
    { name: 'Cantique', chapters: 8 }, { name: 'Ésaïe', chapters: 66 }, { name: 'Jérémie', chapters: 52 },
    { name: 'Lamentations', chapters: 5 }, { name: 'Ézéchiel', chapters: 48 }, { name: 'Daniel', chapters: 12 },
    { name: 'Osée', chapters: 14 }, { name: 'Joël', chapters: 3 }, { name: 'Amos', chapters: 9 },
    { name: 'Abdias', chapters: 1 }, { name: 'Jonas', chapters: 4 }, { name: 'Michée', chapters: 7 },
    { name: 'Nahum', chapters: 3 }, { name: 'Habacuc', chapters: 3 }, { name: 'Sophonie', chapters: 3 },
    { name: 'Aggée', chapters: 2 }, { name: 'Zacharie', chapters: 14 }, { name: 'Malachie', chapters: 4 },
    { name: 'Matthieu', chapters: 28 }, { name: 'Marc', chapters: 16 }, { name: 'Luc', chapters: 24 },
    { name: 'Jean', chapters: 21 }, { name: 'Actes', chapters: 28 }, { name: 'Romains', chapters: 16 },
    { name: '1 Corinthiens', chapters: 16 }, { name: '2 Corinthiens', chapters: 13 }, { name: 'Galates', chapters: 6 },
    { name: 'Éphésiens', chapters: 6 }, { name: 'Philippiens', chapters: 4 }, { name: 'Colossiens', chapters: 4 },
    { name: '1 Thessaloniciens', chapters: 5 }, { name: '2 Thessaloniciens', chapters: 3 }, { name: '1 Timothée', chapters: 6 },
    { name: '2 Timothée', chapters: 4 }, { name: 'Tite', chapters: 3 }, { name: 'Philémon', chapters: 1 },
    { name: 'Hébreux', chapters: 13 }, { name: 'Jacques', chapters: 5 }, { name: '1 Pierre', chapters: 5 },
    { name: '2 Pierre', chapters: 3 }, { name: '1 Jean', chapters: 5 }, { name: '2 Jean', chapters: 1 },
    { name: '3 Jean', chapters: 1 }, { name: 'Jude', chapters: 1 }, { name: 'Apocalypse', chapters: 22 },
  ];
  const [refBook, setRefBook] = useState('Jean');
  const [refChapter, setRefChapter] = useState(3);
  const [refVerse, setRefVerse] = useState('');
  const [refResult, setRefResult] = useState<string | null>(null);
  const [refLoading, setRefLoading] = useState(false);
  const [refTranslation, setRefTranslation] = useState('segond');

  useEffect(() => {
    if (parsedDays.length > 0 && action === 'exhortation') {
      saveSeriesToStorage(parsedDays, promptInput, promptInput);
      setSavedSeriesInfo(promptInput);
    }
  }, [parsedDays, action, promptInput]);

  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/whatsapp/status');
        const data = await res.json();
        setWaStatus(data.status);
      } catch { setWaStatus('unreachable'); }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (waStatus === 'connected') {
      const loadGroups = () => {
        fetch('/api/whatsapp/groups').then(r => r.json()).then(groups => {
          if (Array.isArray(groups)) setWaGroups(groups);
        }).catch(() => {});
      };
      loadGroups();
      const id = setInterval(loadGroups, 15000);
      return () => clearInterval(id);
    } else {
      setWaGroups([]);
    }
  }, [waStatus]);

  const CONTEXT_MARKER_START = '=== DONNÉES ÉGLISE (contexte réel) ===';
  const CONTEXT_MARKER_END = '=== FIN DU CONTEXTE ===';

  const actionConfig = MODE_CONFIG[action];
  const Icon = actionConfig.icon;

  const getChurchContextText = () => {
    const activeMembers = members.filter(m => m.status === 'Actif').length;
    const totalRev = transactions.filter(t => t.type === 'Revenu').reduce((s, t) => s + t.amount, 0);
    const totalExp = transactions.filter(t => t.type === 'Dépense').reduce((s, t) => s + t.amount, 0);
    const avgAttendance = events.length > 0
      ? Math.round(events.reduce((s, e) => s + (e.attendance || 0), 0) / events.length)
      : 0;
    const ministryCounts = members.reduce((acc, m) => {
      const key = m.ministry || 'Non assigné';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const ministryList = Object.entries(ministryCounts).map(([k, v]) => `- ${k}: ${v}`).join('\n');

    return `\n\n${CONTEXT_MARKER_START}\nMembres: ${members.length} (${activeMembers} actifs)\nRecettes: ${totalRev.toLocaleString('fr-FR')} FCFA\nDépenses: ${totalExp.toLocaleString('fr-FR')} FCFA\nSolde: ${(totalRev - totalExp).toLocaleString('fr-FR')} FCFA\nAssistance moyenne: ${avgAttendance} pers.\nÉvénements: ${events.length} cultes\nMinistères:\n${ministryList}\n${CONTEXT_MARKER_END}`;
  };

  const hasContextInPrompt = (text: string) =>
    text.includes(CONTEXT_MARKER_START) && text.includes(CONTEXT_MARKER_END);

  const toggleContext = () => {
    setPromptInput(prev => {
      if (hasContextInPrompt(prev)) {
        const idx = prev.indexOf(CONTEXT_MARKER_START);
        return prev.substring(0, idx).trimEnd();
      }
      return prev + getChurchContextText();
    });
  };

  const applySuggested = (text: string) => {
    setPromptInput(text);
  };

  const fetchBibleVerse = async () => {
    if (!refBook) return;
    setRefLoading(true);
    setRefResult(null);
    try {
      const ref = refVerse
        ? `${refBook}+${refChapter}:${refVerse}`
        : `${refBook}+${refChapter}`;
      const res = await fetch(`https://bible-api.com/${ref}?translation=${refTranslation}`);
      const data: any = await res.json();
      if (data.error) {
        setRefResult(`❌ ${data.error}`);
      } else {
        const lines = data.verses?.map((v: any) => `**${v.book_name} ${v.chapter}:${v.verse}**\n${v.text}`).join('\n\n') || data.text;
        setRefResult(data.reference + '\n\n' + lines + '\n\n*— ' + data.translation_name + '*');
      }
    } catch (err: any) {
      setRefResult(`❌ Erreur: ${err.message}`);
    }
    setRefLoading(false);
  };

  const sendRefToIA = () => {
    if (refResult) {
      const clean = refResult.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
      setAction('bible-study');
      setPromptInput(`Étude biblique détaillée sur :\n\n${clean}`);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    setGenerating(true);
    setResponse('');
    setCopied(false);

    let effectivePrompt = promptInput;
    let effectiveAction = action;
    if (action === 'sms') {
      const churchInfo = `Église: ${settings?.appName || 'Non définie'}\nTéléphone: ${settings?.churchPhone || 'Non défini'}\n`;
      if (!effectivePrompt.includes(churchInfo.trim())) {
        effectivePrompt = churchInfo + effectivePrompt;
      }
      const toneMap: Record<SmsTone, string> = {
        fervent: '\n\n(Ton : fervent, chaleureux, fraternel)',
        formel: '\n\n(Ton : formel, respectueux, administratif)',
        urgent: '\n\n(Ton : urgent, mobilisateur, appel à action immédiate)'
      };
      effectivePrompt += toneMap[smsTone];
    }
    if (action === 'exhortation' && seriesMode) {
      effectivePrompt = `Thème : "${promptInput}". ${numberOfDays} jours. Génère chaque jour avec la structure complète (verset, contexte, mot grec/hébreu, histoire biblique, enseignement, application, prière).`;
      setParsedDays([]);
      clearSavedSeries();
      setSavedSeriesInfo('');
    }

    try {
      const res = await fetch("/api/assistant/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: effectiveAction,
          prompt: effectivePrompt,
          apiKey: settings?.mistralApiKey || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setResponse(`### ⚠️ Erreur\n\n${errData.error || `HTTP ${res.status}`}`);
        setGenerating(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setResponse("### ⚠️ Erreur\n\nFlux de lecture indisponible.");
        setGenerating(false);
        return;
      }

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                fullText += data.text;
                setResponse(fullText);
              }
              if (data.done) {
                setHistory(prev => [{ prompt: promptInput, response: fullText }, ...prev]);
              }
            } catch (e) { console.error('[IA] Stream parse error:', e); }
          }
        }
      }

      if (!fullText) {
        setResponse("### ⚠️ Aucun contenu généré. Vérifie ta clé API Mistral dans Paramètres.");
      } else if (action === 'exhortation' && seriesMode) {
        const dayRegex = /(?:\*|##)\s*Jour\s*(\d+)\s*[—–-]?\s*/gi;
        const parts = fullText.split(/(?=(?:\*|##)\s*Jour\s*\d+\s*[—–-]?\s*)/gi);
        const days: { day: number; text: string }[] = [];
        for (const part of parts) {
          const match = part.match(dayRegex);
          if (match) {
            const num = parseInt(match[0].replace(/[^0-9]/g, ''), 10);
            days.push({ day: num, text: part.trim() });
          }
        }
        if (days.length > 0) {
          setParsedDays(days);
        }
      }
    } catch (err: any) {
      console.error(err);
      setResponse(`### ⚠️ Erreur de connexion\n\nImpossible de contacter le serveur. ${err.message || ''}`);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!response) return;
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMarkdown = () => {
    if (!response) return;
    const blob = new Blob([`# ${actionConfig.label}\n\n${response}`], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `eglise-${action}-${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportWord = () => {
    if (!response) return;
    const title = `Rapport - ${actionConfig.label} - ${settings?.appName || 'Église'}`;
    const html = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: 'Calibri', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; margin: 40px; }
  h1 { color: #4f46e5; font-size: 18pt; border-bottom: 2px solid #4f46e5; padding-bottom: 6px; }
  h2 { color: #4338ca; font-size: 14pt; margin-top: 20px; }
  h3 { color: #6366f1; font-size: 12pt; }
  p { margin: 6px 0; }
  ul, ol { margin: 4px 0 8px 20px; }
  li { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10pt; }
  th { background-color: #4f46e5; color: #fff; padding: 6px 8px; text-align: left; }
  td { border: 1px solid #cbd5e1; padding: 4px 8px; }
  .header { text-align: center; border-bottom: 3px double #4f46e5; padding-bottom: 10px; margin-bottom: 20px; }
  .header .logo { font-size: 24pt; font-weight: bold; color: #4f46e5; }
  .header .sub { font-size: 9pt; color: #64748b; }
  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 9pt; color: #94a3b8; font-style: italic; }
  strong { color: #1e293b; }
  blockquote { border-left: 3px solid #4f46e5; padding-left: 10px; color: #475569; margin: 10px 0; }
</style></head><body>
<div class="header">
  <div class="logo">${settings?.appLogo?.startsWith('data:image') ? `<img src="${settings.appLogo}" alt="Logo" style="width:50px;height:50px;object-fit:contain;vertical-align:middle;" />` : (settings?.appLogo || '⛪')}</div>
  <div style="font-size:16pt;font-weight:bold;">${settings?.appName || "ELIKIA EKLESIA"}</div>
  <div class="sub">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
</div>
${response
  .replace(/^### (.+)$/gm, '<h3>$1</h3>')
  .replace(/^## (.+)$/gm, '<h2>$1</h2>')
  .replace(/^# (.+)$/gm, '<h1>$1</h1>')
  .replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>')
  .replace(/^- (.+)$/gm, '<li>$1</li>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/\n\n/g, '</p><p>')
  .replace(/\n/g, '<br/>')
}
<div class="footer">Document généré par l'Assistant Pastoral IA (Mistral) — ${new Date().toLocaleDateString('fr-FR')}</div>
</body></html>`;

    const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport-eglise-${action}-${Date.now()}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (!response) return;
    const title = `${actionConfig.label} - ${settings?.appName || 'Église'}`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = response
      .replace(/^### (.+)$/gm, '<h3 style="color:#4f46e5;margin-top:16px;">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="color:#4338ca;margin-top:20px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="color:#4f46e5;font-size:18pt;border-bottom:2px solid #4f46e5;padding-bottom:6px;">$1</h1>')
      .replace(/^- (.+)$/gm, '<li style="margin:2px 0;">$1</li>')
      .replace(/^(\d+)\.\s+(.+)$/gm, '<li style="margin:2px 0;">$2</li>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p style="margin:8px 0;">')
      .replace(/\n/g, '<br/>');

    const churchName = settings?.appName || "ELIKIA EKLESIA";
    const logo = settings?.appLogo?.startsWith('data:image')
      ? `<img src="${settings.appLogo}" alt="Logo" style="width:50px;height:50px;object-fit:contain;vertical-align:middle;margin-bottom:4px;" />`
      : (settings?.appLogo || '⛪');
    const dateStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { margin: 20mm 15mm; }
  body { font-family: 'Calibri', 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1e293b; padding: 0; margin: 0; }
  .report-header { text-align: center; border-bottom: 3px double #4f46e5; padding-bottom: 14px; margin-bottom: 24px; }
  .report-header .logo { font-size: 28pt; font-weight: bold; color: #4f46e5; }
  .report-header .name { font-size: 16pt; font-weight: bold; color: #1e293b; margin-top: 4px; }
  .report-header .date { font-size: 9pt; color: #64748b; margin-top: 2px; }
  h1 { color: #4f46e5; font-size: 18pt; border-bottom: 2px solid #4f46e5; padding-bottom: 6px; margin-top: 24px; }
  h2 { color: #4338ca; font-size: 14pt; margin-top: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  h3 { color: #6366f1; font-size: 12pt; margin-top: 16px; }
  p { margin: 8px 0; text-align: justify; }
  ul, ol { margin: 6px 0 10px 20px; }
  li { margin: 3px 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  th { background-color: #4f46e5; color: #fff; padding: 6px 10px; text-align: left; font-weight: bold; }
  td { border: 1px solid #cbd5e1; padding: 5px 10px; }
  tr:nth-child(even) { background-color: #f8fafc; }
  .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 9pt; color: #94a3b8; font-style: italic; }
  strong { color: #1e293b; }
  blockquote { border-left: 4px solid #4f46e5; padding-left: 12px; color: #475569; margin: 10px 0; font-style: italic; }
  @media print {
    body { font-size: 10pt; }
    .no-print { display: none; }
  }
</style></head><body>
<div class="report-header">
  <div class="logo">${logo}</div>
  <div class="name">${churchName}</div>
  <div class="date">${dateStr}</div>
</div>
<p style="margin:8px 0;">${content}</p>
<div class="footer">Document généré par l'Assistant Pastoral IA (Mistral) — ${dateStr}</div>
</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleScheduleSeries = async () => {
    if (parsedDays.length === 0) return;
    setSchedulingSeries(true);
    setScheduleResult(null);

    const isGroupTarget = scheduleTargetGroup.startsWith('__group__');
    const groupJid = isGroupTarget ? scheduleTargetGroup.replace('__group__', '') : '';
    const targetName = isGroupTarget
      ? waGroups.find(g => g.id === groupJid)?.name || groupJid
      : scheduleTargetGroup;

    const targetMembers = isGroupTarget ? [] : members.filter(m => {
      if (scheduleTargetGroup === 'Tous') return true;
      if (scheduleTargetGroup === 'Actif') return m.status === 'Actif';
      return (m.ministry || 'Non assigné') === scheduleTargetGroup;
    }).filter(m => m.phone);

    let success = 0;
    let failed = 0;

    for (let i = 0; i < parsedDays.length; i++) {
      const day = parsedDays[i];
      const dayDate = new Date(new Date(seriesStartDate).getTime() + i * 86400000);
      const [h, m] = seriesStartTime.split(':').map(Number);
      dayDate.setHours(h, m, 0, 0);
      const scheduledAt = dayDate.toISOString();

      try {
        const body: any = {
          title: `Exhortation - Jour ${day.day}`,
          text: day.text,
          targetGroup: targetName,
          recipients: targetMembers.map(m => ({ name: m.name, phone: m.phone })),
          scheduledAt
        };
        if (groupJid) body.groupJid = groupJid;

        const res = await fetch('/api/whatsapp/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (res.ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    }

    setScheduleResult(`${success} jour(s) programmé(s) avec succès${failed > 0 ? `, ${failed} échec(s)` : ''}`);
    setSchedulingSeries(false);
  };

  const charCount = promptInput.length;
  const smsLimit = 160;

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl text-slate-800 font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            Assistant Pastoral IA (Mistral)
          </h2>
          <p className="text-xs text-slate-500">Sermons, messages, rapports d'analyse, descriptions et études bibliques</p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
        >
          <History className="w-3.5 h-3.5" />
          Historique ({history.length})
        </button>
      </div>

      {showHistory && history.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 max-h-60 overflow-y-auto">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dernières générations</h3>
          {history.map((h, i) => (
            <div
              key={i}
              className="text-xs p-3 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:bg-indigo-50 transition-all"
              onClick={() => { setPromptInput(h.prompt); setResponse(h.response); setShowHistory(false); }}
            >
              <p className="font-semibold text-slate-700 truncate">{h.prompt}</p>
              <p className="text-slate-400 truncate mt-0.5">{h.response.slice(0, 80)}...</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Choisir un axe</label>
              <div className="flex flex-col gap-1.5">
                {(Object.entries(MODE_CONFIG) as [AiMode, typeof MODE_CONFIG[AiMode]][]).map(([key, cfg]) => {
                  const ModIcon = cfg.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setAction(key); setPromptInput(''); }}
                      className={`flex items-center gap-3 p-2.5 rounded-lg text-left text-xs font-medium border transition-all cursor-pointer ${
                        action === key
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-semibold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <ModIcon className={`w-4 h-4 ${action === key ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={action === 'reference' ? (e) => { e.preventDefault(); fetchBibleVerse(); } : handleGenerate} className="space-y-4 pt-1">
              {action === 'reference' ? (
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-700">Référence biblique</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select value={refBook} onChange={e => { setRefBook(e.target.value); setRefChapter(1); setRefVerse(''); setRefResult(null); }}
                      className="text-xs p-2 border border-slate-200 rounded-lg bg-white focus:outline-indigo-600">
                      {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                    </select>
                    <select value={refChapter} onChange={e => { setRefChapter(Number(e.target.value)); setRefVerse(''); setRefResult(null); }}
                      className="text-xs p-2 border border-slate-200 rounded-lg bg-white focus:outline-indigo-600">
                      {Array.from({ length: BIBLE_BOOKS.find(b => b.name === refBook)?.chapters || 1 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <input type="text" value={refVerse} onChange={e => setRefVerse(e.target.value.replace(/[^0-9,\-]/g, ''))}
                      placeholder="Verset(s) (ex: 16-18)"
                      className="text-xs p-2 border border-slate-200 rounded-lg bg-white focus:outline-indigo-600" />
                  </div>
                  <div className="flex gap-2">
                    <select value={refTranslation} onChange={e => setRefTranslation(e.target.value)}
                      className="text-xs p-1.5 border border-slate-200 rounded-lg bg-white">
                      <option value="segond">Segond 1910</option>
                      <option value="kjv">King James (KJV)</option>
                      <option value="web">World English (WEB)</option>
                      <option value="ylt">Young's Literal (YLT)</option>
                    </select>
                    <button type="submit" disabled={refLoading || !refBook}
                      className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer">
                      {refLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bookmark className="w-4 h-4" />}
                      {refLoading ? 'Recherche...' : 'Chercher'}
                    </button>
                  </div>
                </div>
              ) : (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700">Instructions *</label>
                  <div className="flex gap-2">
                    {action === 'sms' && (
                      <select
                        value={smsTone}
                        onChange={(e) => setSmsTone(e.target.value as SmsTone)}
                        className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-white"
                      >
                        <option value="fervent">Ton fervent</option>
                        <option value="formel">Ton formel</option>
                        <option value="urgent">Ton urgent</option>
                      </select>
                    )}
                    <button type="button" onClick={toggleContext}
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold cursor-pointer ${hasContextInPrompt(promptInput) ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}
                      title="Insère ou retire les données réelles de l'église dans vos instructions">
                      Contexte église
                    </button>
                  </div>
                </div>

                <textarea
                  required
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  rows={4}
                  placeholder={actionConfig.placeholder}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-indigo-600 font-sans"
                />
                {action === 'sms' && (
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className={charCount > smsLimit ? 'text-rose-600 font-bold' : 'text-slate-400'}>
                      {charCount} / {smsLimit} car.
                    </span>
                    {charCount <= smsLimit && <span className="text-emerald-600">SMS unique</span>}
                  </div>
                )}
              </div>
              )}

              {/* Quick prompts */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Suggestions rapides</label>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_PROMPTS[action].map((text, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applySuggested(text)}
                      className="text-[10px] bg-slate-50 hover:bg-indigo-50 text-slate-600 border border-slate-200 px-2 py-1 rounded-lg transition-all cursor-pointer truncate max-w-[200px]"
                    >
                      {text.slice(0, 40)}...
                    </button>
                  ))}
                </div>
              </div>

              {action === 'exhortation' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setSeriesMode(!seriesMode)}
                      className="cursor-pointer"
                    >
                      {seriesMode ? <CheckSquare className="w-4 h-4 text-amber-600" /> : <Square className="w-4 h-4 text-slate-400" />}
                    </button>
                    <span className="text-xs font-semibold text-amber-800">Mode série</span>
                  </label>
                  {seriesMode && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-amber-700 font-medium">Nombre de jours :</span>
                      <input
                        type="number"
                        min={2}
                        max={30}
                        value={numberOfDays}
                        onChange={(e) => setNumberOfDays(Math.max(2, Math.min(30, parseInt(e.target.value) || 7)))}
                        className="w-16 text-xs border border-amber-300 rounded px-1.5 py-0.5 bg-white text-center"
                      />
                      <span className="text-[10px] text-amber-600">({numberOfDays} jours)</span>
                    </div>
                  )}
                </div>
              )}

              {action !== 'reference' && (
              <button
                type="submit"
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-semibold border border-indigo-500 shadow-sm transition-all cursor-pointer disabled:bg-indigo-400"
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Génération en cours...</span></>
                ) : (
                  <><Send className="w-4 h-4" /><span>Générer</span></>
                )}
              </button>
              )}
            </form>
          </div>
        </div>

        {/* Right Panel - Output */}
        <div className="lg:col-span-3 font-sans">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 h-full flex flex-col min-h-[450px]">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-4 shrink-0">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{actionConfig.label} généré</span>
              {response && (
                <div className="flex gap-1.5 flex-wrap justify-end">
                  <button onClick={copyToClipboard}
                    className="text-slate-500 hover:text-slate-800 p-1.5 bg-white hover:bg-slate-100 rounded border border-slate-200 transition-all cursor-pointer text-[10px] flex items-center gap-1"
                    title="Copier">
                    <Copy className="w-3 h-3" />
                    {copied ? "Copié" : "Copier"}
                  </button>
                  {action === 'sms' && (
                    <button onClick={() => onNavigate('comms', response)}
                      className="text-emerald-600 hover:text-white p-1.5 bg-white hover:bg-emerald-600 rounded border border-emerald-300 transition-all cursor-pointer text-[10px] flex items-center gap-1"
                      title="Envoyer via Communications">
                      <Send className="w-3 h-3" />
                      Envoyer
                    </button>
                  )}
                  <button onClick={downloadMarkdown}
                    className="text-slate-500 hover:text-slate-800 p-1.5 bg-white hover:bg-slate-100 rounded border border-slate-200 transition-all cursor-pointer text-[10px] flex items-center gap-1"
                    title="Télécharger Markdown">
                    <FileDown className="w-3 h-3" />
                    .md
                  </button>
                  <button onClick={exportWord}
                    className="text-slate-500 hover:text-indigo-700 p-1.5 bg-white hover:bg-indigo-50 rounded border border-slate-200 transition-all cursor-pointer text-[10px] flex items-center gap-1"
                    title="Télécharger en Word">
                    <FileText className="w-3 h-3" />
                    Word
                  </button>
                  <button onClick={exportPDF}
                    className="text-slate-500 hover:text-rose-700 p-1.5 bg-white hover:bg-rose-50 rounded border border-slate-200 transition-all cursor-pointer text-[10px] flex items-center gap-1"
                    title="Télécharger en PDF">
                    <Printer className="w-3 h-3" />
                    PDF
                  </button>
                </div>
              )}
            </div>

            <div ref={responseRef} className="flex-1 overflow-y-auto max-h-[450px] pr-1">
              {action === 'reference' && refResult && (
                <div className="space-y-3">
                  <div className="bg-white border border-indigo-200 rounded-lg p-4">
                    <div className="prose prose-slate prose-xs text-xs max-w-none text-slate-700 leading-relaxed font-sans">
                      <ReactMarkdown>{refResult}</ReactMarkdown>
                    </div>
                  </div>
                  <button onClick={sendRefToIA}
                    className="flex items-center gap-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-indigo-200">
                    <Sparkles className="w-3.5 h-3.5" />
                    Analyser avec l'IA (Étude Biblique)
                  </button>
                </div>
              )}
              {action === 'reference' && !refResult && !refLoading && (
                <div className="text-center py-20 text-slate-400 space-y-2">
                  <Bookmark className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-light">Sélectionnez un livre, chapitre et verset, puis cliquez sur "Chercher".</p>
                </div>
              )}
              {action === 'reference' && refLoading && (
                <div className="text-center py-24 text-slate-500 space-y-3">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                  <p className="text-xs font-semibold animate-pulse text-indigo-600">Recherche du verset...</p>
                </div>
              )}
              {action !== 'reference' && !response && !generating && !(action === 'exhortation' && seriesMode && parsedDays.length > 0) && (
                <div className="text-center py-20 text-slate-400 space-y-2">
                  <Sparkles className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-light">Le résultat apparaîtra ici en temps réel.</p>
                </div>
              )}

              {generating && !response && (
                <div className="text-center py-24 text-slate-500 space-y-3">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                  <p className="text-xs font-semibold animate-pulse text-indigo-600">Génération en cours...</p>
                </div>
              )}

              {response && !(action === 'exhortation' && seriesMode && parsedDays.length > 0) && (
                <div className="prose prose-slate prose-xs text-xs max-w-none text-slate-800 leading-relaxed font-sans">
                  <ReactMarkdown>{response}</ReactMarkdown>
                </div>
              )}

              {action === 'exhortation' && seriesMode && parsedDays.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                      Série de {parsedDays.length} jours
                    </h3>
                    <span className="text-[10px] text-slate-500">Générée le {new Date().toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div className="grid gap-2">
                    {parsedDays.map((day) => (
                      <div key={day.day} className="bg-white border border-amber-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Jour {day.day}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(new Date(seriesStartDate).getTime() + (day.day - 1) * 86400000).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} à {seriesStartTime}
                          </span>
                        </div>
                        <div className="prose prose-slate prose-xs text-xs max-w-none text-slate-700 leading-relaxed font-sans">
                          <ReactMarkdown>{day.text}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-medium text-slate-700">Début</span>
                      </div>
                      <input
                        type="date"
                        value={seriesStartDate}
                        onChange={(e) => setSeriesStartDate(e.target.value)}
                        className="text-xs border border-slate-200 rounded px-2 py-1"
                      />
                      <input
                        type="time"
                        value={seriesStartTime}
                        onChange={(e) => setSeriesStartTime(e.target.value)}
                        className="text-xs border border-slate-200 rounded px-2 py-1"
                      />
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-medium text-slate-700">Cible</span>
                      </div>
                      <select
                        value={scheduleTargetGroup}
                        onChange={(e) => {
                          setScheduleTargetGroup(e.target.value);
                          if (!e.target.value.startsWith('__group__')) setSelectedGroupJid('');
                        }}
                        className="text-xs border border-slate-200 rounded px-2 py-1 bg-white max-w-[180px]"
                      >
                        <optgroup label="Membres">
                          <option value="Tous">Tous les membres</option>
                          <option value="Actif">Membres actifs</option>
                          {[...new Set(members.map(m => m.ministry || 'Non assigné'))].map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </optgroup>
                        {waStatus === 'connected' && waGroups.length > 0 && (
                          <optgroup label="Groupes WhatsApp">
                            {waGroups.map(g => (
                              <option key={g.id} value={`__group__${g.id}`}>{g.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                    <button
                      onClick={handleScheduleSeries}
                      disabled={schedulingSeries}
                      className="w-full flex items-center justify-center gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg font-semibold transition-all cursor-pointer disabled:bg-amber-400"
                    >
                      {schedulingSeries ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Programmation en cours...</>
                      ) : (
                        <><Clock className="w-3.5 h-3.5" /> Programmer la série ({parsedDays.length} jours)</>
                      )}
                    </button>
                    {scheduleResult && (
                      <div className={`text-[10px] font-medium ${scheduleResult.includes('succès') ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {scheduleResult}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const stored = localStorage.getItem('church_enseignements');
                      const existing = stored ? JSON.parse(stored) : [];
                      const newEns = {
                        id: crypto.randomUUID?.() || Date.now().toString(36),
                        title: promptInput,
                        theme: promptInput,
                        days: parsedDays.map(d => ({ day: d.day, title: `Jour ${d.day}`, text: d.text })),
                        type: parsedDays.length > 1 ? 'series' : 'single',
                        dayCount: parsedDays.length,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        status: 'draft',
                      };
                      existing.unshift(newEns);
                      localStorage.setItem('church_enseignements', JSON.stringify(existing));
                      setResponse('');
                      setParsedDays([]);
                      clearSavedSeries();
                      setSavedSeriesInfo('');
                    }}
                    className="w-full flex items-center justify-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg font-semibold transition-all cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> Envoyer vers Enseignement
                  </button>
                </div>
              )}
            </div>

            <div className="text-[9px] text-slate-400 border-t border-slate-200 pt-2 shrink-0 mt-2 italic">
              Généré par Mistral AI. À examiner avec discernement pastoral.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
