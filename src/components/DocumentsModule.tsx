import React, { useState, useRef, useEffect } from 'react';
import { FileText, Printer, Download, X, Plus, Trash2, MoveUp, MoveDown } from 'lucide-react';
import { ChurchSettings, Member } from '../types';

type DocType = 'certificat' | 'recu' | 'attestation' | 'devis';

interface DocConfig {
  id: DocType;
  label: string;
  icon: string;
  desc: string;
  fields: { key: string; label: string; type: 'text' | 'textarea' | 'number' | 'select' | 'date'; options?: string[] }[];
}

const DOC_TYPES: DocConfig[] = [
  {
    id: 'certificat',
    label: 'Certificat',
    icon: '📜',
    desc: 'Certificat de membre, baptême, mariage...',
    fields: [
      { key: 'type', label: 'Type de certificat', type: 'select', options: ['Membre', 'Baptême', 'Mariage', 'Recommandation'] },
      { key: 'nom', label: 'Nom du bénéficiaire', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'texte', label: 'Texte personnalisé', type: 'textarea' },
    ],
  },
  {
    id: 'recu',
    label: 'Reçu de Dîme',
    icon: '💰',
    desc: 'Reçu de dîme, offrande ou don',
    fields: [
      { key: 'donateur', label: 'Nom du donateur', type: 'text' },
      { key: 'montant', label: 'Montant (FCFA)', type: 'number' },
      { key: 'type', label: 'Type', type: 'select', options: ['Dîme', 'Offrande', 'Action de grâce', 'Don'] },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'mois', label: 'Mois concerné', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    id: 'attestation',
    label: 'Attestation',
    icon: '📋',
    desc: 'Attestation de présence, service, stage...',
    fields: [
      { key: 'type', label: "Type d'attestation", type: 'select', options: ['Présence', 'Service', 'Recommandation', 'Stage'] },
      { key: 'nom', label: 'Nom du bénéficiaire', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'texte', label: 'Texte personnalisé', type: 'textarea' },
    ],
  },
  {
    id: 'devis',
    label: 'Devis / Facture',
    icon: '📄',
    desc: 'Devis ou facture pour prestations',
    fields: [
      { key: 'client', label: 'Nom du client', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'validite', label: 'Validité (jours)', type: 'number' },
    ],
  },
];

interface LigneDevis {
  id: string;
  description: string;
  quantite: number;
  prixUnitaire: number;
}

function genId(): string { return crypto.randomUUID?.() || Date.now().toString(36); }

function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatDate(d: string): string {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function generateRef(): string {
  const n = Date.now().toString(36).slice(-4).toUpperCase();
  return `REF-${n}-${new Date().getFullYear()}`;
}

interface DocumentsModuleProps {
  settings: ChurchSettings | null;
  members: Member[];
}

export default function DocumentsModule({ settings, members }: DocumentsModuleProps) {
  const [docType, setDocType] = useState<DocType>('certificat');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [lignes, setLignes] = useState<LigneDevis[]>([{ id: genId(), description: '', quantite: 1, prixUnitaire: 0 }]);
  const [ref, setRef] = useState(generateRef());
  const [preview, setPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const doc = DOC_TYPES.find(d => d.id === docType)!;

  const downloadPDF = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { margin: 0; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { body { margin: 0; padding: 20px; } }
</style>
</head><body>${content}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      iframe.src = url;
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(url);
          }, 2000);
        }, 500);
      };
    } catch {
      const w = window.open(url, '_blank');
      if (w) { w.focus(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    }
  };

  useEffect(() => { setFields({}); setRef(generateRef()); setLignes([{ id: genId(), description: '', quantite: 1, prixUnitaire: 0 }]); setPreview(false); }, [docType]);

  const set = (k: string, v: string) => setFields(prev => ({ ...prev, [k]: v }));

  const addLigne = () => setLignes([...lignes, { id: genId(), description: '', quantite: 1, prixUnitaire: 0 }]);
  const removeLigne = (id: string) => { if (lignes.length > 1) setLignes(lignes.filter(l => l.id !== id)); };
  const moveLigne = (idx: number, dir: number) => {
    const to = idx + dir;
    if (to < 0 || to >= lignes.length) return;
    const arr = [...lignes];
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    setLignes(arr);
  };
  const updateLigne = (id: string, key: keyof LigneDevis, val: any) => setLignes(lignes.map(l => l.id === id ? { ...l, [key]: val } : l));

  const totalDevis = lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);

  const S = {
    doc: { fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", color: '#1e293b', maxWidth: '800px', margin: '0 auto', padding: '30px', background: '#fff' } as React.CSSProperties,
    header: { display: 'flex', alignItems: 'center', gap: '14px', paddingBottom: '16px', borderBottom: '3px solid #4f46e5', marginBottom: '24px' } as React.CSSProperties,
    headerLogo: { width: '48px', height: '48px', objectFit: 'contain' } as React.CSSProperties,
    headerText: { flex: 1 } as React.CSSProperties,
    headerName: { fontSize: '16pt', fontWeight: 'bold', color: '#1e293b', margin: 0, lineHeight: 1.3 } as React.CSSProperties,
    headerSub: { fontSize: '7.5pt', color: '#64748b', whiteSpace: 'pre-wrap', margin: '2px 0 0', lineHeight: 1.4 } as React.CSSProperties,
    title: { textAlign: 'center', fontSize: '14pt', fontWeight: 'bold', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '3px', margin: '0 0 4px' } as React.CSSProperties,
    ref: { textAlign: 'center', fontSize: '8pt', color: '#94a3b8', marginBottom: '20px', fontFamily: "'Courier New', monospace" } as React.CSSProperties,
    infoBar: { display: 'flex', justifyContent: 'space-between', fontSize: '9pt', color: '#475569', marginBottom: '20px', padding: '10px 14px', background: '#f8fafc', borderRadius: '6px' } as React.CSSProperties,
    infoLabel: { color: '#64748b' } as React.CSSProperties,
    infoVal: { fontWeight: 'bold', color: '#1e293b' } as React.CSSProperties,
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: '16px', borderRadius: '6px', overflow: 'hidden' } as React.CSSProperties,
    th: { padding: '8px 10px', textAlign: 'left', background: '#4f46e5', color: '#fff', fontWeight: 'bold', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '1px' } as React.CSSProperties,
    td: { padding: '7px 10px', borderBottom: '1px solid #e2e8f0' } as React.CSSProperties,
    totalRow: { background: '#eef2ff', fontWeight: 'bold' } as React.CSSProperties,
    totalLabel: { padding: '8px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontSize: '9pt' } as React.CSSProperties,
    totalVal: { padding: '8px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontSize: '11pt', color: '#4f46e5', fontWeight: 'bold' } as React.CSSProperties,
    signature: { display: 'flex', justifyContent: 'space-between', marginTop: '36px', fontSize: '8pt', color: '#475569' } as React.CSSProperties,
    sigBlock: { textAlign: 'center', width: '200px' } as React.CSSProperties,
    sigLine: { borderTop: '1px solid #94a3b8', paddingTop: '4px', marginTop: '4px' } as React.CSSProperties,
    cachetImg: { width: '76px', marginBottom: '4px', display: 'block', marginLeft: 'auto', marginRight: 'auto' } as React.CSSProperties,
    bodyText: { fontSize: '10pt', lineHeight: '2', textAlign: 'justify', color: '#334155' } as React.CSSProperties,
    nameHighlight: { textAlign: 'center', fontSize: '12pt', fontWeight: 'bold', color: '#4f46e5', margin: '16px 0', padding: '10px', background: '#eef2ff', borderRadius: '6px' } as React.CSSProperties,
    recuBorder: { border: '2px solid #4f46e5', borderRadius: '12px', padding: '24px', background: 'linear-gradient(135deg, #fff 0%, #f8faff 100%)' } as React.CSSProperties,
    recuMontant: { fontSize: '16pt', fontWeight: 'bold', color: '#4f46e5', textAlign: 'right' as any } as React.CSSProperties,
    footer: { textAlign: 'center', fontSize: '7pt', color: '#cbd5e1', marginTop: '24px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' } as React.CSSProperties,
  };

  const renderDocument = () => {
    const appName = settings?.appName || "ELIKIA EKLESIA";
    const logo = settings?.appLogo || '⛪';
    const header = settings?.reportHeader || appName;
    const isImage = logo.startsWith('data:image');

    const HeaderBlock = () => (
      <div style={S.header}>
        {isImage ? <img src={logo} alt="" style={S.headerLogo} /> : <span style={{ fontSize: '28px' }}>{logo}</span>}
        <div style={S.headerText}>
          <div style={S.headerName}>{appName}</div>
          <div style={S.headerSub}>{header}</div>
        </div>
      </div>
    );

    const CachetBlock = () => settings?.cachetBase64
      ? <img src={settings.cachetBase64} alt="Cachet" style={S.cachetImg} />
      : null;

    if (docType === 'devis') {
      return (
        <div style={S.doc}>
          <HeaderBlock />
          <div style={S.title}>Devis</div>
          <div style={S.ref}>{ref}</div>
          <div style={S.infoBar}>
            <span><span style={S.infoLabel}>Client : </span><span style={S.infoVal}>{fields.client || '—'}</span></span>
            <span><span style={S.infoLabel}>Date : </span><span style={S.infoVal}>{formatDate(fields.date || new Date().toISOString().slice(0, 10))}</span></span>
          </div>
          <table style={S.table}>
            <thead><tr>
              <th style={{ ...S.th, width: '40px', textAlign: 'center' }}>N°</th>
              <th style={S.th}>Description</th>
              <th style={{ ...S.th, width: '60px', textAlign: 'right' }}>Qté</th>
              <th style={{ ...S.th, width: '100px', textAlign: 'right' }}>Prix unitaire</th>
              <th style={{ ...S.th, width: '100px', textAlign: 'right' }}>Total</th>
            </tr></thead>
            <tbody>
              {lignes.filter(l => l.description).map((l, i) => (
                <tr key={l.id}>
                  <td style={{ ...S.td, textAlign: 'center' }}>{i + 1}</td>
                  <td style={S.td}>{l.description}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{l.quantite}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{formatNumber(l.prixUnitaire)} FCFA</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 'bold' }}>{formatNumber(l.quantite * l.prixUnitaire)} FCFA</td>
                </tr>
              ))}
              <tr style={S.totalRow}>
                <td colSpan={4} style={S.totalLabel}>TOTAL</td>
                <td style={S.totalVal}>{formatNumber(totalDevis)} FCFA</td>
              </tr>
            </tbody>
          </table>
          {fields.validite && <div style={{ fontSize: '8pt', color: '#64748b', marginBottom: '12px' }}>Validité : {fields.validite} jours</div>}
          <div style={S.signature}>
            <div style={S.sigBlock}><div style={S.sigLine}>Signature</div></div>
            <div style={S.sigBlock}><CachetBlock /><div style={S.sigLine}>Cachet</div></div>
          </div>
          <div style={S.footer}>Document généré le {new Date().toLocaleDateString('fr-FR')} · {ref}</div>
        </div>
      );
    }

    if (docType === 'recu') {
      const montant = parseInt(fields.montant || '0');
      const typeRecu = fields.type || 'Dîme';
      return (
        <div style={S.doc}>
          <div style={S.recuBorder}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isImage ? <img src={logo} alt="" style={{ width: '40px' }} /> : <span style={{ fontSize: '24px' }}>{logo}</span>}
                <div>
                  <div style={{ fontSize: '12pt', fontWeight: 'bold', color: '#1e293b' }}>{appName}</div>
                  <div style={{ fontSize: '7pt', color: '#64748b' }}>{header}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '8pt', color: '#64748b' }}>N° {ref}</div>
                <div style={{ fontSize: '8pt', color: '#64748b' }}>{formatDate(fields.date || new Date().toISOString().slice(0, 10))}</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '7pt', textTransform: 'uppercase', letterSpacing: '3px', color: '#4f46e5', fontWeight: 'bold' }}>Reçu de {typeRecu}</div>
              <div style={S.recuMontant}>{montant ? formatNumber(montant) : '______'} FCFA</div>
            </div>
            <table style={{ width: '100%', fontSize: '9pt', lineHeight: '2.2', borderCollapse: 'collapse' }}>
              <tbody>
                <tr><td style={{ color: '#64748b', width: '120px' }}>Donateur</td><td style={{ fontWeight: 'bold', borderBottom: '1px dashed #cbd5e1' }}>{fields.donateur || '______________________'}</td></tr>
                <tr><td style={{ color: '#64748b' }}>Mois concerné</td><td style={{ fontWeight: 'bold', borderBottom: '1px dashed #cbd5e1' }}>{fields.mois || '______________________'}</td></tr>
                <tr><td style={{ color: '#64748b' }}>Montant en lettres</td><td style={{ fontStyle: 'italic', borderBottom: '1px dashed #cbd5e1' }}>{montant ? `${formatNumber(montant)} francs CFA` : '______________________'}</td></tr>
              </tbody>
            </table>
            {fields.notes && <div style={{ marginTop: '10px', fontSize: '8pt', fontStyle: 'italic', color: '#64748b' }}>Note : {fields.notes}</div>}
            <div style={S.signature}>
              <div style={S.sigBlock}><div style={S.sigLine}>Signature du donateur</div></div>
              <div style={S.sigBlock}><CachetBlock /><div style={S.sigLine}>Cachet de l'église</div></div>
            </div>
          </div>
          <div style={S.footer}>Document généré le {new Date().toLocaleDateString('fr-FR')} · {ref}</div>
        </div>
      );
    }

    const isAttestation = docType === 'attestation';
    return (
      <div style={S.doc}>
        <HeaderBlock />
        <div style={S.title}>{isAttestation ? 'Attestation' : 'Certificat'}</div>
        <div style={S.ref}>{ref}</div>
        <div style={S.infoBar}>
          <span><span style={S.infoLabel}>Bénéficiaire : </span><span style={S.infoVal}>{fields.nom || '—'}</span></span>
          <span><span style={S.infoLabel}>Type : </span><span style={S.infoVal}>{fields.type || '—'}</span></span>
        </div>
        <div style={S.bodyText}>
          <p>Je soussigné, représentant légal de <strong>{appName}</strong>, certifie que :</p>
          <div style={S.nameHighlight}>{fields.nom || '______________________'}</div>
          <p>
            {isAttestation
              ? `a participé / été présent(e) au titre de ${fields.type || '...'} au sein de notre église.`
              : `est membre de notre église au titre de ${fields.type || '...'}.`}
          </p>
          <p>Fait à Brazzaville, le {formatDate(fields.date || new Date().toISOString().slice(0, 10))}.</p>
          {fields.texte && <p style={{ fontStyle: 'italic', marginTop: '12px', color: '#475569' }}>« {fields.texte} »</p>}
        </div>
        <div style={S.signature}>
          <div style={S.sigBlock}><div style={S.sigLine}>Signature du bénéficiaire</div></div>
          <div style={S.sigBlock}><CachetBlock /><div style={S.sigLine}>Cachet et signature</div></div>
        </div>
        <div style={S.footer}>Document généré le {new Date().toLocaleDateString('fr-FR')} · {ref}</div>
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

            {/* Devis lines */}
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

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button onClick={() => setPreview(true)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all">
                <FileText className="w-3.5 h-3.5" /> Aperçu
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Preview */
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Aperçu — {doc.label}</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setPreview(false)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 border border-slate-200 rounded-lg cursor-pointer">
                <X className="w-3.5 h-3.5" /> Modifier
              </button>
              <button onClick={downloadPDF}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all min-h-[44px]">
                <Download className="w-3.5 h-3.5" /> Télécharger PDF
              </button>
              <button onClick={() => window.print()}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all min-h-[44px]">
                <Printer className="w-3.5 h-3.5" /> Imprimer
              </button>
            </div>
          </div>

          <div ref={printRef} className="print-area bg-white">
            <style>{`
              @media print {
                body { margin: 0; padding: 20px; }
                .print-area { margin: 0; }
                .no-print { display: none !important; }
              }
            `}</style>
            {renderDocument()}
          </div>
        </div>
      )}
    </div>
  );
}
