import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, query, onSnapshot, db } from '../firebase';
import { Member, ChurchSettings } from '../types';
import { Church, Search, Plus, Printer, FileText } from 'lucide-react';

interface SacramentsModuleProps {
  members: Member[];
  settings: ChurchSettings | null;
}

interface SacramentEntry {
  id: string;
  type: 'Baptême' | 'Mariage' | 'Profession de foi' | 'Dédicace';
  memberName: string;
  memberId?: string;
  date: string;
  location: string;
  officiant: string;
  witnesses?: string;
  notes?: string;
  certificateNumber: string;
  createdAt: string;
}

const SACRAMENT_TYPES = ['Baptême', 'Mariage', 'Profession de foi', 'Dédicace'] as const;
const COLLECTION = 'church_sacraments';

let certCounter = 0;

function generateCertNumber(): string {
  const year = new Date().getFullYear();
  return `CERT-${year}-${String(++certCounter).padStart(4, '0')}`;
}

export default function SacramentsModule({ members, settings }: SacramentsModuleProps) {
  const [entries, setEntries] = useState<SacramentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Nouveau' | 'Registre'>('Nouveau');
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

  const [formData, setFormData] = useState({
    type: 'Baptême' as SacramentEntry['type'],
    memberName: '',
    memberId: '',
    date: new Date().toISOString().substring(0, 10),
    location: '',
    officiant: '',
    witnesses: '',
    notes: '',
    certificateNumber: generateCertNumber(),
  });

  useEffect(() => {
    const ref = collection(db, COLLECTION);
    const qRef = query(ref);
    const unsub = onSnapshot(qRef, (snapshot) => {
      const data: SacramentEntry[] = [];
      snapshot.forEach((doc: any) => {
        const d = doc.data();
        data.push({ id: doc.id, ...d });
      });
      data.sort((a, b) => b.createdAt?.localeCompare?.(a.createdAt) || 0);
      setEntries(data);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (filterType && e.type !== filterType) return false;
      if (searchQuery && !e.memberName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [entries, filterType, searchQuery]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members.slice(0, 10);
    return members.filter(m =>
      m.name.toLowerCase().includes(memberSearch.toLowerCase())
    ).slice(0, 10);
  }, [members, memberSearch]);

  const resetForm = () => {
    setFormData({
      type: 'Baptême',
      memberName: '',
      memberId: '',
      date: new Date().toISOString().substring(0, 10),
      location: '',
      officiant: '',
      witnesses: '',
      notes: '',
      certificateNumber: generateCertNumber(),
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.memberName.trim() || !formData.date || !formData.officiant.trim()) return;

    setSaving(true);
    try {
      await addDoc(collection(db, COLLECTION), {
        type: formData.type,
        memberName: formData.memberName,
        memberId: formData.memberId || '',
        date: formData.date,
        location: formData.location,
        officiant: formData.officiant,
        witnesses: formData.witnesses,
        notes: formData.notes,
        certificateNumber: formData.certificateNumber || generateCertNumber(),
        createdAt: new Date().toISOString(),
      });
      resetForm();
    } catch (err) {
      console.error('Error saving sacrament:', err);
    } finally {
      setSaving(false);
    }
  };

  const handlePrintCertificate = (entry: SacramentEntry) => {
    const churchName = settings?.appName || 'Église Évangélique';
    const logo = settings?.appLogo || '';

    const certHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Certificat - ${entry.type}</title>
  <style>
    @page { size: A4 portrait; margin: 20mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      color: #1e293b;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .certificate {
      width: 100%;
      max-width: 210mm;
      border: 8px double #cbd5e1;
      padding: 40px 50px;
      text-align: center;
      background: #fafbfd;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .logo { margin-bottom: 16px; }
    .logo img { max-height: 90px; }
    .church-name { font-size: 22px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #1e293b; margin-bottom: 4px; }
    .cert-title { font-size: 28px; font-weight: 800; color: #4f46e5; margin: 20px 0; text-transform: uppercase; letter-spacing: 2px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
    .cert-number { font-size: 12px; color: #64748b; margin-bottom: 24px; }
    .content { font-size: 16px; line-height: 2; }
    .content strong { color: #1e293b; }
    .content .member-name { font-size: 22px; font-weight: 700; color: #4f46e5; }
    .detail-row { margin: 6px 0; }
    .footer { margin-top: 36px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; }
    .footer .officiant { font-weight: 700; color: #1e293b; font-size: 15px; }
    .footer .location { margin-top: 4px; }
    .separator { width: 60px; height: 2px; background: #cbd5e1; margin: 16px auto; }
  </style>
</head>
<body>
  <div class="certificate">
    ${logo ? `<div class="logo"><img src="${logo}" alt="${churchName}" /></div>` : ''}
    <div class="church-name">${churchName}</div>
    <div class="cert-title">Certificat de ${entry.type}</div>
    <div class="cert-number">N° ${entry.certificateNumber}</div>
    <div class="separator"></div>
    <div class="content">
      <p>Je soussigné, <strong>${entry.officiant}</strong>,</p>
      <p>certifie que</p>
      <p class="member-name">${entry.memberName}</p>
      <p>a reçu le sacrement de <strong>${entry.type}</strong></p>
      <p class="detail-row">le <strong>${new Date(entry.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>
      ${entry.location ? `<p class="detail-row">à <strong>${entry.location}</strong></p>` : ''}
      ${entry.witnesses ? `<p class="detail-row">Témoins : ${entry.witnesses}</p>` : ''}
    </div>
    <div class="separator"></div>
    <div class="footer">
      <div>Fait pour valoir ce que de droit.</div>
      <div class="officiant">${entry.officiant}</div>
      <div class="location">${churchName} - ${new Date().toLocaleDateString('fr-FR')}</div>
    </div>
  </div>
  <script>window.print();<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(certHtml);
      win.document.close();
    }
  };

  const typeBadgeStyle = (type: string) => {
    const map: Record<string, string> = {
      'Baptême': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
      'Mariage': 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
      'Profession de foi': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
      'Dédicace': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    };
    return map[type] || 'bg-slate-100 text-slate-800';
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-xl text-slate-800 dark:text-slate-200 font-bold tracking-tight">Registre des Sacrements</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Baptêmes, mariages, professions de foi et dédicaces</p>
      </div>

      <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 w-fit">
        {(['Nouveau', 'Registre'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === tab
                ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab === 'Nouveau' ? <Plus className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Nouveau' && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm space-y-4">
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2">
            <Church className="w-4 h-4 text-indigo-600" />
            Nouvelle inscription sacramentelle
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Type de sacrement *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as SacramentEntry['type'] })}
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600"
              >
                {SACRAMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">N° de certificat</label>
              <input
                type="text"
                value={formData.certificateNumber}
                onChange={(e) => setFormData({ ...formData, certificateNumber: e.target.value })}
                placeholder="CERT-YYYY-XXXX"
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600"
              />
            </div>
          </div>

          <div className="space-y-1 relative">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Membre *</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => { setMemberSearch(e.target.value); setShowMemberDropdown(true); }}
                onFocus={() => setShowMemberDropdown(true)}
                placeholder="Rechercher un membre..."
                className="w-full text-sm pl-8 p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600"
              />
            </div>
            {showMemberDropdown && (
              <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filteredMembers.length === 0 ? (
                  <div className="p-3 text-xs text-slate-400">Aucun membre trouvé</div>
                ) : (
                  filteredMembers.map(m => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => {
                        setFormData({ ...formData, memberName: m.name, memberId: m.id || '' });
                        setMemberSearch(m.name);
                        setShowMemberDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      {m.name}
                    </button>
                  ))
                )}
              </div>
            )}
            {formData.memberName && !showMemberDropdown && (
              <div className="mt-1 text-xs text-indigo-600 font-medium">{formData.memberName}</div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Date *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Lieu</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Ex : Temple, Paroisse..."
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Officiant *</label>
              <input
                type="text"
                required
                value={formData.officiant}
                onChange={(e) => setFormData({ ...formData, officiant: e.target.value })}
                placeholder="Pasteur..."
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Témoins</label>
              <textarea
                value={formData.witnesses}
                onChange={(e) => setFormData({ ...formData, witnesses: e.target.value })}
                rows={3}
                placeholder="Noms des témoins..."
                className="w-full text-xs p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Observations..."
                className="w-full text-xs p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={resetForm}
              className="text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-1.5 rounded-md text-sm transition-all cursor-pointer font-medium"
            >
              Réinitialiser
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm font-semibold transition-all cursor-pointer border border-indigo-500 shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'Registre' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-wrap gap-1.5 items-center">
              <button
                onClick={() => setFilterType('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  !filterType ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                Tous
              </button>
              {SACRAMENT_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filterType === t ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="relative sm:ml-auto">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un membre..."
                className="w-full sm:w-56 text-sm pl-8 p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-slate-500 dark:text-slate-400 py-6 text-center text-xs">Chargement...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 text-center py-12 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 text-sm">
              Aucune inscription trouvée.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50">
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">N°</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Certificat</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Membre</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Officiant</th>
                      <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry, idx) => (
                      <React.Fragment key={entry.id}>
                        <tr
                          onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                          className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-700 dark:text-slate-300">{entry.certificateNumber}</td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">{entry.memberName}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${typeBadgeStyle(entry.type)}`}>{entry.type}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{entry.date}</td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{entry.officiant}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePrintCertificate(entry); }}
                              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-2 py-1 rounded-md transition-all cursor-pointer"
                              title="Imprimer le certificat"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Certificat
                            </button>
                          </td>
                        </tr>
                        {expandedId === entry.id && (
                          <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                                <div>
                                  <span className="font-semibold text-slate-500 dark:text-slate-400 block text-[10px] uppercase tracking-wider">Lieu</span>
                                  <span className="text-slate-700 dark:text-slate-300">{entry.location || '—'}</span>
                                </div>
                                <div>
                                  <span className="font-semibold text-slate-500 dark:text-slate-400 block text-[10px] uppercase tracking-wider">Témoins</span>
                                  <span className="text-slate-700 dark:text-slate-300">{entry.witnesses || '—'}</span>
                                </div>
                                <div>
                                  <span className="font-semibold text-slate-500 dark:text-slate-400 block text-[10px] uppercase tracking-wider">Notes</span>
                                  <span className="text-slate-700 dark:text-slate-300">{entry.notes || '—'}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
