import React, { useState, useRef, useEffect } from 'react';
import { FileText, Printer, Download, X, Plus, Trash2, MoveUp, MoveDown, Palette } from 'lucide-react';
import { ChurchSettings, Member } from '../types';

type DocType = 'certificat' | 'recu' | 'attestation' | 'devis';
type Template = 'classique' | 'moderne' | 'elegant';

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

const TEMPLATES: { id: Template; label: string; desc: string; color: string; bg: string; border: string; accent: string; secondary: string }[] = [
  { id: 'classique', label: 'Classique', desc: 'Sobre & professionnel', color: '#1e293b', bg: '#ffffff', border: '#cbd5e1', accent: '#4f46e5', secondary: '#f8fafc' },
  { id: 'moderne', label: 'Moderne', desc: 'Design contemporain', color: '#0f172a', bg: '#fafaff', border: '#a5b4fc', accent: '#6366f1', secondary: '#eef2ff' },
  { id: 'elegant', label: 'Élégant', desc: 'Style cérémonial', color: '#312e81', bg: '#fffbeb', border: '#f59e0b', accent: '#d97706', secondary: '#fef3c7' },
];

interface DocumentsModuleProps { settings: ChurchSettings | null; members: Member[]; }

export default function DocumentsModule({ settings, members }: DocumentsModuleProps) {
  const [docType, setDocType] = useState<DocType>('certificat');
  const [template, setTemplate] = useState<Template>('classique');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [lignes, setLignes] = useState<LigneDevis[]>([{ id: genId(), description: '', quantite: 1, prixUnitaire: 0 }]);
  const [ref, setRef] = useState(generateRef());
  const [preview, setPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const doc = DOC_TYPES.find(d => d.id === docType)!;
  const T = TEMPLATES.find(t => t.id === template)!;

  const downloadPDF = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { margin: 0; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @media print { body { margin: 0; padding: 20px; } }
    </style></head><body>${content}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) w.focus();
  };

  useEffect(() => { setFields({}); setRef(generateRef()); setLignes([{ id: genId(), description: '', quantite: 1, prixUnitaire: 0 }]); setPreview(false); }, [docType]);

  const set = (k: string, v: string) => setFields(prev => ({ ...prev, [k]: v }));
  const addLigne = () => setLignes([...lignes, { id: genId(), description: '', quantite: 1, prixUnitaire: 0 }]);
  const removeLigne = (id: string) => { if (lignes.length > 1) setLignes(lignes.filter(l => l.id !== id)); };
  const moveLigne = (idx: number, dir: number) => {
    const to = idx + dir; if (to < 0 || to >= lignes.length) return;
    const arr = [...lignes]; [arr[idx], arr[to]] = [arr[to], arr[idx]]; setLignes(arr);
  };
  const updateLigne = (id: string, key: keyof LigneDevis, val: any) => setLignes(lignes.map(l => l.id === id ? { ...l, [key]: val } : l));
  const totalDevis = lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);

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
              <h3 className="text-sm font-bold text-slate-800">Aperçu — {doc.label}</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: T.secondary, color: T.accent }}>
                {T.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPreview(false)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 border border-slate-200 rounded-lg cursor-pointer">
                <X className="w-3.5 h-3.5" /> Modifier
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
