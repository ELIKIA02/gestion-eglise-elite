import React, { useState, useRef, useEffect } from 'react';
import { FileText, Printer, Download, FileDown, X, Plus, Trash2, MoveUp, MoveDown, Palette } from 'lucide-react';
import { ChurchSettings, Member } from '../types';

type DocType = 'certificat' | 'recu' | 'attestation' | 'devis' | 'fiche';
type Template = 'classique' | 'moderne' | 'elegant';
type FicheType = 'membre' | 'finance' | 'culte' | 'communication' | 'enseignement' | 'liturgique' | 'departement' | 'presence' | 'hebdomadaire' | 'renseignement';

interface DocConfig {
  id: DocType;
  label: string;
  icon: string;
  desc: string;
  fields: { key: string; label: string; type: 'text' | 'textarea' | 'number' | 'select' | 'date'; options?: string[] }[];
}

const DOC_TYPES: DocConfig[] = [
  { id: 'certificat', label: 'Certificat', icon: '📜', desc: 'Certificat de membre, baptême, mariage...', fields: [
    { key: 'type', label: 'Type de certificat', type: 'select', options: ['Membre', 'Baptême', 'Mariage', 'Recommandation', 'Service'] },
    { key: 'nom', label: 'Nom du bénéficiaire', type: 'text' },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'lieu', label: 'Lieu', type: 'text' },
    { key: 'texte', label: 'Texte personnalisé', type: 'textarea' },
  ]},
  { id: 'recu', label: 'Reçu de Dîme', icon: '💰', desc: 'Reçu de dîme, offrande ou don', fields: [
    { key: 'donateur', label: 'Nom du donateur', type: 'text' },
    { key: 'montant', label: 'Montant (FCFA)', type: 'number' },
    { key: 'type', label: 'Type', type: 'select', options: ['Dîme', 'Offrande', 'Action de grâce', 'Don', 'Construction'] },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'mois', label: 'Mois concerné', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ]},
  { id: 'attestation', label: 'Attestation', icon: '📋', desc: 'Attestation de présence, service, stage...', fields: [
    { key: 'type', label: "Type d'attestation", type: 'select', options: ['Présence', 'Service', 'Recommandation', 'Stage', 'Formation'] },
    { key: 'nom', label: 'Nom du bénéficiaire', type: 'text' },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'lieu', label: 'Lieu', type: 'text' },
    { key: 'texte', label: 'Texte personnalisé', type: 'textarea' },
  ]},
  { id: 'devis', label: 'Devis / Facture', icon: '📄', desc: 'Devis ou facture pour prestations', fields: [
    { key: 'client', label: 'Nom du client', type: 'text' },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'validite', label: 'Validité (jours)', type: 'number' },
  ]},
  { id: 'fiche', label: 'Fiches Papier', icon: '📝', desc: 'Formulaires à remplir au stylo', fields: [
    { key: 'ficheType', label: 'Type de fiche', type: 'select', options: [] },
  ]},
];

interface LigneDevis { id: string; description: string; quantite: number; prixUnitaire: number; }

