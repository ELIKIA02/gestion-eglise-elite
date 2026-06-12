import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { collection, addDoc, db, handleFirestoreError, OperationType } from '../firebase';
import { CommunicationLog, Member, Department, ChurchSettings } from '../types';
import { Send, Users, HelpCircle, Sparkles, Smartphone, Loader2, CheckCircle2, XCircle, QrCode, AlertTriangle, CalendarClock, Trash2, Bold, Italic, Strikethrough, Code, Image, X, Type, ArrowUp, ArrowDown, Pin, PinOff, RefreshCw, Download, FileText } from 'lucide-react';

interface ScheduledMessage {
  id: string;
  title: string;
  text: string;
  targetGroup: string;
  recipientCount: number;
  recipients: { name: string; phone: string }[];
  scheduledAt: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  result?: string;
  createdAt: string;
}

interface CommunicationsModuleProps {
  comms: CommunicationLog[];
  members: Member[];
  departments: Department[];
  settings: ChurchSettings | null;
  loading: boolean;
  onRefresh: () => void;
  presetTarget?: string;
  presetText?: string;
  onConsumePresetText?: () => void;
}

const PRESET_TEMPLATES = [
  {
    id: 'worship-invite',
    title: "Invitation Culte de Dimanche",
    text: "Bonjour cher(e) fidèle, nous vous invitons chaleureusement à notre culte de ce Dimanche à 10h. Thème: Vivre sous la Grâce divine. Venez célébrer en famille !",
    channel: 'WhatsApp'
  },
  {
    id: 'fast-alert',
    title: "Rappel Journée de Jeûne",
    text: "Shalom bien-aimé(e), n'oubliez pas notre rendez-vous d'intercession et de jeûne communautaire ce Mercredi de 06h à 18h. Que Dieu vous bénisse abondamment.",
    channel: 'WhatsApp'
  },
  {
    id: 'tithe-appeal',
    title: "Appel de Solidarité & Dons",
    text: "Chers bien-aimés, l'église lance une campagne pour aider les familles démunies de notre paroisse. Vos dîmes d'amour et offrandes peuvent être transmises au secrétariat.",
    channel: 'SMS'
  },
  {
    id: 'music-practice',
    title: "Répétition de la Chorale",
    text: "Bonjour l'équipe artistique, répétition générale de louange ce Samedi à 15h00 pour préparer les chants du culte. Soyez tous présents et bénis !",
    channel: 'WhatsApp'
  }
];

export default function CommunicationsModule({ comms, members, departments, settings, loading, onRefresh, presetTarget, presetText, onConsumePresetText }: CommunicationsModuleProps) {
  const consumeRef = useRef(onConsumePresetText);
  consumeRef.current = onConsumePresetText;
  const [activeTab, setActiveTab] = useState<'send' | 'history'>('send');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [messageType, setMessageType] = useState<'SMS' | 'WhatsApp'>('WhatsApp');
  const [title, setTitle] = useState('');
  const [textBody, setTextBody] = useState('');
  const [targetGroup, setTargetGroup] = useState(presetTarget || 'Tous');
  const [sending, setSending] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<string | null>(null);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [sendMode, setSendMode] = useState<'members' | 'group'>('members');
  const [whatsappGroups, setWhatsappGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedGroupJid, setSelectedGroupJid] = useState('');
  const [pinnedGroups, setPinnedGroups] = useState<string[]>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);

