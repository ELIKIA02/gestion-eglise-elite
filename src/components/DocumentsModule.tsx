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

  const renderDocument = () => {
    const appName = settings?.appName || "Gestion d'Église Élite";
    const logo = settings?.appLogo || '†';
    const header = settings?.reportHeader || appName;
    const isImage = logo.startsWith('data:image');

    if (docType === 'devis') {
      return (
        <div style={{ fontFamily: "'Calibri', Arial, sans-serif", color: '#1e293b', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
          {/* En-tête */}
          <div style={{ textAlign: 'center', borderBottom: '3px double #4f46e5', paddingBottom: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '6px' }}>
              {isImage ? <img src={logo} alt="" style={{ width: '40px', height: '40px', objectFit: 'contain' }} /> : <span style={{ fontSize: '28px' }}>{logo}</span>}
              <span style={{ fontSize: '18pt', fontWeight: 'bold', color: '#4f46e5' }}>{appName}</span>
            </div>
            <div style={{ fontSize: '9pt', color: '#64748b', whiteSpace: 'pre-wrap', maxWidth: '500px', margin: '0 auto' }}>{header}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '10pt' }}>
            <div><strong>Devis N° :</strong> {ref}</div>
            <div><strong>Date :</strong> {formatDate(fields.date || new Date().toISOString().slice(0, 10))}</div>
          </div>

          {fields.client && <div style={{ marginBottom: '16px', fontSize: '10pt' }}><strong>Client :</strong> {fields.client}</div>}

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt', marginBottom: '16px' }}>
            <thead>
              <tr style={{ backgroundColor: '#4f46e5', color: '#fff' }}>
                <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #cbd5e1' }}>N°</th>
                <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #cbd5e1' }}>Description</th>
                <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #cbd5e1' }}>Qté</th>
                <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #cbd5e1' }}>Prix unitaire</th>
                <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #cbd5e1' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {lignes.filter(l => l.description).map((l, i) => (
                <tr key={l.id}>
                  <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>{l.description}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{l.quantite}</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{formatNumber(l.prixUnitaire)} FCFA</td>
                  <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{formatNumber(l.quantite * l.prixUnitaire)} FCFA</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 'bold', backgroundColor: '#f8fafc' }}>
                <td colSpan={4} style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>TOTAL</td>
                <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', color: '#4f46e5' }}>{formatNumber(totalDevis)} FCFA</td>
              </tr>
            </tbody>
          </table>

          {fields.validite && <div style={{ fontSize: '9pt', color: '#64748b', marginBottom: '16px' }}>Validité : {fields.validite} jours</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', fontSize: '10pt' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #1e293b', paddingTop: '4px', width: '200px' }}>Cachet et signature</div>
            </div>
          </div>
        </div>
      );
    }

    if (docType === 'recu') {
      const montant = parseInt(fields.montant || '0');
      return (
        <div style={{ fontFamily: "'Calibri', Arial, sans-serif", color: '#1e293b', maxWidth: '600px', margin: '0 auto', padding: '20px', border: '2px solid #1e293b' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #1e293b', paddingBottom: '10px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
              {isImage ? <img src={logo} alt="" style={{ width: '32px' }} /> : <span style={{ fontSize: '24px' }}>{logo}</span>}
              <span style={{ fontSize: '16pt', fontWeight: 'bold' }}>{appName}</span>
            </div>
            <div style={{ fontSize: '8pt', color: '#64748b', whiteSpace: 'pre-wrap' }}>{header}</div>
          </div>
          <h2 style={{ textAlign: 'center', fontSize: '14pt', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '2px' }}>Reçu de {fields.type || 'Dîme'}</h2>
          <table style={{ width: '100%', fontSize: '10pt', lineHeight: '2' }}>
            <tbody>
              <tr><td style={{ fontWeight: 'bold', width: '140px' }}>Référence :</td><td>{ref}</td></tr>
              <tr><td style={{ fontWeight: 'bold' }}>Date :</td><td>{formatDate(fields.date || new Date().toISOString().slice(0, 10))}</td></tr>
              <tr><td style={{ fontWeight: 'bold' }}>Donateur :</td><td>{fields.donateur || '______________________'}</td></tr>
              <tr><td style={{ fontWeight: 'bold' }}>Montant :</td><td style={{ fontSize: '12pt', fontWeight: 'bold', color: '#4f46e5' }}>{montant ? formatNumber(montant) : '______'} FCFA</td></tr>
              <tr><td style={{ fontWeight: 'bold' }}>Mois :</td><td>{fields.mois || '______________________'}</td></tr>
            </tbody>
          </table>
          {fields.notes && <div style={{ marginTop: '12px', fontSize: '9pt', fontStyle: 'italic', color: '#64748b' }}>{fields.notes}</div>}
          <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', fontSize: '9pt' }}>
            <div style={{ textAlign: 'center' }}><div style={{ borderTop: '1px solid #1e293b', paddingTop: '4px', width: '180px' }}>Signature du donateur</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ borderTop: '1px solid #1e293b', paddingTop: '4px', width: '180px' }}>Cachet de l'église</div></div>
          </div>
        </div>
      );
    }

    // Certificat / Attestation
    const isAttestation = docType === 'attestation';
    return (
      <div style={{ fontFamily: "'Calibri', Arial, sans-serif", color: '#1e293b', maxWidth: '700px', margin: '0 auto', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '6px' }}>
            {isImage ? <img src={logo} alt="" style={{ width: '40px' }} /> : <span style={{ fontSize: '28px' }}>{logo}</span>}
            <span style={{ fontSize: '18pt', fontWeight: 'bold' }}>{appName}</span>
          </div>
          <div style={{ fontSize: '9pt', color: '#64748b', whiteSpace: 'pre-wrap' }}>{header}</div>
        </div>

        <h2 style={{ textAlign: 'center', fontSize: '16pt', textTransform: 'uppercase', letterSpacing: '3px', margin: '0 0 8px', color: '#4f46e5' }}>
          {isAttestation ? "Attestation" : "Certificat"}
        </h2>
        <div style={{ textAlign: 'center', fontSize: '9pt', color: '#64748b', marginBottom: '24px' }}>{ref}</div>

        <div style={{ fontSize: '10pt', lineHeight: '2', textAlign: 'justify' }}>
          <p>Je soussigné, représentant légal de <strong>{appName}</strong>, certifie que :</p>
          <p style={{ textAlign: 'center', fontSize: '11pt', margin: '16px 0' }}>
            <strong>{fields.nom || '______________________'}</strong>
          </p>
          {isAttestation ? (
            <p>a participé / été présent(e) au titre de <strong>{fields.type || '...'}</strong> au sein de notre église.</p>
          ) : (
            <p>est membre de notre église au titre de <strong>{fields.type || '...'}</strong>.</p>
          )}
          <p>Fait à Brazzaville, le {formatDate(fields.date || new Date().toISOString().slice(0, 10))}.</p>
          {fields.texte && <p style={{ fontStyle: 'italic', marginTop: '12px' }}>{fields.texte}</p>}
        </div>

        <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', fontSize: '9pt' }}>
          <div style={{ textAlign: 'center' }}><div style={{ borderTop: '1px solid #1e293b', paddingTop: '4px', width: '200px' }}>Signature du bénéficiaire</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ borderTop: '1px solid #1e293b', paddingTop: '4px', width: '200px' }}>Cachet et signature du pasteur</div></div>
        </div>
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
              <button onClick={() => window.print()}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all">
                <Printer className="w-3.5 h-3.5" /> Imprimer / PDF
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