function genId(): string { return crypto.randomUUID?.() || Date.now().toString(36); }
function formatNumber(n: number): string { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function formatDate(d: string): string {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
function generateRef(): string {
  const n = Date.now().toString(36).slice(-4).toUpperCase();
  return `REF-${n}-${new Date().getFullYear()}`;
}

const FICHE_TYPES: { id: FicheType; label: string; icon: string; desc: string }[] = [
  { id: 'membre', label: 'Fiche Membre', icon: '👤', desc: 'Inscription et suivi des membres' },
  { id: 'finance', label: 'Fiche Finances', icon: '💰', desc: 'Transactions et dons' },
  { id: 'culte', label: 'Fiche Culte', icon: '⛪', desc: 'Planification des cultes' },
  { id: 'communication', label: 'Fiche Communication', icon: '📨', desc: 'Messages et annonces' },
  { id: 'enseignement', label: "Fiche d'Enseignement", icon: '📖', desc: 'Études et exhortations' },
  { id: 'liturgique', label: 'Fiche Liturgique', icon: '🕯️', desc: 'Thèmes et célébrations' },
  { id: 'departement', label: 'Fiche Département', icon: '🏛️', desc: 'Ministères et départements' },
  { id: 'presence', label: 'Fiche Présence', icon: '✅', desc: 'Assistance aux cultes' },
  { id: 'hebdomadaire', label: 'Suivi Hebdomadaire', icon: '📊', desc: 'Participants, offrandes et dépenses sur 3 jours' },
  { id: 'renseignement', label: "Renseignement Nouveau Membre", icon: '📋', desc: "Fiche d'accueil et d'information" },
];

const TEMPLATES: { id: Template; label: string; desc: string; color: string; bg: string; border: string; accent: string; secondary: string }[] = [
  { id: 'classique', label: 'Classique', desc: 'Sobre & professionnel', color: '#1e293b', bg: '#ffffff', border: '#cbd5e1', accent: '#4f46e5', secondary: '#f8fafc' },
  { id: 'moderne', label: 'Moderne', desc: 'Design contemporain', color: '#0f172a', bg: '#fafaff', border: '#a5b4fc', accent: '#6366f1', secondary: '#eef2ff' },
  { id: 'elegant', label: 'Élégant', desc: 'Style cérémonial', color: '#312e81', bg: '#fffbeb', border: '#f59e0b', accent: '#d97706', secondary: '#fef3c7' },
];

interface DocumentsModuleProps { settings: ChurchSettings | null; members: Member[]; }

export default function DocumentsModule({ settings, members }: DocumentsModuleProps) {
  const [docType, setDocType] = useState<DocType>('certificat');
  const [ficheType, setFicheType] = useState<FicheType>('membre');
  const [template, setTemplate] = useState<Template>('classique');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [lignes, setLignes] = useState<LigneDevis[]>([{ id: genId(), description: '', quantite: 1, prixUnitaire: 0 }]);
  const [ref, setRef] = useState(generateRef());
  const [preview, setPreview] = useState(false);
  const [a5Mode, setA5Mode] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const doc = DOC_TYPES.find(d => d.id === docType)!;
  const T = TEMPLATES.find(t => t.id === template)!;

  const downloadPDF = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const docName = docType === 'fiche'
      ? (FICHE_TYPES.find(f => f.id === ficheType)?.label || 'Fiche')
      : doc.label;
    const pageSize = a5Mode ? 'A4 landscape' : 'A4';
    const pageMargin = a5Mode ? '8mm' : '15mm';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${docName} - ${ref}</title>
<style>
  @page { size: ${pageSize}; margin: ${pageMargin}; }
  body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table { page-break-inside: avoid; }
</style>
</head>
<body>${content}</body>
</html>`);
    win.document.close();
    win.focus();
    win.onafterprint = () => win.close();
    setTimeout(() => { win.print(); }, 500);
  };

  const downloadWord = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const docName = docType === 'fiche'
      ? (FICHE_TYPES.find(f => f.id === ficheType)?.label || 'Fiche')
      : doc.label;
    const isA5 = a5Mode && ficheType === 'renseignement';
    const themeBg = T.bg;
    const themeAccent = T.accent;
    const themeBorder = T.border;
    const themeSecondary = T.secondary;
    const themeColor = T.color;
    const pageSetup = isA5
      ? `<w:PageSetup><w:PageWidth>297mm</w:PageWidth><w:PageHeight>210mm</w:PageHeight></w:PageSetup>`
      : '';
    const html = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
${pageSetup}
</w:WordDocument>
</xml>
<![endif]-->
<style>
  @page { size: ${isA5 ? '297mm 210mm' : 'A4'}; margin: ${isA5 ? '8mm' : '15mm'}; mso-page-orientation: ${isA5 ? 'landscape' : 'portrait'}; }
  body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: ${isA5 ? '8pt' : '11pt'}; color: ${themeColor}; background: ${themeBg}; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid ${themeBorder}; mso-border-alt: solid windowtext .5pt; padding: 4px 7px; vertical-align: top; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; mso-background: auto; }
</style>
</head>
<body style="background:${themeBg};color:${themeColor}">
${content}
</body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docName}-${ref}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => { setFields({}); setRef(generateRef()); setLignes([{ id: genId(), description: '', quantite: 1, prixUnitaire: 0 }]); setPreview(false); setFicheType('membre'); }, [docType]);

  const set = (k: string, v: string) => setFields(prev => ({ ...prev, [k]: v }));
  const addLigne = () => setLignes([...lignes, { id: genId(), description: '', quantite: 1, prixUnitaire: 0 }]);
  const removeLigne = (id: string) => { if (lignes.length > 1) setLignes(lignes.filter(l => l.id !== id)); };
  const moveLigne = (idx: number, dir: number) => {
    const to = idx + dir; if (to < 0 || to >= lignes.length) return;
    const arr = [...lignes]; [arr[idx], arr[to]] = [arr[to], arr[idx]]; setLignes(arr);
  };
  const updateLigne = (id: string, key: keyof LigneDevis, val: any) => setLignes(lignes.map(l => l.id === id ? { ...l, [key]: val } : l));
  const totalDevis = lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);

  useEffect(() => {
    const id = 'a5-print-style';
    if (a5Mode) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = '@page { size: A4 landscape; margin: 8mm; }';
      document.head.appendChild(s);
    }
    return () => { const el = document.getElementById(id); if (el) el.remove(); };
  }, [a5Mode]);

  const renderDocument = () => {
    const appName = settings?.appName || "ELIKIA EKLESIA";
    const logo = settings?.appLogo || '⛪';
    const header = settings?.reportHeader || appName;
    const isImage = logo.startsWith('data:image');

    // Template-based styles
    const S = {
      doc: { fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", color: T.color, maxWidth: '800px', margin: '0 auto', padding: '30px', background: T.bg } as React.CSSProperties,
      borderStyle: template === 'classique' ? `3px solid ${T.accent}` : template === 'moderne' ? `3px double ${T.accent}` : `3px solid ${T.accent}`,
      borderDecor: template === 'elegant'
        ? { border: `2px solid ${T.border}`, padding: '6px', borderRadius: '2px', marginBottom: '18px' } as React.CSSProperties
        : {} as React.CSSProperties,
      headerDecor: template === 'elegant'
        ? { borderTop: `6px solid ${T.accent}`, borderBottom: `3px solid ${T.accent}`, marginBottom: '24px' } as React.CSSProperties
        : { borderBottom: template === 'moderne' ? `3px double ${T.accent}` : `3px solid ${T.accent}`, marginBottom: '24px' } as React.CSSProperties,
    };

    const HeaderBlock = () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingBottom: '16px', ...S.headerDecor } as React.CSSProperties}>
        <div style={{
          ...(template === 'elegant' ? { background: T.secondary, borderRadius: '50%', padding: '8px', border: `2px solid ${T.accent}` } : {}),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isImage ? <img src={logo} alt="" style={{ width: '48px', height: '48px', objectFit: 'contain' }} /> : <span style={{ fontSize: '32px', color: T.accent }}>{logo}</span>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16pt', fontWeight: 'bold', color: T.accent, margin: 0, lineHeight: 1.3 }}>{appName}</div>
          <div style={{ fontSize: '7.5pt', color: '#64748b', whiteSpace: 'pre-wrap', margin: '2px 0 0', lineHeight: 1.4 }}>{header}</div>
        </div>
        {template === 'elegant' && <div style={{ fontSize: '28pt', color: T.accent, opacity: 0.15, fontWeight: 'bold', transform: 'rotate(15deg)' }}>✝</div>}
      </div>
    );

    const BottomDecor = () => template === 'elegant' ? <div style={{ borderTop: `6px solid ${T.accent}`, marginTop: '24px', width: '100%' }} /> : null;

    const CachetBlock = () => settings?.cachetBase64
      ? <img src={settings.cachetBase64} alt="Cachet" style={{ width: '76px', marginBottom: '4px', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
      : null;

    const signature = (
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '36px', fontSize: '8pt', color: T.color }}>
        <div style={{ textAlign: 'center', width: '200px' }}>
          {template === 'elegant' && <div style={{ fontSize: '12pt', color: T.accent, opacity: 0.3 }}>_._._</div>}
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '4px', marginTop: '4px' }}>Signature</div>
        </div>
        <div style={{ textAlign: 'center', width: '200px' }}>
          <CachetBlock />
          {template === 'elegant' && <div style={{ fontSize: '12pt', color: T.accent, opacity: 0.3 }}>_._._</div>}
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '4px', marginTop: '4px' }}>Cachet</div>
        </div>
      </div>
    );

    const footer = (
      <div style={{ textAlign: 'center', fontSize: '7pt', color: '#cbd5e1', marginTop: '24px', paddingTop: '12px', borderTop: `1px solid ${T.border}` }}>
        Document généré le {new Date().toLocaleDateString('fr-FR')} · {ref}
      </div>
    );

    if (docType === 'fiche') {
      const F = FICHE_TYPES.find(f => f.id === ficheType)!;
      const line = (label: string, width = '100%') => (
        <div style={{ display: 'flex', alignItems: 'flex-end', margin: '8px 0', borderBottom: `1px dashed ${T.border}`, paddingBottom: '2px', width }}>
          <span style={{ fontSize: '9pt', color: '#64748b', minWidth: '140px', fontWeight: 'bold' }}>{label}</span>
          <span style={{ flex: 1, fontSize: '10pt', minHeight: '24px' }}>&nbsp;</span>
        </div>
      );
      const checkbox = (label: string) => (
        <span style={{ marginRight: '14px', fontSize: '9pt', whiteSpace: 'nowrap' }}>
          ☐ {label}
        </span>
      );

      const ficheContent = () => {
        switch (ficheType) {
          case 'membre':
            return (
              <div>
                <div style={{ fontSize: '11pt', fontWeight: 'bold', color: T.accent, textAlign: 'center', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '2px' }}>Fiche d'inscription Membre</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#94a3b8', marginBottom: '12px', fontFamily: "'Courier New', monospace" }}>N° {ref}</div>
                {line('Nom & Prénoms')}
                {line('Adresse')}
                {line('Téléphone')}
                {line('Email')}
                {line('Date de naissance')}
                {line('Ministère / Département')}
                {line('Groupe')}
                <div style={{ margin: '12px 0' }}>
                  <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Statut</span>
                  {checkbox('Actif')}{checkbox('Inactif')}{checkbox('En observation')}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Observations</span>
                  <div style={{ border: `1px dashed ${T.border}`, borderRadius: '6px', padding: '8px', minHeight: '60px' }}></div>
                </div>
              </div>
            );
          case 'finance':
            return (
              <div>
                <div style={{ fontSize: '11pt', fontWeight: 'bold', color: T.accent, textAlign: 'center', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '2px' }}>Fiche de Transaction Financière</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#94a3b8', marginBottom: '12px', fontFamily: "'Courier New', monospace" }}>N° {ref}</div>
                <div style={{ margin: '12px 0' }}>
                  <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Type</span>
                  {checkbox('Revenu')}{checkbox('Dépense')}
                </div>
                {line('Catégorie (Dîme, Offrande, etc.)')}
                {line('Montant (FCFA)')}
                {line('Date')}
                {line('Donateur / Bénéficiaire')}
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Notes</span>
                  <div style={{ border: `1px dashed ${T.border}`, borderRadius: '6px', padding: '8px', minHeight: '50px' }}></div>
                </div>
              </div>
            );
          case 'culte':
            return (
              <div>
                <div style={{ fontSize: '11pt', fontWeight: 'bold', color: T.accent, textAlign: 'center', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '2px' }}>Fiche de Culte / Événement</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#94a3b8', marginBottom: '12px', fontFamily: "'Courier New', monospace" }}>N° {ref}</div>
                {line('Titre du culte / événement')}
                <div style={{ margin: '12px 0' }}>
                  <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Type</span>
                  {checkbox('Prédication')}{checkbox('École du dimanche')}{checkbox('Jeûne')}{checkbox('Séminaire')}{checkbox('Culte régulier')}
                </div>
                {line('Date')}
                {line('Heure')}
                {line('Prédicateur / Intervenant')}
                {line('Nombre de participants')}
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Notes / Déroulement</span>
                  <div style={{ border: `1px dashed ${T.border}`, borderRadius: '6px', padding: '8px', minHeight: '70px' }}></div>
                </div>
              </div>
            );
          case 'communication':
            return (
              <div>
                <div style={{ fontSize: '11pt', fontWeight: 'bold', color: T.accent, textAlign: 'center', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '2px' }}>Fiche de Communication</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#94a3b8', marginBottom: '12px', fontFamily: "'Courier New', monospace" }}>N° {ref}</div>
                <div style={{ margin: '12px 0' }}>
                  <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Canal</span>
                  {checkbox('WhatsApp')}{checkbox('SMS')}
                </div>
                {line('Titre du message')}
                {line('Groupe destinataire')}
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Contenu du message</span>
                  <div style={{ border: `1px dashed ${T.border}`, borderRadius: '6px', padding: '8px', minHeight: '80px' }}></div>
                </div>
              </div>
            );
          case 'enseignement':
            return (
              <div>
                <div style={{ fontSize: '11pt', fontWeight: 'bold', color: T.accent, textAlign: 'center', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '2px' }}>Fiche d'Enseignement</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#94a3b8', marginBottom: '12px', fontFamily: "'Courier New', monospace" }}>N° {ref}</div>
                {line('Titre de l\'enseignement')}
                {line('Thème principal')}
                <div style={{ margin: '12px 0' }}>
                  <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Type</span>
                  {checkbox('Unique')}{checkbox('Série')}
                </div>
                {line('Nombre de jours')}
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Plan / Notes</span>
                  <div style={{ border: `1px dashed ${T.border}`, borderRadius: '6px', padding: '8px', minHeight: '80px' }}></div>
                </div>
              </div>
            );
          case 'liturgique':
            return (
              <div>
                <div style={{ fontSize: '11pt', fontWeight: 'bold', color: T.accent, textAlign: 'center', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '2px' }}>Fiche Thème Liturgique</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#94a3b8', marginBottom: '12px', fontFamily: "'Courier New', monospace" }}>N° {ref}</div>
                {line('Titre du thème')}
                {line('Date de célébration')}
                {line('Prédicateur')}
                {line('Texte biblique')}
                {line('Saison liturgique')}
                {line('Type de célébration')}
                {line('Cantiques / Hymnes')}
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Description / Notes</span>
                  <div style={{ border: `1px dashed ${T.border}`, borderRadius: '6px', padding: '8px', minHeight: '60px' }}></div>
                </div>
              </div>
            );
          case 'departement':
            return (
              <div>
                <div style={{ fontSize: '11pt', fontWeight: 'bold', color: T.accent, textAlign: 'center', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '2px' }}>Fiche Département / Ministère</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#94a3b8', marginBottom: '12px', fontFamily: "'Courier New', monospace" }}>N° {ref}</div>
                {line('Nom du département')}
                {line('Responsable / Leader')}
                {line('Couleur (optionnelle)')}
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Description / Vision</span>
                  <div style={{ border: `1px dashed ${T.border}`, borderRadius: '6px', padding: '8px', minHeight: '70px' }}></div>
                </div>
                <div style={{ marginTop: '12px' }}>
                  <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Membres</span>
                  <div style={{ border: `1px dashed ${T.border}`, borderRadius: '6px', padding: '8px', minHeight: '60px' }}></div>
                </div>
              </div>
            );
          case 'hebdomadaire':
            const cell = { border: `1px solid ${T.border}` as const, padding: '5px 8px', minHeight: '24px', verticalAlign: 'top' as const };
            const cellH = { ...cell, background: T.accent, color: '#fff', fontWeight: 'bold', fontSize: '7.5pt', textAlign: 'center' as const, padding: '6px 8px' };
            return (
              <div>
                <div style={{ fontSize: '12pt', fontWeight: 'bold', color: T.accent, textAlign: 'center', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '3px' }}>Suivi Hebdomadaire</div>
                <div style={{ fontSize: '8pt', color: '#64748b', textAlign: 'center', marginBottom: '4px' }}>Participants • Offrandes • Dépenses</div>
                <div style={{ textAlign: 'center', fontSize: '7.5pt', color: '#94a3b8', marginBottom: '16px', fontFamily: "'Courier New', monospace" }}>Réf: {ref}</div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '8pt' }}>
                  <tbody>
                    <tr>
                      <td style={{ ...cell, width: '33%', borderBottom: 'none' }}><span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '7pt' }}>Semaine du</span><div style={{ minHeight: '20px' }}></div></td>
                      <td style={{ ...cell, width: '33%', borderBottom: 'none', borderLeft: 'none' }}><span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '7pt' }}>au</span><div style={{ minHeight: '20px' }}></div></td>
                      <td style={{ ...cell, width: '33%', borderBottom: 'none', borderLeft: 'none' }}><span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '7pt' }}>Mois</span><div style={{ minHeight: '20px' }}></div></td>
                    </tr>
                  </tbody>
                </table>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt', marginBottom: '18px' }}>
                  <thead>
                    <tr>
                      <th style={{ ...cellH, width: '26px' }}>N°</th>
                      <th style={{ ...cellH, borderLeft: 'none', textAlign: 'left' }}>Jour</th>
                      <th style={{ ...cellH, borderLeft: 'none', width: '58px' }}>Participants</th>
                      <th style={{ ...cellH, borderLeft: 'none' }}>Dîme</th>
                      <th style={{ ...cellH, borderLeft: 'none' }}>Offrande</th>
                      <th style={{ ...cellH, borderLeft: 'none' }}>Act. de Grâce</th>
                      <th style={{ ...cellH, borderLeft: 'none' }}>Total Entrées</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((_, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : T.secondary }}>
                        <td style={{ ...cell, textAlign: 'center', fontWeight: 'bold', color: '#94a3b8', borderTop: 'none' }}>{i + 1}</td>
                        <td style={{ ...cell, borderTop: 'none', borderLeft: 'none' }}><div style={{ minHeight: '24px' }}></div></td>
                        <td style={{ ...cell, borderTop: 'none', borderLeft: 'none', textAlign: 'center' }}><div style={{ minHeight: '24px' }}></div></td>
                        <td style={{ ...cell, borderTop: 'none', borderLeft: 'none', textAlign: 'right' }}><div style={{ minHeight: '24px' }}></div></td>
                        <td style={{ ...cell, borderTop: 'none', borderLeft: 'none', textAlign: 'right' }}><div style={{ minHeight: '24px' }}></div></td>
                        <td style={{ ...cell, borderTop: 'none', borderLeft: 'none', textAlign: 'right' }}><div style={{ minHeight: '24px' }}></div></td>
                        <td style={{ ...cell, borderTop: 'none', borderLeft: 'none', textAlign: 'right' }}><div style={{ minHeight: '24px' }}></div></td>
                      </tr>
                    ))}
                    <tr style={{ background: T.secondary, fontWeight: 'bold' }}>
                      <td style={{ ...cell, borderTop: 'none', textAlign: 'center', color: T.accent }}></td>
                      <td style={{ ...cell, borderTop: 'none', borderLeft: 'none', color: T.accent }}>TOTAUX SEMAINE</td>
                      <td style={{ ...cell, borderTop: 'none', borderLeft: 'none', textAlign: 'center' }}></td>
                      <td style={{ ...cell, borderTop: 'none', borderLeft: 'none', textAlign: 'right' }}></td>
                      <td style={{ ...cell, borderTop: 'none', borderLeft: 'none', textAlign: 'right' }}></td>
                      <td style={{ ...cell, borderTop: 'none', borderLeft: 'none', textAlign: 'right' }}></td>
                      <td style={{ ...cell, borderTop: 'none', borderLeft: 'none', textAlign: 'right' }}></td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ marginTop: '6px' }}>
                  <div style={{ fontSize: '9pt', fontWeight: 'bold', color: T.accent, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Dépenses de la semaine</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt' }}>
                    <thead>
                      <tr>
                        <th style={{ ...cellH, width: '26px' }}>N°</th>
                        <th style={{ ...cellH, borderLeft: 'none', textAlign: 'left' }}>Date</th>
                        <th style={{ ...cellH, borderLeft: 'none', textAlign: 'left' }}>Libellé</th>
                        <th style={{ ...cellH, borderLeft: 'none', width: '100px' }}>Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4, 5].map((_, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : T.secondary }}>
                          <td style={{ ...cell, textAlign: 'center', fontWeight: 'bold', color: '#94a3b8', borderTop: 'none' }}>{i + 1}</td>
                          <td style={{ ...cell, borderTop: 'none', borderLeft: 'none' }}><div style={{ minHeight: '20px' }}></div></td>
                          <td style={{ ...cell, borderTop: 'none', borderLeft: 'none' }}><div style={{ minHeight: '20px' }}></div></td>
                          <td style={{ ...cell, borderTop: 'none', borderLeft: 'none', textAlign: 'right' }}><div style={{ minHeight: '20px' }}></div></td>
                        </tr>
                      ))}
                      <tr style={{ background: T.secondary, fontWeight: 'bold' }}>
                        <td style={{ ...cell, borderTop: 'none', textAlign: 'center' }}></td>
                        <td style={{ ...cell, borderTop: 'none', borderLeft: 'none' }}></td>
                        <td style={{ ...cell, borderTop: 'none', borderLeft: 'none', textAlign: 'right', color: T.accent }}>TOTAL DÉPENSES</td>
                        <td style={{ ...cell, borderTop: 'none', borderLeft: 'none', textAlign: 'right' }}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Observations / Notes</span>
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: '6px', padding: '8px', minHeight: '50px' }}></div>
                </div>
              </div>
            );
          case 'presence':
            return (
              <div>
                <div style={{ fontSize: '11pt', fontWeight: 'bold', color: T.accent, textAlign: 'center', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '2px' }}>Fiche de Présence</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#94a3b8', marginBottom: '12px', fontFamily: "'Courier New', monospace" }}>N° {ref}</div>
                {line('Date')}
                {line('Type de culte / événement')}
                <div style={{ marginTop: '12px' }}>
                  <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Liste des présents (Nom & Prénoms)</span>
                  <div style={{ border: `1px dashed ${T.border}`, borderRadius: '6px', padding: '8px', minHeight: '150px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#cbd5e1', marginBottom: '4px' }}>
                      <span>1. _________________</span>
                      <span>2. _________________</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#cbd5e1', marginBottom: '4px' }}>
                      <span>3. _________________</span>
                      <span>4. _________________</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#cbd5e1', marginBottom: '4px' }}>
                      <span>5. _________________</span>
                      <span>6. _________________</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#cbd5e1', marginBottom: '4px' }}>
                      <span>7. _________________</span>
                      <span>8. _________________</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#cbd5e1', marginBottom: '4px' }}>
                      <span>9. _________________</span>
                      <span>10. ________________</span>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '9pt', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Notes</span>
                  <div style={{ border: `1px dashed ${T.border}`, borderRadius: '6px', padding: '8px', minHeight: '40px' }}></div>
                </div>
              </div>
            );
          case 'renseignement': {
            const _chk = (label: string) => (
              <span style={{ marginRight: '12px', fontSize: '10pt', whiteSpace: 'nowrap' }}>
                ☐ {label}
              </span>
            );
            return (
              <div>
                <div style={{ fontSize: '13pt', fontWeight: 'bold', color: T.accent, textAlign: 'center', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '4px' }}>Fiche de Renseignement</div>
                <div style={{ fontSize: '8pt', color: '#64748b', textAlign: 'center', marginBottom: '2px', fontStyle: 'italic' }}>Nouveau Membre — À remplir par l'accueil</div>
                <div style={{ textAlign: 'center', fontSize: '7pt', color: '#94a3b8', marginBottom: '14px', fontFamily: "'Courier New', monospace" }}>N° {ref}</div>

                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '8pt', marginBottom: '12px' }}>
                  <colgroup>
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '25%' }} />
                  </colgroup>
                  <tr><td colSpan={4} style={{ background: T.accent, color: '#fff', padding: '5px 8px', fontWeight: 'bold', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '1px' }}>État Civil</td></tr>
                  <tr>
                    <td colSpan={2} style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Nom & Prénoms</span>
                      <div style={{ minHeight: '26px' }}></div>
                    </td>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Date de naissance</span>
                      <div style={{ minHeight: '20px' }}></div>
                    </td>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Lieu de naissance</span>
                      <div style={{ minHeight: '20px' }}></div>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Nationalité</span>
                      <div style={{ minHeight: '20px' }}></div>
                    </td>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '3px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Sexe</span>
                      {_chk('M')}{_chk('F')}
                    </td>
                    <td colSpan={2} style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '3px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Situation Matrimoniale</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>{_chk('Célibataire')}{_chk('Marié(e)')}{_chk('Divorcé(e)')}{_chk('Veuf(ve)')}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Profession</span>
                      <div style={{ minHeight: '20px' }}></div>
                    </td>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Téléphone</span>
                      <div style={{ minHeight: '20px' }}></div>
                    </td>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Email</span>
                      <div style={{ minHeight: '20px' }}></div>
                    </td>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Adresse</span>
                      <div style={{ minHeight: '20px' }}></div>
                    </td>
                  </tr>
                </table>

                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '8pt', marginBottom: '12px' }}>
                  <colgroup>
                    <col style={{ width: '28%' }} />
                    <col style={{ width: '36%' }} />
                    <col style={{ width: '36%' }} />
                  </colgroup>
                  <tr><td colSpan={3} style={{ background: T.accent, color: '#fff', padding: '5px 8px', fontWeight: 'bold', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '1px' }}>Vie Spirituelle</td></tr>
                  <tr>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Date de conversion</span>
                      <div style={{ minHeight: '20px' }}></div>
                    </td>
                    <td colSpan={2} style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Ancienne église</span>
                      <div style={{ minHeight: '26px' }}></div>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Date d'arrivée</span>
                      <div style={{ minHeight: '20px' }}></div>
                    </td>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '3px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Baptême</span>
                      {_chk('Oui')}{_chk('Non')}
                    </td>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Date de baptême</span>
                      <div style={{ minHeight: '20px' }}></div>
                    </td>
                  </tr>
                </table>

                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '8pt', marginBottom: '12px' }}>
                  <colgroup>
                    <col style={{ width: '35%' }} />
                    <col style={{ width: '65%' }} />
                  </colgroup>
                  <tr><td colSpan={2} style={{ background: T.accent, color: '#fff', padding: '5px 8px', fontWeight: 'bold', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '1px' }}>Engagement & Ministère</td></tr>
                  <tr>
                    <td colSpan={2} style={{ border: `1px solid ${T.border}`, padding: '4px 7px' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '3px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Ministère souhaité</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>{_chk('Musique')}{_chk('Enseignement')}{_chk('Accueil')}{_chk('Média')}{_chk('Jeunesse')}{_chk('Prière')}{_chk('Usher')}{_chk('Autre')}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Dons / Talents</span>
                      <div style={{ minHeight: '50px' }}></div>
                    </td>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Motivation</span>
                      <div style={{ minHeight: '50px' }}></div>
                    </td>
                  </tr>
                </table>

                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '8pt', marginBottom: '12px' }}>
                  <colgroup>
                    <col style={{ width: '35%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '25%' }} />
                  </colgroup>
                  <tr><td colSpan={4} style={{ background: T.accent, color: '#fff', padding: '5px 8px', fontWeight: 'bold', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '1px' }}>Famille</td></tr>
                  <tr>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Nom du conjoint(e)</span>
                      <div style={{ minHeight: '20px' }}></div>
                    </td>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Nbre d'enfants</span>
                      <div style={{ minHeight: '20px' }}></div>
                    </td>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Âges des enfants</span>
                      <div style={{ minHeight: '20px' }}></div>
                    </td>
                    <td style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Téléphone urgence</span>
                      <div style={{ minHeight: '20px' }}></div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={4} style={{ border: `1px solid ${T.border}`, padding: '4px 7px', verticalAlign: 'top' }}>
                      <span style={{ color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px', fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Contact urgence</span>
                      <div style={{ minHeight: '26px' }}></div>
                    </td>
                  </tr>
                </table>
              </div>
            );
          }
        }
      };

      const singleFiche = () => {
        const isA5 = a5Mode && ficheType === 'renseignement';
        const docStyle = {
          ...S.doc,
          maxWidth: isA5 ? '100%' : '800px',
          padding: isA5 ? '6px 10px' : '30px',
          fontSize: isA5 ? '7pt' : undefined,
        } as React.CSSProperties;
        return (
          <div style={docStyle}>
            <div style={S.borderDecor}>
              {!isA5 && <HeaderBlock />}
              <div style={isA5 ? { fontSize: '7pt' } : {}}>
                {ficheContent()}
              </div>
              {ficheType !== 'renseignement' && (
                <div style={{ marginTop: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt' }}>
                    <div style={{ textAlign: 'center', width: '200px' }}>
                      <div style={{ borderTop: `1px solid ${T.color}`, paddingTop: '4px', marginTop: '20px' }}>Signature du responsable</div>
                    </div>
                    <div style={{ textAlign: 'center', width: '200px' }}>
                      <div style={{ borderTop: `1px solid ${T.color}`, paddingTop: '4px', marginTop: '20px' }}>Date</div>
                    </div>
                  </div>
                  <CachetBlock />
                </div>
              )}
              {isA5 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '6px', paddingTop: '4px', borderTop: `1px solid ${T.border}`, fontSize: '5.5pt', color: '#94a3b8' }}>
                  {isImage ? <img src={logo} alt="" style={{ width: '12px', height: '12px', objectFit: 'contain' }} /> : <span style={{ fontSize: '10px' }}>{logo}</span>}
                  <span>{appName}</span>
                  <span>·</span>
                  <span>{ref}</span>
                </div>
              ) : footer}
            </div>
            <BottomDecor />
          </div>
        );
      };

      if (a5Mode && ficheType === 'renseignement') {
        return (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', pageBreakInside: 'avoid' }}>
            <div style={{ flex: 1, minWidth: 0 }}>{singleFiche()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>{singleFiche()}</div>
          </div>
        );
      }

      return singleFiche();
    }

    if (docType === 'devis') {
      return (
        <div style={S.doc}>
          <div style={S.borderDecor}>
            <HeaderBlock />
            <div style={{ textAlign: 'center', fontSize: '14pt', fontWeight: 'bold', color: T.accent, textTransform: 'uppercase', letterSpacing: '3px', margin: '0 0 4px' }}>Devis</div>
            <div style={{ textAlign: 'center', fontSize: '8pt', color: '#94a3b8', marginBottom: '20px', fontFamily: "'Courier New', monospace" }}>{ref}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', color: T.color, marginBottom: '20px', padding: '10px 14px', background: T.secondary, borderRadius: '6px' }}>
              <span><span style={{ color: '#64748b' }}>Client : </span><span style={{ fontWeight: 'bold' }}>{fields.client || '—'}</span></span>
              <span><span style={{ color: '#64748b' }}>Date : </span><span style={{ fontWeight: 'bold' }}>{formatDate(fields.date || new Date().toISOString().slice(0, 10))}</span></span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: '16px', borderRadius: '6px', overflow: 'hidden' }}>
              <thead><tr>
                <th style={{ padding: '8px 10px', textAlign: 'center', background: T.accent, color: '#fff', fontWeight: 'bold', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '1px', width: '40px' }}>N°</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', background: T.accent, color: '#fff', fontWeight: 'bold', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '1px' }}>Description</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', background: T.accent, color: '#fff', fontWeight: 'bold', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '1px', width: '60px' }}>Qté</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', background: T.accent, color: '#fff', fontWeight: 'bold', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '1px', width: '100px' }}>Prix unitaire</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', background: T.accent, color: '#fff', fontWeight: 'bold', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '1px', width: '100px' }}>Total</th>
              </tr></thead>
              <tbody>
                {lignes.filter(l => l.description).map((l, i) => (
                  <tr key={l.id}>
                    <td style={{ padding: '7px 10px', borderBottom: `1px solid ${T.border}`, textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ padding: '7px 10px', borderBottom: `1px solid ${T.border}` }}>{l.description}</td>
                    <td style={{ padding: '7px 10px', borderBottom: `1px solid ${T.border}`, textAlign: 'right' }}>{l.quantite}</td>
                    <td style={{ padding: '7px 10px', borderBottom: `1px solid ${T.border}`, textAlign: 'right' }}>{formatNumber(l.prixUnitaire)} FCFA</td>
                    <td style={{ padding: '7px 10px', borderBottom: `1px solid ${T.border}`, textAlign: 'right', fontWeight: 'bold' }}>{formatNumber(l.quantite * l.prixUnitaire)} FCFA</td>
                  </tr>
                ))}
                <tr style={{ background: T.secondary, fontWeight: 'bold' }}>
                  <td colSpan={4} style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border}`, textAlign: 'right', fontSize: '9pt' }}>TOTAL</td>
                  <td style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border}`, textAlign: 'right', fontSize: '11pt', color: T.accent, fontWeight: 'bold' }}>{formatNumber(totalDevis)} FCFA</td>
                </tr>
              </tbody>
            </table>
            {fields.validite && <div style={{ fontSize: '8pt', color: '#64748b', marginBottom: '12px' }}>Validité : {fields.validite} jours</div>}
            {signature}
            {footer}
          </div>
          <BottomDecor />
        </div>
      );
    }

    if (docType === 'recu') {
      const montant = parseInt(fields.montant || '0');
      const typeRecu = fields.type || 'Dîme';
      const recuBg = template === 'elegant' ? T.bg : template === 'moderne' ? 'linear-gradient(135deg, #fff 0%, #eef2ff 100%)' : '#fff';
      const recuBorderColor = template === 'classique' ? T.accent : template === 'moderne' ? T.accent : T.border;
      return (
        <div style={S.doc}>
          <div style={S.borderDecor}>
            <div style={{ border: `2px solid ${recuBorderColor}`, borderRadius: '12px', padding: '24px', background: recuBg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {isImage ? <img src={logo} alt="" style={{ width: '40px' }} /> : <span style={{ fontSize: '28px', color: T.accent }}>{logo}</span>}
                  <div>
                    <div style={{ fontSize: '12pt', fontWeight: 'bold', color: T.color }}>{appName}</div>
                    <div style={{ fontSize: '7pt', color: '#64748b' }}>{header}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '8pt', color: '#64748b' }}>N° {ref}</div>
                  <div style={{ fontSize: '8pt', color: '#64748b' }}>{formatDate(fields.date || new Date().toISOString().slice(0, 10))}</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '7pt', textTransform: 'uppercase', letterSpacing: '3px', color: T.accent, fontWeight: 'bold' }}>Reçu de {typeRecu}</div>
                <div style={{ fontSize: '16pt', fontWeight: 'bold', color: T.accent, textAlign: 'center', margin: '8px 0' }}>{montant ? formatNumber(montant) : '______'} FCFA</div>
              </div>
              <table style={{ width: '100%', fontSize: '9pt', lineHeight: '2.2', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td style={{ color: '#64748b', width: '120px' }}>Donateur</td><td style={{ fontWeight: 'bold', borderBottom: `1px dashed ${T.border}` }}>{fields.donateur || '______________________'}</td></tr>
                  <tr><td style={{ color: '#64748b' }}>Mois concerné</td><td style={{ fontWeight: 'bold', borderBottom: `1px dashed ${T.border}` }}>{fields.mois || '______________________'}</td></tr>
                  <tr><td style={{ color: '#64748b' }}>Montant en lettres</td><td style={{ fontStyle: 'italic', borderBottom: `1px dashed ${T.border}` }}>{montant ? `${formatNumber(montant)} francs CFA` : '______________________'}</td></tr>
                </tbody>
              </table>
              {fields.notes && <div style={{ marginTop: '10px', fontSize: '8pt', fontStyle: 'italic', color: '#64748b' }}>Note : {fields.notes}</div>}
              {signature}
            </div>
            {footer}
          </div>
          <BottomDecor />
        </div>
      );
    }

    const isAttestation = docType === 'attestation';
    return (
      <div style={S.doc}>
        <div style={S.borderDecor}>
          <HeaderBlock />
          <div style={{ textAlign: 'center', fontSize: '14pt', fontWeight: 'bold', color: T.accent, textTransform: 'uppercase', letterSpacing: '3px', margin: '0 0 4px' }}>
            {isAttestation ? 'Attestation' : 'Certificat'}
          </div>
          <div style={{ textAlign: 'center', fontSize: '8pt', color: '#94a3b8', marginBottom: '20px', fontFamily: "'Courier New', monospace" }}>{ref}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', color: T.color, marginBottom: '20px', padding: '10px 14px', background: T.secondary, borderRadius: '6px' }}>
            <span><span style={{ color: '#64748b' }}>Bénéficiaire : </span><span style={{ fontWeight: 'bold', color: T.accent }}>{fields.nom || '—'}</span></span>
            <span><span style={{ color: '#64748b' }}>Type : </span><span style={{ fontWeight: 'bold' }}>{fields.type || '—'}</span></span>
          </div>
          <div style={{ fontSize: '10pt', lineHeight: '2', textAlign: 'justify', color: T.color }}>
            <p>Je soussigné, représentant légal de <strong style={{ color: T.accent }}>{appName}</strong>, certifie que :</p>
            <div style={{ textAlign: 'center', fontSize: '12pt', fontWeight: 'bold', color: T.accent, margin: '16px 0', padding: '12px', background: T.secondary, borderRadius: '6px', border: template === 'elegant' ? `1px dashed ${T.border}` : 'none' }}>
              {fields.nom || '______________________'}
            </div>
            <p>
              {isAttestation
                ? `a participé / été présent(e) au titre de ${fields.type || '...'} au sein de notre église.`
                : `est membre de notre église au titre de ${fields.type || '...'}.`}
            </p>
            <p>Fait à {fields.lieu || 'Brazzaville'}, le {formatDate(fields.date || new Date().toISOString().slice(0, 10))}.</p>
            {fields.texte && <p style={{ fontStyle: 'italic', marginTop: '12px', padding: '8px 14px', borderLeft: `3px solid ${T.accent}`, background: T.secondary }}>« {fields.texte} »</p>}
          </div>
          {signature}
          {footer}
        </div>
        <BottomDecor />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl text-slate-800 font-bold tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Documents
          </h2>
          <p className="text-xs text-slate-500">Générez certificats, reçus, attestations et devis.</p>
        </div>
      </div>

      {!preview ? (
        <>
          {/* Type selector */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {DOC_TYPES.map(d => (
              <button key={d.id} onClick={() => setDocType(d.id)}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  docType === d.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}>
                <div className="text-2xl mb-1">{d.icon}</div>
                <div className="text-sm font-bold text-slate-800">{d.label}</div>
                <div className="text-[10px] text-slate-500">{d.desc}</div>
              </button>
            ))}
          </div>

          {/* Template selector */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Palette className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-bold text-slate-700">Modèle de design</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setTemplate(t.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    template === t.id ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-4 h-4 rounded-full" style={{ background: t.accent }} />
                    <span className="text-sm font-bold text-slate-800">{t.label}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">{t.desc}</div>
                  <div className="flex gap-1 mt-2">
                    <div className="h-1 flex-1 rounded" style={{ background: t.accent }} />
                    <div className="h-1 flex-1 rounded" style={{ background: t.border }} />
                    <div className="h-1 flex-1 rounded" style={{ background: t.secondary }} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            {docType === 'fiche' ? (
              <>
                <h3 className="text-sm font-bold text-slate-800">Choisissez une fiche papier</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {FICHE_TYPES.map(ft => (
                    <button key={ft.id} onClick={() => setFicheType(ft.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        ficheType === ft.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}>
                      <div className="text-xl mb-1">{ft.icon}</div>
                      <div className="text-xs font-bold text-slate-800">{ft.label}</div>
                      <div className="text-[9px] text-slate-500">{ft.desc}</div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-bold text-slate-800">{doc.label} — {doc.desc}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {doc.fields.map(f => (
                    <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">{f.label}</label>
                      {f.type === 'select' ? (
                        <select value={fields[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white">
                          <option value="">Sélectionnez...</option>
                          {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.type === 'textarea' ? (
                        <textarea value={fields[f.key] || ''} onChange={e => set(f.key, e.target.value)} rows={3}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white" />
                      ) : (
                        <input type={f.type} value={fields[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white" />
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {docType === 'devis' && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Lignes du devis</span>
                  <button onClick={addLigne} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer">
                    <Plus className="w-3 h-3" /> Ajouter une ligne
                  </button>
                </div>
                {lignes.map((l, i) => (
                  <div key={l.id} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-4">{i + 1}.</span>
                    <input type="text" value={l.description} onChange={e => updateLigne(l.id, 'description', e.target.value)}
                      placeholder="Description" className="flex-1 text-xs p-1.5 border border-slate-200 rounded focus:outline-indigo-600 bg-white" />
                    <input type="number" value={l.quantite || ''} onChange={e => updateLigne(l.id, 'quantite', parseInt(e.target.value) || 0)} min={1}
                      placeholder="Qté" className="w-16 text-xs p-1.5 border border-slate-200 rounded focus:outline-indigo-600 bg-white text-right" />
                    <input type="number" value={l.prixUnitaire || ''} onChange={e => updateLigne(l.id, 'prixUnitaire', parseInt(e.target.value) || 0)} min={0}
                      placeholder="Prix" className="w-24 text-xs p-1.5 border border-slate-200 rounded focus:outline-indigo-600 bg-white text-right" />
                    <span className="text-xs font-semibold text-slate-600 w-24 text-right">{formatNumber(l.quantite * l.prixUnitaire)} FCFA</span>
                    <div className="flex gap-0.5">
                      <button onClick={() => moveLigne(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-slate-100 cursor-pointer disabled:opacity-30"><MoveUp className="w-3 h-3" /></button>
                      <button onClick={() => moveLigne(i, 1)} disabled={i === lignes.length - 1} className="p-1 rounded hover:bg-slate-100 cursor-pointer disabled:opacity-30"><MoveDown className="w-3 h-3" /></button>
                    </div>
                    <button onClick={() => removeLigne(l.id)} className="p-1 rounded hover:bg-red-50 cursor-pointer"><Trash2 className="w-3 h-3 text-red-400" /></button>
                  </div>
                ))}
                <div className="text-right text-sm font-bold text-indigo-600 pt-1">{formatNumber(totalDevis)} FCFA</div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button onClick={() => setPreview(true)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all">
                <FileText className="w-3.5 h-3.5" /> Aperçu
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-slate-800">Aperçu — {docType === 'fiche' ? FICHE_TYPES.find(f => f.id === ficheType)?.label || 'Fiche' : doc.label}</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: T.secondary, color: T.accent }}>
                {T.label}
              </span>
              {docType === 'fiche' && ficheType === 'renseignement' && (
                <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer select-none">
                  <input type="checkbox" checked={a5Mode} onChange={e => setA5Mode(e.target.checked)}
                    className="w-3 h-3 rounded border-slate-300 cursor-pointer" />
                  A5 (2 par A4)
                </label>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPreview(false)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 border border-slate-200 rounded-lg cursor-pointer">
                <X className="w-3.5 h-3.5" /> Modifier
              </button>
              <button onClick={downloadWord}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all">
                <FileDown className="w-3.5 h-3.5" /> Word
              </button>
              <button onClick={downloadPDF}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all">
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button onClick={() => window.print()}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all">
                <Printer className="w-3.5 h-3.5" /> Imprimer
              </button>
            </div>
          </div>
          <div ref={printRef} className="print-area">
            {renderDocument()}
          </div>
        </div>
      )}
    </div>
  );
}
