import React, { useState, useMemo, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, db } from '../firebase';
import { Member, TitheRecord } from '../types';
import { HandCoins, Search, Printer, Plus } from 'lucide-react';

interface TithesModuleProps {
  members: Member[];
}

const TITHE_TYPES = ['Dîme', 'Offrande', 'Don'] as const;

const formatFCFA = (amount: number) => {
  return Math.round(amount).toLocaleString('fr-FR') + ' FCFA';
};

export default function TithesModule({ members }: TithesModuleProps) {
  const [activeTab, setActiveTab] = useState<'ajouter' | 'releves'>('ajouter');
  const [records, setRecords] = useState<TitheRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<string>(String(currentYear));

  const [form, setForm] = useState({
    memberId: '',
    memberName: '',
    amount: '',
    date: new Date().toISOString().substring(0, 10),
    type: 'Dîme' as typeof TITHE_TYPES[number],
    notes: ''
  });

  const [searchMember, setSearchMember] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

  const [filterMember, setFilterMember] = useState('');
  const [filterMemberSearch, setFilterMemberSearch] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'church_tithes')),
      (snapshot) => {
        const data: TitheRecord[] = [];
        snapshot.forEach((doc) => {
          const d = doc.data();
          data.push({
            id: doc.id,
            memberId: d.memberId || '',
            memberName: d.memberName || '',
            amount: d.amount || 0,
            date: d.date || '',
            type: d.type || 'Dîme',
            notes: d.notes || '',
            createdAt: d.createdAt || ''
          });
        });
        setRecords(data.sort((a, b) => b.date.localeCompare(a.date)));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const filteredMembers = useMemo(() => {
    const q = searchMember.toLowerCase();
    return members.filter(m =>
      (m.name || '').toLowerCase().includes(q) || (m.phone || '').includes(q)
    ).slice(0, 10);
  }, [members, searchMember]);

  const filteredFilterMembers = useMemo(() => {
    const q = filterMemberSearch.toLowerCase();
    return members.filter(m =>
      (m.name || '').toLowerCase().includes(q) || (m.phone || '').includes(q)
    ).slice(0, 10);
  }, [members, filterMemberSearch]);

  const memberNames = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach(m => { if (m.id) map.set(m.id, m.name); });
    return map;
  }, [members]);

  const selectedMemberName = form.memberId ? memberNames.get(form.memberId) || '' : '';

  const handleSelectMember = (id: string, name: string) => {
    setForm({ ...form, memberId: id, memberName: name });
    setSearchMember(name);
    setShowMemberDropdown(false);
  };

  const handleSelectFilterMember = (id: string, name: string) => {
    setFilterMember(id);
    setFilterMemberSearch(name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(form.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Veuillez saisir un montant valide supérieur à 0 FCFA.");
      return;
    }
    if (!form.memberId) {
      alert("Veuillez sélectionner un membre.");
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'church_tithes'), {
        memberId: form.memberId,
        memberName: form.memberName,
        amount: parsedAmount,
        date: form.date,
        type: form.type,
        notes: form.notes || '',
        createdAt: new Date().toISOString()
      });
      setSuccessMsg("L'enregistrement a été ajouté avec succès.");
      setTimeout(() => setSuccessMsg(null), 4000);
      setForm({
        memberId: '',
        memberName: '',
        amount: '',
        date: new Date().toISOString().substring(0, 10),
        type: 'Dîme',
        notes: ''
      });
      setSearchMember('');
    } catch {
      alert("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchMember = !filterMember || r.memberId === filterMember;
      const matchYear = yearFilter === 'all' || r.date.startsWith(yearFilter);
      return matchMember && matchYear;
    });
  }, [records, filterMember, yearFilter]);

  const totalDisplayed = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + r.amount, 0);
  }, [filteredRecords]);

  const annualSummary = useMemo(() => {
    const summary: { [memberId: string]: { name: string; total: number } } = {};
    filteredRecords.forEach(r => {
      if (!summary[r.memberId]) {
        summary[r.memberId] = { name: r.memberName, total: 0 };
      }
      summary[r.memberId].total += r.amount;
    });
    return Object.entries(summary).sort((a, b) => b[1].total - a[1].total);
  }, [filteredRecords]);

  const years = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      const y = r.date.substring(0, 4);
      if (y) set.add(y);
    });
    return Array.from(set).sort((a, b) => parseInt(b) - parseInt(a));
  }, [records]);

  const handlePrint = (memberId: string, memberName: string) => {
    const memberRecords = records.filter(r => r.memberId === memberId);
    const year = yearFilter === 'all' ? currentYear.toString() : yearFilter;
    const yearRecords = memberRecords.filter(r => r.date.startsWith(year));
    const total = yearRecords.reduce((s, r) => s + r.amount, 0);

    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`
      <html>
      <head>
        <title>Relevé de ${memberName} - ${year}</title>
        <style>
          body { font-family: 'Courier New', monospace; padding: 30px; font-size: 13px; }
          h1 { font-size: 18px; text-align: center; margin-bottom: 5px; }
          h2 { font-size: 14px; text-align: center; color: #555; margin-top: 0; font-weight: normal; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #4F46E5; color: white; padding: 8px 10px; text-align: left; font-size: 12px; }
          td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
          .total-row { font-weight: bold; background: #f3f4f6; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #888; }
          .amount { text-align: right; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>ÉGLISE - RELEVÉ ANNUEL</h1>
        <h2>Membre: ${memberName} — Année ${year}</h2>
        <table>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Notes</th><th style="text-align:right">Montant</th></tr>
          </thead>
          <tbody>
            ${yearRecords.map(r => `
              <tr>
                <td>${r.date}</td>
                <td>${r.type}</td>
                <td>${r.notes || '—'}</td>
                <td class="amount">${formatFCFA(r.amount)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3">TOTAL ANNUEL</td>
              <td class="amount">${formatFCFA(total)}</td>
            </tr>
          </tbody>
        </table>
        <div class="footer">
          Relevé généré le ${new Date().toLocaleDateString('fr-FR')} — République du Congo
        </div>
        <script>
          window.onload = function() { window.print(); window.close(); };
        <\/script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl text-slate-800 dark:text-slate-200 font-bold tracking-tight flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Dîmes & Offrandes
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Suivi individualisé des dîmes, offrandes et dons des membres.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-250 dark:border-emerald-800 p-3 rounded-lg flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300 animate-fade-in shadow-3xs font-medium">
          <span>{successMsg}</span>
        </div>
      )}

      <div className="border-b border-slate-200 dark:border-slate-600 flex gap-4 text-xs font-bold overflow-x-auto shrink-0 pb-1">
        <button
          onClick={() => setActiveTab('ajouter')}
          className={`pb-2.5 px-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'ajouter'
              ? 'border-b-2 border-indigo-650 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400 font-bold'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter
        </button>
        <button
          onClick={() => setActiveTab('releves')}
          className={`pb-2.5 px-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'releves'
              ? 'border-b-2 border-indigo-650 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400 font-bold'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          Relevés
        </button>
      </div>

      {activeTab === 'ajouter' && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm space-y-4 animate-fade-in">
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-500" />
            Nouvel enregistrement
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 relative">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Membre *</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchMember}
                  onChange={(e) => { setSearchMember(e.target.value); setShowMemberDropdown(true); setForm({ ...form, memberId: '', memberName: '' }); }}
                  onFocus={() => setShowMemberDropdown(true)}
                  placeholder="Rechercher par nom ou téléphone..."
                  className="w-full text-xs p-2.5 pl-8 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-indigo-600 dark:focus:outline-indigo-400 text-slate-800 dark:text-slate-200"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
              </div>
              {showMemberDropdown && searchMember && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredMembers.length === 0 ? (
                    <div className="p-2 text-xs text-slate-400">Aucun membre trouvé</div>
                  ) : (
                    filteredMembers.map(m => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => handleSelectMember(m.id!, m.name)}
                        className="w-full text-left p-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        {m.name} — {m.phone}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Montant (FCFA) *</label>
              <input
                type="number"
                step="1"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="Ex: 5000"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-indigo-600 dark:focus:outline-indigo-400 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Date</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-indigo-600 dark:focus:outline-indigo-400 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Type *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as typeof TITHE_TYPES[number] })}
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-indigo-600 dark:focus:outline-indigo-400 text-slate-800 dark:text-slate-200"
              >
                {TITHE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Observations (optionnel)"
              rows={2}
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-indigo-600 dark:focus:outline-indigo-400 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border border-indigo-500 shadow-xs"
            >
              {saving ? "Sauvegarde..." : "Enregistrer"}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'releves' && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={filterMemberSearch}
                onChange={(e) => { setFilterMemberSearch(e.target.value); setFilterMember(''); }}
                placeholder="Filtrer par membre..."
                className="w-full text-xs p-2 pl-8 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-indigo-600 dark:focus:outline-indigo-400 text-slate-800 dark:text-slate-200"
              />
              {filterMemberSearch && !filterMember && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredFilterMembers.length === 0 ? (
                    <div className="p-2 text-xs text-slate-400">Aucun membre</div>
                  ) : (
                    filteredFilterMembers.map(m => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => handleSelectFilterMember(m.id!, m.name)}
                        className="w-full text-left p-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        {m.name} — {m.phone}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-indigo-600 dark:focus:outline-indigo-400 text-slate-800 dark:text-slate-200"
              >
                <option value="all">Toutes les années</option>
                {[...new Set([currentYear, currentYear - 1, ...years.map(Number)])].sort((a, b) => b - a).map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 font-semibold animate-pulse">
              Chargement des relevés...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl space-y-2 text-slate-450 dark:text-slate-500">
              <HandCoins className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm">Aucun enregistrement trouvé.</p>
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200/90 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                        <th className="p-3">Date</th>
                        <th className="p-3">Membre</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Notes</th>
                        <th className="p-3 text-right">Montant</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                      {filteredRecords.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors">
                          <td className="p-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{r.date}</td>
                          <td className="p-3 font-semibold">{r.memberName}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] inline-block ${
                              r.type === 'Dîme' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700' :
                              r.type === 'Offrande' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700' :
                              'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700'
                            }`}>
                              {r.type}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{r.notes || '—'}</td>
                          <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatFCFA(r.amount)}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handlePrint(r.memberId, r.memberName)}
                              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 p-1.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all cursor-pointer"
                              title="Imprimer le relevé"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 px-1">
                <span>{filteredRecords.length} enregistrement(s) — Total: {formatFCFA(totalDisplayed)}</span>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm p-5 space-y-3">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <HandCoins className="w-4 h-4 text-indigo-500" />
                  Répartition annuelle par membre
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200/90 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                        <th className="p-3">Membre</th>
                        <th className="p-3 text-right">Total</th>
                        <th className="p-3 text-center">Relevé</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                      {annualSummary.map(([id, data]) => (
                        <tr key={id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors">
                          <td className="p-3 font-semibold">{data.name}</td>
                          <td className="p-3 text-right font-bold text-indigo-700 dark:text-indigo-400">{formatFCFA(data.total)}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handlePrint(id, data.name)}
                              className="flex items-center gap-1.5 mx-auto text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                            >
                              <Printer className="w-3 h-3" />
                              Imprimer relevé
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