const [waStatus, setWaStatus] = useState<string>('checking');
const [waQR, setWaQR] = useState<string | null>(null);
const [sentLinks, setSentLinks] = useState<{ name: string; phone: string; url: string }[]>([]);
const [resetting, setResetting] = useState(false);
const [qrVersion, setQrVersion] = useState(0);
const [exportedAuth, setExportedAuth] = useState<string | null>(null);
const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Bump QR version when new QR arrives to force image refresh
  useEffect(() => {
    if (waQR) {
      setQrVersion(v => v + 1);
    }
  }, [waQR]);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/whatsapp/status');
        const data = await res.json();
        setWaStatus(data.status);
        setWaQR(data.qr || null);
      } catch { setWaStatus('unreachable'); }
    };
    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/whatsapp/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setWaStatus('connecting');
        setWaQR(null);
      }
    } catch {}
    setTimeout(() => setResetting(false), 3000);
  };

  const handleExportAuth = async () => {
    try {
      const res = await fetch('/api/whatsapp/export-auth');
      const data = await res.json();
      if (data.success) {
        setExportedAuth(data.data);
      } else {
        alert("Aucune session WhatsApp à exporter. Connectez-vous d'abord.");
      }
    } catch {
      alert("Erreur lors de l'export");
    }
  };

  const copyAuthToClipboard = () => {
    if (exportedAuth) {
      navigator.clipboard.writeText(exportedAuth).then(() => {
        alert("Données copiées ! Ajoutez-les comme WA_AUTH_DATA sur Render.");
      }).catch(() => {
        alert("Copie manuelle : sélectionnez et copiez le texte ci-dessous.");
      });
    }
  };

  useEffect(() => {
    if (waStatus === 'connected') {
      const loadGroups = () => {
        fetch('/api/whatsapp/groups').then(r => r.json()).then(groups => {
          if (Array.isArray(groups)) setWhatsappGroups(groups);
        }).catch(() => {});
      };
      loadGroups();
      const id = setInterval(loadGroups, 5000);
      return () => clearInterval(id);
    } else {
      if (waStatus !== 'checking' && waStatus !== 'connecting') setWhatsappGroups([]);
    }
  }, [waStatus]);

  const refreshGroupList = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/groups/refresh', { method: 'POST' });
      const data = await res.json();
      if (Array.isArray(data)) setWhatsappGroups(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetch('/api/whatsapp/groups/pinned').then(r => r.json()).then(ids => {
      if (Array.isArray(ids)) setPinnedGroups(ids);
    }).catch(() => {});
  }, []);

  const fetchScheduled = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/scheduled');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setScheduledMessages(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchScheduled();
    const id = setInterval(fetchScheduled, 15000);
    return () => clearInterval(id);
  }, [fetchScheduled]);

  useEffect(() => {
    if (presetTarget) setTargetGroup(presetTarget);
  }, [presetTarget]);

  useEffect(() => {
    if (presetText) {
      setTextBody(presetText);
      setActiveTab('send');
      setMessageType('WhatsApp');
      consumeRef.current?.();
    }
  }, [presetText]);

  const deptNames = departments.map(d => d.name);

  const recipients = useMemo(() => {
    return members.filter(m => {
      if (targetGroup === 'Tous') return true;
      if (targetGroup === 'Actif' && m.status === 'Actif') return true;
      if (targetGroup === 'Inactif' && m.status === 'Inactif') return true;
      if (deptNames.includes(targetGroup) && m.ministry === targetGroup) return true;
      return false;
    });
  }, [members, targetGroup, deptNames]);

  const [formPhoneSearch, setFormPhoneSearch] = useState('');
  const [formManualPhone, setFormManualPhone] = useState('');
  const [sendingForm, setSendingForm] = useState(false);

  const filteredFormMembers = useMemo(() => {
    if (!formPhoneSearch.trim()) return [];
    const q = formPhoneSearch.toLowerCase();
    return members.filter(m =>
      m.phone && (m.name.toLowerCase().includes(q) || m.phone.includes(q))
    ).slice(0, 10);
  }, [members, formPhoneSearch]);

  const handleSendForm = async (phone: string) => {
    if (!phone) { alert('Veuillez sélectionner un membre ou entrer un numéro.'); return; }
    if (!settings) { alert('Paramètres de l\'église non disponibles.'); return; }
    if (waStatus !== 'connected') { alert('WhatsApp n\'est pas connecté.'); return; }

    setSendingForm(true);
    try {
      const appName = settings.appName || "ELIKIA EKLESIA";
      const logo = settings.appLogo || '⛪';
      const serverUrl = window.location.origin;

      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">
<title>Fiche de Renseignement — ${appName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9;color:#1e293b;padding:16px;padding-bottom:120px}
  .container{max-width:560px;margin:0 auto}
  .header{text-align:center;margin-bottom:20px}
  .header .logo{font-size:40px}
  .header h1{font-size:18px;font-weight:800;margin-top:4px}
  .header p{font-size:12px;color:#64748b;margin-top:2px}
  .section{background:#fff;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .section h2{font-size:13px;font-weight:700;color:#4f46e5;margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px}
  .field{margin-bottom:12px}
  .field:last-child{margin-bottom:0}
  .field label{display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:3px}
  .field input,.field select,.field textarea{width:100%;padding:10px 12px;font-size:14px;border:1.5px solid #e2e8f0;border-radius:8px;background:#fff;color:#1e293b;outline:none;transition:border-color .2s;-webkit-appearance:none}
  .field input:focus,.field select:focus,.field textarea:focus{border-color:#4f46e5}
  .field textarea{resize:vertical;min-height:70px;font-family:inherit}
  .field .radio-group{display:flex;gap:12px;padding-top:4px}
  .field .radio-group label{font-size:14px;font-weight:400;display:flex;align-items:center;gap:6px;cursor:pointer}
  .field .checkbox-group{display:flex;flex-wrap:wrap;gap:8px}
  .actions{position:fixed;bottom:0;left:0;right:0;padding:12px 16px;background:#fff;border-top:1px solid #e2e8f0;display:flex;gap:8px;box-shadow:0 -2px 10px rgba(0,0,0,.05);z-index:100}
  .actions button{flex:1;padding:14px;font-size:15px;font-weight:700;border:none;border-radius:10px;cursor:pointer;transition:opacity .2s}
  .actions button:active{opacity:.8}
  .btn-send{background:#4f46e5;color:#fff}
  .btn-download{background:#e2e8f0;color:#475569}
  .toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#059669;color:#fff;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:200;display:none;text-align:center;max-width:90%}
  .toast.error{background:#dc2626}
  .spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:6px}
  @keyframes spin{to{transform:rotate(360deg)}}
  select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">${logo.startsWith('data:') ? `<img src="${logo}" style="width:48px;height:48px;border-radius:50%;object-fit:cover">` : logo}</div>
    <h1>${appName}</h1>
    <p>Fiche de Renseignement — Nouveau Membre</p>
  </div>
  <div class="section"><h2>État Civil</h2>
    <div class="field"><label>Nom & Prénoms *</label><input type="text" id="name" placeholder="Ex: Jean-Baptiste Ngoma" required></div>
    <div class="field" style="display:flex;gap:10px">
      <div style="flex:1"><label>Date de Naissance</label><input type="date" id="birthday"></div>
      <div style="flex:1"><label>Lieu de Naissance</label><input type="text" id="birthPlace" placeholder="Ville, Pays"></div>
    </div>
    <div class="field" style="display:flex;gap:10px">
      <div style="flex:1"><label>Nationalité</label><input type="text" id="nationality" placeholder="Congolaise"></div>
      <div style="flex:1"><label>Sexe</label>
        <div class="radio-group"><label><input type="radio" name="gender" value="M"> M</label><label><input type="radio" name="gender" value="F"> F</label></div>
      </div>
    </div>
    <div class="field"><label>Situation Matrimoniale</label>
      <select id="maritalStatus"><option value="">Sélectionnez...</option><option>Célibataire</option><option>Marié(e)</option><option>Divorcé(e)</option><option>Veuf(ve)</option></select>
    </div>
    <div class="field" style="display:flex;gap:10px">
      <div style="flex:1"><label>Profession</label><input type="text" id="profession" placeholder="Métier"></div>
      <div style="flex:1"><label>Téléphone</label><input type="tel" id="phone" placeholder="+242 XX XXX XXXX"></div>
    </div>
    <div class="field" style="display:flex;gap:10px">
      <div style="flex:1"><label>Email</label><input type="email" id="email" placeholder="exemple@email.com"></div>
      <div style="flex:1"><label>Adresse</label><input type="text" id="address" placeholder="Quartier, Ville"></div>
    </div>
  </div>
  <div class="section"><h2>Vie Spirituelle</h2>
    <div class="field" style="display:flex;gap:10px">
      <div style="flex:1"><label>Date de Conversion</label><input type="date" id="conversionDate"></div>
      <div style="flex:1"><label>Ancienne Église</label><input type="text" id="formerChurch" placeholder="Nom de l'église"></div>
    </div>
    <div class="field" style="display:flex;gap:10px">
      <div style="flex:1"><label>Date d'Arrivée</label><input type="date" id="arrivalDate"></div>
      <div style="flex:1"><label>Baptisé</label>
        <select id="baptized"><option value="">Sélectionnez...</option><option>Oui</option><option>Non</option></select>
      </div>
    </div>
    <div class="field"><label>Date de Baptême</label><input type="date" id="baptismDate"></div>
  </div>
  <div class="section"><h2>Engagement</h2>
    <div class="field"><label>Talents / Dons</label><textarea id="talents" placeholder="Chant, enseignement, intercession, etc."></textarea></div>
    <div class="field"><label>Motivation</label><textarea id="motivation" placeholder="Pourquoi souhaitez-vous vous engager ?"></textarea></div>
  </div>
  <div class="section"><h2>Famille</h2>
    <div class="field" style="display:flex;gap:10px">
      <div style="flex:1"><label>Conjoint(e)</label><input type="text" id="spouseName" placeholder="Nom complet"></div>
      <div style="flex:1"><label>Enfants</label><input type="text" id="childrenCount" placeholder="Ex: 3"></div>
    </div>
    <div class="field"><label>Âges des Enfants</label><input type="text" id="childrenAges" placeholder="Ex: 5, 8, 12 ans"></div>
  </div>
  <div class="section"><h2>Contact d'Urgence</h2>
    <div class="field" style="display:flex;gap:10px">
      <div style="flex:1"><label>Téléphone</label><input type="tel" id="emergencyPhone" placeholder="+242 XX XXX XXXX"></div>
      <div style="flex:1"><label>Nom</label><input type="text" id="emergencyContact" placeholder="Mère, père, etc."></div>
    </div>
  </div>
  <div style="height:80px"></div>
</div>
<div class="actions">
  <button class="btn-download" onclick="downloadJSON()">📥 Télécharger</button>
  <button class="btn-send" onclick="submitForm()" id="sendBtn">📤 Envoyer à l'Église</button>
</div>
<div id="toast" class="toast"></div>
<script>
function g(id){return document.getElementById(id)}
function val(id){const e=g(id);return e?e.value:''}
function radioVal(name){const e=document.querySelector('input[name="'+name+'"]:checked');return e?e.value:''}
function showToast(msg,e){const t=g('toast');t.textContent=msg;t.className='toast'+(e?' error':'');t.style.display='block';setTimeout(()=>{t.style.display='none'},4000)}
function getData(){return{
  name:val('name'),email:val('email'),phone:val('phone'),
  birthday:val('birthday'),birthPlace:val('birthPlace'),
  nationality:val('nationality'),gender:radioVal('gender'),
  maritalStatus:val('maritalStatus'),profession:val('profession'),
  address:val('address'),conversionDate:val('conversionDate'),
  formerChurch:val('formerChurch'),arrivalDate:val('arrivalDate'),
  baptized:val('baptized'),baptismDate:val('baptismDate'),
  talents:val('talents'),motivation:val('motivation'),
  spouseName:val('spouseName'),childrenCount:val('childrenCount'),
  childrenAges:val('childrenAges'),emergencyPhone:val('emergencyPhone'),
  emergencyContact:val('emergencyContact')
}}
function downloadJSON(){const d=getData();if(!d.name.trim()){showToast('Veuillez remplir le nom',true);return}
  const b=new Blob([JSON.stringify({data:d},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='fiche-renseignement-'+Date.now()+'.json';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
  showToast('✅ Fichier téléchargé !')}
async function submitForm(){const d=getData();if(!d.name.trim()){showToast('Veuillez remplir le nom',true);return}
  const btn=g('sendBtn');btn.innerHTML='<span class="spinner"></span> Envoi...';btn.disabled=true;
  try{const r=await fetch('${serverUrl}/api/renseignement/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:d})});
    const j=await r.json();if(j.success){showToast('✅ Envoyé avec succès !');downloadJSON()}else{showToast('❌ '+(j.error||'Erreur'),true)}
  }catch(e){showToast('❌ Problème de connexion',true)}
  btn.innerHTML='📤 Envoyer à l\'Église';btn.disabled=false}
<\/script>
</body>
</html>`;

      const res = await fetch('/api/renseignement/send-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, htmlContent: html }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Formulaire envoyé avec succès à ${phone}`);
      } else {
        alert(`❌ ${data.error || 'Erreur lors de l\'envoi'}`);
      }
    } catch (err: any) {
      alert(`❌ Erreur : ${err.message}`);
    }
    setSendingForm(false);
  };

  const sanitizeForWhatsApp = (t: string) => {
    return t
      .replace(/^###\s(.+)$/gm, '_$1_')
      .replace(/^##\s(.+)$/gm, '_$1_')
      .replace(/^#\s(.+)$/gm, '*$1*')
      .replace(/\*\*(.+?)\*\*/g, '*$1*')
      .replace(/^-\s(.+)$/gm, '• $1')
      .replace(/^>\s(.+)$/gm, '_$1_')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .trim();
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const template = PRESET_TEMPLATES.find(p => p.id === templateId);
    if (template) {
      setTitle(template.title);
      setTextBody(template.text);
      setMessageType(template.channel as any);
      if (templateId === 'music-practice') setTargetGroup('Musique & Louange');
      else setTargetGroup('Tous');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !textBody.trim()) { alert("Veuillez remplir le titre et le contenu."); return; }
    if (recipients.length === 0) { alert("Aucun destinataire."); return; }

    const finalText = messageType === 'WhatsApp' ? sanitizeForWhatsApp(textBody) : textBody.trim();
    const phones = recipients.map(m => ({ name: m.name, phone: m.phone || '' })).filter(m => m.phone);

    if (sendMode !== 'group' && phones.length === 0) { setDispatchResult("Aucun numéro de téléphone trouvé."); return; }

    // Schedule mode
    if (scheduleMode) {
      if (!scheduledAt) { alert("Veuillez choisir la date et l'heure de programmation."); return; }
      if (sendMode === 'group' && !selectedGroupJid) { alert("Veuillez sélectionner un groupe WhatsApp."); return; }
      setSending(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        const body: any = {
          title: title.trim(), text: finalText, targetGroup,
          recipients: sendMode === 'members' ? phones : [],
          scheduledAt: new Date(scheduledAt).toISOString(),
        };
        if (imageBase64) body.imageBase64 = imageBase64;
        if (sendMode === 'group') body.groupJid = selectedGroupJid;
        const res = await fetch('/api/whatsapp/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (data.success) {
          setDispatchResult(`✅ Message programmé pour le ${new Date(scheduledAt).toLocaleString('fr')}`);
          setTitle(''); setTextBody(''); setSelectedTemplateId('');
          clearImage();
          fetchScheduled();
        } else {
          setDispatchResult(`❌ ${data.error}`);
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          setDispatchResult("❌ La programmation a pris trop de temps. Vérifiez que le serveur est en ligne.");
        } else {
          setDispatchResult(`❌ Erreur: ${err.message}`);
        }
      } finally {
        setSending(false);
      }
      return;
    }

    setSending(true);
    setDispatchResult(null);
    setSentLinks([]);

    let resultMsg = '';
    try {
      if (sendMode === 'group') {
        try {
          const body: any = { groupJid: selectedGroupJid, text: finalText };
          if (imageBase64) body.imageBase64 = imageBase64;
          const res = await fetch('/api/whatsapp/send-group', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
          });
          const data = await res.json();
          resultMsg = data.success ? '✅ Message envoyé au groupe WhatsApp.' : `❌ ${data.error}`;
        } catch (err: any) { resultMsg = `❌ ${err.message}`; }
      } else if (messageType === 'WhatsApp' && waStatus === 'connected') {
        try {
          const endpoint = imageBase64 ? '/api/whatsapp/send-bulk-image' : '/api/whatsapp/send-bulk';
          const body: any = { recipients: phones, text: finalText };
          if (imageBase64) body.imageBase64 = imageBase64;
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          const data = await res.json();
          if (data.success) {
            resultMsg = `✅ ${data.success}/${data.total} messages envoyés.${data.failed > 0 ? ` ⚠️ ${data.failed} échecs.` : ''}`;
          } else {
            resultMsg = `❌ ${data.error}`;
          }
        } catch (err: any) {
          resultMsg = `❌ Erreur d'envoi: ${err.message}`;
        }
      } else {
        const links = phones.map(m => ({
          ...m,
          url: messageType === 'WhatsApp'
            ? `https://wa.me/${m.phone.replace(/[^0-9+]/g, '')}?text=${encodeURIComponent(finalText)}`
            : `sms:${m.phone.replace(/[^0-9+]/g, '')}?body=${encodeURIComponent(finalText)}`
        }));
        resultMsg = `📋 ${phones.length} lien(s) généré(s) — cliquez pour envoyer.`;
        setSentLinks(links);
      }

      await addDoc(collection(db, 'church_communications'), {
        type: messageType, title, template: finalText, sentToGroup: targetGroup,
        sentAt: new Date().toISOString(), recipientCount: phones.length,
        status: messageType === 'WhatsApp' && waStatus === 'connected'
          ? (resultMsg.includes('✅') ? (resultMsg.includes('⚠️') ? 'Partiel' : 'Envoyé') : 'Échec')
          : 'Liens générés'
      });

      setDispatchResult(resultMsg);
      setTitle(''); setTextBody(''); setSelectedTemplateId('');
      clearImage();
      onRefresh();
    } catch (err: any) {
      setDispatchResult(`❌ Erreur: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleCancelScheduled = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/whatsapp/scheduled/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchScheduled();
      }
    } catch (err) {
      console.error('[CancelScheduled]', err);
    }
  }, [fetchScheduled]);

  const togglePinGroup = async (groupId: string) => {
    const isPinned = pinnedGroups.includes(groupId);
    try {
      const res = await fetch(`/api/whatsapp/groups/${isPinned ? 'unpin' : 'pin'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId })
      });
      if (res.ok) {
        const data = await res.json();
        setPinnedGroups(data.pinned);
      }
    } catch {}
  };

  const sortedGroups = useMemo(() => {
    const pinned = whatsappGroups.filter(g => pinnedGroups.includes(g.id));
    const rest = whatsappGroups.filter(g => !pinnedGroups.includes(g.id));
    return [...pinned, ...rest];
  }, [whatsappGroups, pinnedGroups]);

  const formatText = (before: string, after: string) => {
    const ta = textRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = textBody.substring(start, end);
    const newText = textBody.substring(0, start) + before + selected + after + textBody.substring(end);
    setTextBody(newText);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImageBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageBase64(null);
    setImageFile(null);
  };

  const transformSelection = (transform: (text: string) => string) => {
    const ta = textRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return;
    const selected = textBody.substring(start, end);
    const transformed = transform(selected);
    setTextBody(textBody.substring(0, start) + transformed + textBody.substring(end));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, start + transformed.length);
    });
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case 'connected': return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'connecting': return <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />;
      default: return <AlertTriangle className="w-4 h-4 text-red-600" />;
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'connected': return 'WhatsApp connecté ✓ — envoi automatique disponible';
      case 'connecting': return 'Connexion WhatsApp en cours...';
      case 'checking': return 'Vérification...';
      case 'unreachable': return 'Serveur indisponible';
      default: return 'WhatsApp déconnecté — scannez le QR';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center border-b border-slate-205 pb-3">
        <div>
          <h2 className="text-xl text-slate-800 font-bold tracking-tight">Messagerie & Envois Massifs</h2>
          <p className="text-xs text-slate-500 font-light">Envoyez automatiquement via WhatsApp (Baileys) ou générez des liens.</p>
        </div>
      </div>

      <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
        waStatus === 'connected' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
        waStatus === 'connecting' ? 'bg-amber-50 border-amber-200 text-amber-800' :
        'bg-red-50 border-red-200 text-red-800'
      }`}>
        {statusIcon(waStatus)}
        <span className="font-medium flex-1">{statusLabel(waStatus)}</span>
        {waStatus === 'connected' ? (
          <button onClick={handleExportAuth}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/70 hover:bg-white border border-emerald-300 text-emerald-800 font-semibold text-[10px] cursor-pointer">
            <Download className="w-3 h-3" />
            Exporter session
          </button>
        ) : (
          <button onClick={handleReset} disabled={resetting}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/70 hover:bg-white border border-current text-current font-semibold text-[10px] disabled:opacity-50 cursor-pointer">
            <Loader2 className={`w-3 h-3 ${resetting ? 'animate-spin' : ''}`} />
            {resetting ? 'Réinitialisation...' : 'Réinitialiser'}
          </button>
        )}
      </div>

      {waQR && (
        <div className="bg-white rounded-xl border border-amber-200 p-5 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
            <QrCode className="w-5 h-5" /> Scannez ce QR code avec WhatsApp
          </div>
          <img key={qrVersion} src={`/api/whatsapp/qr-image?t=${Date.now()}`} alt="QR Code WhatsApp" onError={() => {}} className="border-2 border-slate-100 rounded-lg" />
          <p className="text-[10px] text-slate-400">WhatsApp → Paramètres → Appareils connectés → Connecter un appareil</p>
          <details className="w-full">
            <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-600 text-center">QR pas visible ? Voir dans les logs Render</summary>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              Ouvrez les <strong>Logs</strong> de votre service Render, cherchez <code className="bg-slate-100 px-1 rounded">[WA] QR code generated</code>.<br />
              Le QR apparaît aussi en ASCII dans les logs (scannez-le directement depuis le terminal).
            </p>
          </details>
        </div>
      )}

      {exportedAuth && (
        <div className="bg-white rounded-xl border border-emerald-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
              <Download className="w-5 h-5" /> Session WhatsApp exportée
            </div>
            <button onClick={() => setExportedAuth(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-600">
            Copiez cette chaîne et ajoutez-la comme variable d'environnement <strong>WA_AUTH_DATA</strong> sur Render.
            Après redéploiement, WhatsApp sera automatiquement connecté.
          </p>
          <textarea readOnly value={exportedAuth} rows={4}
            className="w-full text-[10px] p-2 border border-slate-200 rounded-md bg-slate-50 font-mono break-all" />
          <button onClick={copyAuthToClipboard}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer">
            Copier dans le presse-papier
          </button>
        </div>
      )}

      {dispatchResult && (
        <div className={`p-3 rounded-xl text-xs ${dispatchResult.includes('✅') ? 'bg-emerald-50 border border-emerald-250 text-emerald-900' : dispatchResult.includes('❌') ? 'bg-red-50 border border-red-250 text-red-900' : 'bg-blue-50 border border-blue-250 text-blue-900'}`}>
          {dispatchResult}
        </div>
      )}

      {/* WhatsApp Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <Send className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total Envoyés</span>
          </div>
          <span className="text-lg font-bold text-slate-800">{comms.length}</span>
          <span className="text-[10px] text-slate-400 ml-1">campagnes</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Réussite</span>
          </div>
          <span className="text-lg font-bold text-emerald-700">
            {comms.length > 0 ? Math.round((comms.filter(c => c.status === 'Envoyé').length / comms.length) * 100) : 0}%
          </span>
          <span className="text-[10px] text-slate-400 ml-1">taux</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Échecs</span>
          </div>
          <span className="text-lg font-bold text-red-600">{comms.filter(c => c.status === 'Échec').length}</span>
          <span className="text-[10px] text-slate-400 ml-1">campagnes</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Touchés</span>
          </div>
          <span className="text-lg font-bold text-slate-800">{comms.reduce((s, c) => s + (c.recipientCount || 0), 0)}</span>
          <span className="text-[10px] text-slate-400 ml-1">personnes</span>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200 text-sm font-medium">
        <button onClick={() => setActiveTab('send')}
          className={`pb-2 px-1 cursor-pointer ${activeTab === 'send' ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold' : 'text-slate-400 hover:text-slate-600'}`}>
          Nouvelle Campagne
        </button>
        <button onClick={() => setActiveTab('history')}
          className={`pb-2 px-1 cursor-pointer ${activeTab === 'history' ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold' : 'text-slate-400 hover:text-slate-600'}`}>
          Historique ({comms.length})
        </button>
      </div>

      {activeTab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleSend} className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">Paramètres de la campagne</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">Canal</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setMessageType('WhatsApp')}
                    className={`flex-1 text-xs py-2 px-3 border rounded-md font-semibold ${messageType === 'WhatsApp' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}>
                    🟢 WhatsApp
                  </button>
                  <button type="button" onClick={() => setMessageType('SMS')}
                    className={`flex-1 text-xs py-2 px-3 border rounded-md font-semibold ${messageType === 'SMS' ? 'bg-blue-50 text-blue-800 border-blue-300' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}>
                    🔵 SMS
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">Destinataires</label>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => setSendMode('members')}
                    className={`flex-1 text-xs py-1.5 px-3 border rounded-md font-semibold ${sendMode === 'members' ? 'bg-indigo-50 text-indigo-800 border-indigo-300' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}>
                    Membres
                  </button>
                  <button type="button" onClick={() => setSendMode('group')}
                    className={`flex-1 text-xs py-1.5 px-3 border rounded-md font-semibold ${sendMode === 'group' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}>
                    Groupe WhatsApp
                  </button>
                </div>
                {sendMode === 'members' ? (
                  <select value={targetGroup} onChange={e => setTargetGroup(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-200 rounded-md bg-white focus:outline-indigo-600">
                    <option value="Tous">Tous ({members.length})</option>
                    <option value="Actif">Actifs ({members.filter(m=>m.status==='Actif').length})</option>
                    <option value="Inactif">Inactifs ({members.filter(m=>m.status==='Inactif').length})</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.name}>{d.name} ({members.filter(m => m.ministry === d.name).length})</option>
                    ))}
                  </select>
                ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        {pinnedGroups.length > 0 && pinnedGroups.map(id => {
                          const g = whatsappGroups.find(x => x.id === id);
                          if (!g) return null;
                          return (
                            <button key={id} type="button" onClick={() => setSelectedGroupJid(id)}
                              className={`text-[10px] px-2 py-1 rounded-full border font-medium cursor-pointer flex items-center gap-1 ${selectedGroupJid === id ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                              <Pin className="w-3 h-3" />{g.name}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-1">
                        <select value={selectedGroupJid} onChange={e => setSelectedGroupJid(e.target.value)}
                          className="flex-1 text-xs p-2 border border-slate-200 rounded-md bg-white focus:outline-indigo-600">
                          <option value="">Sélectionnez un groupe</option>
                          {sortedGroups.map(g => (
                            <option key={g.id} value={g.id}>{pinnedGroups.includes(g.id) ? '📌 ' : ''}{g.name}</option>
                          ))}
                          {sortedGroups.length === 0 && waStatus === 'connected' && <option disabled>Aucun groupe trouvé</option>}
                          {waStatus !== 'connected' && <option disabled>Connectez WhatsApp pour voir les groupes</option>}
                        </select>
                        {selectedGroupJid && (
                          <button type="button" onClick={() => togglePinGroup(selectedGroupJid)}
                            className="p-2 border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer" title={pinnedGroups.includes(selectedGroupJid) ? 'Détacher' : 'Épingler'}>
                            {pinnedGroups.includes(selectedGroupJid) ? <PinOff className="w-3.5 h-3.5 text-amber-600" /> : <Pin className="w-3.5 h-3.5 text-slate-400" />}
                          </button>
                        )}
                        <button type="button" onClick={refreshGroupList} title="Rafraîchir la liste des groupes"
                          className="p-2 border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer">
                          <Loader2 className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
                      {whatsappGroups.length === 0 && waStatus === 'connected' && (
                        <p className="text-[10px] text-amber-600">Aucun groupe trouvé. Vérifie que ton compte WhatsApp est membre d'au moins un groupe.</p>
                      )}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 block">Modèle</label>
              <select value={selectedTemplateId} onChange={e => handleSelectTemplate(e.target.value)}
                className="w-full text-xs p-2 border border-slate-200 rounded-md bg-white focus:outline-indigo-600">
                <option value="">Sélectionnez ou écrivez</option>
                {PRESET_TEMPLATES.map(p => <option key={p.id} value={p.id}>[{p.channel}] {p.title}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 block">Titre *</label>
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Rappel culte" className="w-full text-xs p-2 border border-slate-200 rounded-md focus:outline-indigo-600" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-600 block">Message *</label>
                <span className="text-[10px] text-slate-400">{textBody.length} car.</span>
              </div>
              <div className="flex gap-1 pb-1">
                <button type="button" onClick={() => formatText('*', '*')} title="Gras"
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Bold className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => formatText('_', '_')} title="Italique"
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Italic className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => formatText('*_', '_*')} title="Gras-italique"
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Type className="w-3.5 h-3.5" /></button>
                <span className="w-px bg-slate-200 mx-0.5" />
                <button type="button" onClick={() => transformSelection(t => t.toUpperCase())} title="Majuscule"
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer font-bold text-[10px] leading-none px-2">A<ArrowUp className="w-3 h-3 inline" /></button>
                <button type="button" onClick={() => transformSelection(t => t.toLowerCase())} title="Minuscule"
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer text-[10px] leading-none px-2">a<ArrowDown className="w-3 h-3 inline" /></button>
                <button type="button" onClick={() => transformSelection(t => `*${t.toUpperCase()}*`)} title="Majuscule gras"
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer font-bold text-[10px] leading-none px-2"><Bold className="w-3 h-3 inline" />A<ArrowUp className="w-3 h-3 inline" /></button>
                <span className="w-px bg-slate-200 mx-0.5" />
                <button type="button" onClick={() => formatText('~', '~')} title="Barré"
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Strikethrough className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => formatText('```', '```')} title="Monospace"
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Code className="w-3.5 h-3.5" /></button>
                <div className="flex-1" />
                {messageType === 'WhatsApp' && (
                  <label className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer" title="Ajouter une image">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <Image className="w-3.5 h-3.5" />
                  </label>
                )}
              </div>
              <textarea ref={textRef} required value={textBody} onChange={e => setTextBody(e.target.value)}
                rows={5} placeholder="Écrivez le message..."
                className="w-full text-xs p-2 border border-slate-200 rounded-md focus:outline-indigo-600" />
              {imageBase64 && (
                <div className="relative inline-block mt-2">
                  <img src={imageBase64} alt="Aperçu" className="max-h-32 rounded-lg border border-slate-200" />
                  <button type="button" onClick={clearImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 cursor-pointer shadow">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 text-[11px] text-slate-600 space-y-1.5">
              <div className="flex items-center justify-between">
                {sendMode === 'members' ? (
                  <div className="flex items-center gap-2"><Users className="w-4 h-4 text-indigo-600" /><strong>{recipients.length}</strong> destinataire(s)</div>
                ) : (
                  <div className="flex items-center gap-2"><Users className="w-4 h-4 text-emerald-600" /><strong>1 groupe WhatsApp</strong></div>
                )}
                {messageType === 'WhatsApp' && waStatus === 'connected'
                  ? <span className="text-emerald-600 font-semibold text-[10px]">Envoi auto ✓</span>
                  : <span className="text-amber-600 font-semibold text-[10px]">Liens manuels</span>}
              </div>
            </div>
            <button type="submit" disabled={sending}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-60 cursor-pointer">
              {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> {scheduleMode ? 'Programmation...' : 'Envoi...'}</> : <><Send className="w-4 h-4" /> {scheduleMode ? 'Programmer' : sendMode === 'group' ? 'Envoyer au groupe' : messageType === 'WhatsApp' && waStatus === 'connected' ? 'Envoyer automatiquement' : 'Générer les liens'}</>}
            </button>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={scheduleMode} onChange={e => setScheduleMode(e.target.checked)} className="accent-indigo-600" />
              Programmer l'envoi
            </label>
            {scheduleMode && (
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                className="w-full text-xs p-2 border border-slate-200 rounded-md focus:outline-indigo-600" />
            )}
          </form>

          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
              <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wide">Contacts</h4>
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1 border-t border-slate-100 pt-2 text-xs">
                {sendMode === 'group' ? (
                  <span className="text-[10px] text-slate-400 block italic">Envoi vers un groupe WhatsApp.</span>
                ) : recipients.length === 0 ? (
                  <span className="text-[10px] text-slate-400 block italic">Aucun.</span>
                ) : recipients.map(m => (
                  <div key={m.id} className="bg-white p-2 rounded border border-slate-150 flex justify-between items-center">
                    <div><span className="font-semibold text-slate-800 block text-xs">{m.name}</span><span className="text-[9px] text-slate-400">{m.phone || "Sans numéro"}</span></div>
                    <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{m.status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-150 p-4 rounded-xl text-xs space-y-2">
              <h4 className="font-bold text-amber-800 flex items-center gap-1.5"><HelpCircle className="w-4 h-4" /> Mode d'emploi</h4>
              <ul className="text-[11px] text-amber-900 space-y-1 list-disc list-inside">
                <li>WhatsApp connecté → envoi automatique</li>
                <li>QR code → scannez avec WhatsApp</li>
                <li>SMS / non connecté → liens à cliquer</li>
                <li>Case "Programmer" → date/heure différée</li>
                <li>Bouton "Groupe WhatsApp" → envoi direct au groupe</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {sentLinks.length > 0 && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-xs overflow-hidden">
          <div className="bg-blue-50 px-5 py-3 border-b border-blue-100"><h3 className="font-bold text-sm text-blue-900">Liens d'envoi</h3></div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {sentLinks.map((link, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 text-xs">
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-slate-800 block truncate">{link.name}</span>
                  <span className="text-[10px] text-slate-400">{link.phone}</span>
                </div>
                <a href={link.url} target="_blank" rel="noopener noreferrer"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold ml-2 shrink-0">Ouvrir</a>
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(scheduledMessages) && scheduledMessages.filter(m => m && (m.status === 'pending' || m.status === 'sending')).length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-xs overflow-hidden">
          <div className="bg-amber-50 px-5 py-3 border-b border-amber-100 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-amber-700" />
            <h3 className="font-bold text-sm text-amber-900">Messages programmés</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {scheduledMessages.filter(m => m && (m.status === 'pending' || m.status === 'sending')).map(msg => (
              <div key={msg.id} className="flex items-center justify-between px-5 py-3 text-xs">
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-slate-800 block truncate">{msg.title}</span>
                  <span className="text-[10px] text-slate-400">
                    {msg.scheduledAt ? new Date(msg.scheduledAt).toLocaleString('fr') : ''} • {msg.recipientCount || 0} destinataire(s)
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {msg.status === 'sending' && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />}
                  <button onClick={() => handleCancelScheduled(msg.id)}
                    className="text-red-500 hover:text-red-700 p-1 cursor-pointer" title="Annuler">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Envoyer Formulaire Renseignement */}
      <div className="bg-white rounded-xl border border-orange-200 shadow-xs overflow-hidden">
        <div className="bg-orange-50 px-5 py-3 border-b border-orange-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-orange-900 flex items-center gap-2"><FileText className="w-4 h-4" /> Envoyer Formulaire Renseignement</h3>
          <span className="text-[10px] text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full font-semibold">Nouveau</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 block">Rechercher un membre</label>
            <input type="text" value={formPhoneSearch} onChange={e => setFormPhoneSearch(e.target.value)}
              placeholder="Nom ou téléphone..."
              className="w-full text-xs p-2 border border-slate-200 rounded-md bg-white focus:outline-orange-600" />
            {filteredFormMembers.length > 0 && (
              <div className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-48 overflow-y-auto mt-1">
                {filteredFormMembers.map(m => (
                  <button key={m.id} type="button" onClick={() => { setFormManualPhone(m.phone || ''); setFormPhoneSearch(''); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-orange-50 text-left cursor-pointer">
                    <span className="font-medium text-slate-800">{m.name}</span>
                    <span className="text-[10px] text-slate-400">{m.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400"><span className="flex-1 h-px bg-slate-200"></span>OU<span className="flex-1 h-px bg-slate-200"></span></div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 block">Numéro WhatsApp manuellement</label>
            <input type="tel" value={formManualPhone} onChange={e => setFormManualPhone(e.target.value)}
              placeholder="+242 XX XXX XXXX"
              className="w-full text-xs p-2 border border-slate-200 rounded-md bg-white focus:outline-orange-600" />
          </div>
          <button onClick={() => handleSendForm(formManualPhone)} disabled={sendingForm || !formManualPhone || waStatus !== 'connected'}
            className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 cursor-pointer transition-all">
            {sendingForm ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours...</> : <><Send className="w-4 h-4" /> Envoyer le formulaire par WhatsApp</>}
          </button>
          {waStatus !== 'connected' && (
            <p className="text-[10px] text-amber-600 text-center">WhatsApp doit être connecté pour envoyer le formulaire.</p>
          )}
        </div>
      </div>

      {activeTab === 'history' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-800 text-sm">Historique des envois</h3>
          {loading ? <div className="text-slate-500 text-xs py-8 text-center">Chargement...</div> : comms.length === 0 ? (
            <div className="bg-white text-center py-12 rounded-xl border border-slate-200 text-slate-400 text-xs">Aucun envoi.</div>
          ) : (
            <div className="space-y-3">
              {[...comms].sort((a,b) => b.sentAt.localeCompare(a.sentAt)).map(c => (
                <div key={c.id} className="bg-white p-4 rounded-xl border border-slate-200 text-xs space-y-2 shadow-xs">
                  <div className="flex justify-between items-start">
                    <div><span className="font-bold text-slate-900 block">{c.title}</span><span className="text-[10px] text-slate-400">{c.type} • {new Date(c.sentAt).toLocaleString('fr')}</span></div>
                    <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${c.status === 'Envoyé' ? 'bg-emerald-50 text-emerald-750' : c.status === 'Partiel' ? 'bg-amber-50 text-amber-750' : 'bg-slate-50 text-slate-500'}`}>{c.status}</span>
                  </div>
                  <p className="bg-slate-50 p-2 rounded text-[11px] italic">"{c.template}"</p>
                  <div className="text-[10px] text-slate-500"><Users className="w-3 h-3 inline mr-1" />{c.recipientCount || 0} — {c.sentToGroup}</div>
                </div>
              ))}
            </div>
          )}

          {scheduledMessages.filter(m => m.status === 'sent' || m.status === 'failed').length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-800 text-sm mt-6 mb-3">Programmations exécutées</h3>
              <div className="space-y-3">
                {scheduledMessages.filter(m => m.status === 'sent' || m.status === 'failed').map(msg => (
                  <div key={msg.id} className="bg-white p-4 rounded-xl border border-slate-200 text-xs space-y-2 shadow-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-slate-900 block">{msg.title}</span>
                        <span className="text-[10px] text-slate-400">Programmé • {new Date(msg.scheduledAt).toLocaleString('fr')}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${msg.status === 'sent' ? 'bg-emerald-50 text-emerald-750' : 'bg-red-50 text-red-700'}`}>
                        {msg.status === 'sent' ? 'Envoyé' : 'Échec'}
                      </span>
                    </div>
                    {msg.result && <p className="text-[11px] text-slate-600">{msg.result}</p>}
                    <div className="text-[10px] text-slate-500"><Users className="w-3 h-3 inline mr-1" />{msg.recipientCount} destinataire(s)</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
