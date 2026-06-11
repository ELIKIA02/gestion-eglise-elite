import React, { useMemo, useState } from 'react';
import { FinanceTransaction, ChurchEvent, Member, ChurchSettings } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { FileDown, Printer, TrendingUp, Users, DollarSign, Calendar, Download, Filter } from 'lucide-react';

interface ReportsModuleProps {
  transactions: FinanceTransaction[];
  events: ChurchEvent[];
  members: Member[];
  settings: ChurchSettings | null;
}

const COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#3B82F6", "#EC4899", "#14B8A6", "#8B5CF6", "#F97316"];

const formatFCFA = (amount: number) => Math.round(amount).toLocaleString('fr-FR') + ' FCFA';

export default function ReportsModule({ transactions, events, members, settings }: ReportsModuleProps) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const years = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => set.add(t.date.substring(0, 4)));
    events.forEach(e => set.add(e.date.substring(0, 4)));
    return Array.from(set).sort().reverse();
  }, [transactions, events]);

  const reportStats = useMemo(() => {
    const now = new Date();
    const currentYear = parseInt(selectedYear);

    const activeMembers = members.filter(m => m.status === 'Actif').length;
    const observationMembers = members.filter(m => m.status === 'En observation').length;

    let annualRevenue = 0, annualExpense = 0, tithesTotal = 0, offeringsTotal = 0;

    transactions.forEach(t => {
      const year = parseInt(t.date.substring(0, 4));
      if (year === currentYear) {
        if (t.type === 'Revenu') {
          annualRevenue += t.amount;
          if (t.category.includes('Dîme')) tithesTotal += t.amount;
          if (t.category.includes('Offrande')) offeringsTotal += t.amount;
        } else {
          annualExpense += t.amount;
        }
      }
    });

    const yearEvents = events.filter(e => parseInt(e.date.substring(0, 4)) === currentYear);
    const totalAttendance = yearEvents.reduce((s, e) => s + (e.attendance || 0), 0);
    const avgAttendance = yearEvents.length > 0 ? Math.round(totalAttendance / yearEvents.length) : 0;

    // Monthly chart data
    const monthlyMap: Record<string, { name: string; Recettes: number; Dépenses: number }> = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${currentYear}-${String(m).padStart(2, '0')}`;
      const d = new Date(currentYear, m - 1, 1);
      monthlyMap[key] = { name: d.toLocaleString('fr', { month: 'short' }), Recettes: 0, Dépenses: 0 };
    }
    transactions.forEach(t => {
      const ym = t.date.substring(0, 7);
      if (monthlyMap[ym]) {
        if (t.type === 'Revenu') monthlyMap[ym].Recettes += t.amount;
        else monthlyMap[ym].Dépenses += t.amount;
      }
    });

    // Ministry distribution
    const ministryCount: Record<string, number> = {};
    members.forEach(m => {
      const key = m.ministry || 'Non assigné';
      ministryCount[key] = (ministryCount[key] || 0) + 1;
    });
    const ministryData = Object.entries(ministryCount).map(([name, value], i) => ({
      name, value, color: COLORS[i % COLORS.length]
    }));

    // Status distribution
    const statusCount: Record<string, number> = { Actif: 0, Inactif: 0, 'En observation': 0 };
    members.forEach(m => { if (statusCount[m.status] !== undefined) statusCount[m.status]++; });
    const statusData = Object.entries(statusCount).map(([name, value], i) => ({
      name, value, color: [COLORS[0], COLORS[2], COLORS[3]][i]
    }));

    return {
      currentYear,
      activeMembers, observationMembers,
      annualRevenue, annualExpense,
      netBalance: annualRevenue - annualExpense,
      tithesTotal, offeringsTotal,
      avgAttendance, totalServices: yearEvents.length,
      monthlyData: Object.values(monthlyMap),
      ministryData, statusData
    };
  }, [transactions, events, members, selectedYear]);

  // Exports
  const exportCSV = (type: 'finances' | 'members' | 'events') => {
    let csv = '';
    let filename = '';

    if (type === 'finances') {
      const headers = "Date,Type, Catégorie, Montant, Contributeur, Notes\n";
      csv = headers + transactions.map(t =>
        `${t.date},${t.type},"${t.category}","${(t.contributor || '').replace(/"/g, '""')}",${t.amount},"${(t.notes || '').replace(/"/g, '""')}"`
      ).join('\n');
      filename = `comptabilite_${selectedYear}.csv`;
    } else if (type === 'members') {
      const headers = "Nom,Email,Téléphone,Statut,Ministère,Créé le\n";
      csv = headers + members.map(m =>
        `"${m.name}","${m.email}","${m.phone}",${m.status},"${m.ministry}",${new Date(m.createdAt).toLocaleDateString()}`
      ).join('\n');
      filename = `membres_${selectedYear}.csv`;
    } else {
      const headers = "Date,Titre,Type,Participants,Prédicateur,Notes\n";
      csv = headers + events.map(e =>
        `${e.date},"${e.title}",${e.type},${e.attendance || 0},"${e.preacher || ''}","${(e.notes || '').replace(/"/g, '""')}"`
      ).join('\n');
      filename = `evenements_${selectedYear}.csv`;
    }

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openPrintPreview = () => {
    const w = window.open('', '_blank');
    if (!w) return;

    const monthlyRows = reportStats.monthlyData.map(m =>
      `<tr><td>${m.name}</td><td>${formatFCFA(m.Recettes)}</td><td>${formatFCFA(m.Dépenses)}</td></tr>`
    ).join('');

    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rapport ${selectedYear}</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
        h1 { color: #800020; text-align: center; font-size: 24px; border-bottom: 2px solid #800020; padding-bottom: 10px; }
        h2 { color: #2c3e50; font-size: 16px; margin-top: 25px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        .header { text-align: center; border-bottom: 3px double #800020; padding-bottom: 15px; margin-bottom: 30px; }
        .kpis { display: flex; justify-content: space-between; margin: 20px 0; }
        .kpi { border: 1px solid #ddd; padding: 15px; border-radius: 8px; width: 30%; text-align: center; }
        .kpi-val { font-size: 20px; font-weight: bold; color: #800020; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #e0e0e0; padding: 8px; text-align: left; font-size: 12px; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .footer { margin-top: 50px; text-align: right; font-size: 11px; font-style: italic; }
      </style></head><body>
      <div class="header">
        <div style="font-size: 22px; font-weight: bold; color: #800020;">
          ${settings?.appLogo?.startsWith('data:image') ? `<img src="${settings.appLogo}" alt="Logo" style="width:40px;height:40px;object-fit:contain;vertical-align:middle;margin-right:8px;" />` : (settings?.appLogo || '†')} ${settings?.appName || 'Gestion d\'Église Élite'}
        </div>
        <div style="font-size: 11px; color: #4a5568; white-space: pre-wrap;">${settings?.reportHeader || 'Rapport paroissial'}</div>
      </div>
      <h1>Rapport Annuel ${selectedYear}</h1>
      <p style="text-align:center;font-size:10px;color:#718096;">Généré le ${new Date().toLocaleDateString('fr-FR')}</p>
      <div class="kpis">
        <div class="kpi"><div>Recettes</div><div class="kpi-val">${formatFCFA(reportStats.annualRevenue)}</div></div>
        <div class="kpi"><div>Dépenses</div><div class="kpi-val">${formatFCFA(reportStats.annualExpense)}</div></div>
        <div class="kpi"><div>Solde</div><div class="kpi-val">${formatFCFA(reportStats.netBalance)}</div></div>
      </div>
      <h2>Membres</h2>
      <p>Actifs : ${reportStats.activeMembers} · En observation : ${reportStats.observationMembers} · Total cultes : ${reportStats.totalServices}</p>
      <h2>Revenus</h2>
      <ul>
        <li>Dîmes : ${formatFCFA(reportStats.tithesTotal)}</li>
        <li>Offrandes : ${formatFCFA(reportStats.offeringsTotal)}</li>
        <li>Autres recettes : ${formatFCFA(reportStats.annualRevenue - reportStats.tithesTotal - reportStats.offeringsTotal)}</li>
      </ul>
      <h2>Détail Mensuel</h2>
      <table><thead><tr><th>Mois</th><th>Recettes</th><th>Dépenses</th></tr></thead><tbody>${monthlyRows}</tbody></table>
      <div class="footer">Signature du Secrétariat</div>
    </body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Rapports & Statistiques</h2>
          <p className="text-xs text-slate-500">Bilans annuels, graphiques et exports CSV</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white font-semibold"
          >
            {years.length > 0 ? years.map(y => (
              <option key={y} value={y}>{y}</option>
            )) : <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>}
          </select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-bold uppercase tracking-wider mb-1">
            <DollarSign className="w-3.5 h-3.5" /> Recettes
          </div>
          <span className="text-lg font-bold text-slate-900">{formatFCFA(reportStats.annualRevenue)}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-amber-600 text-[10px] font-bold uppercase tracking-wider mb-1">
            <TrendingUp className="w-3.5 h-3.5" /> Dépenses
          </div>
          <span className="text-lg font-bold text-slate-900">{formatFCFA(reportStats.annualExpense)}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-indigo-600 text-[10px] font-bold uppercase tracking-wider mb-1">
            <Users className="w-3.5 h-3.5" /> Membres actifs
          </div>
          <span className="text-lg font-bold text-slate-900">{reportStats.activeMembers}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-amber-600 text-[10px] font-bold uppercase tracking-wider mb-1">
            <Calendar className="w-3.5 h-3.5" /> Moy. assistance
          </div>
          <span className="text-lg font-bold text-slate-900">{reportStats.avgAttendance} / culte</span>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly financial trends */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Évolution financière mensuelle ({selectedYear})</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportStats.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatFCFA(v)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Recettes" fill="#4F46E5" radius={[4, 4, 0, 0]} name="Recettes" />
                <Bar dataKey="Dépenses" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Dépenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ministry distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Répartition par ministère</h3>
          {reportStats.ministryData.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-16">Aucun ministère renseigné</p>
          ) : (
            <div className="h-64 flex flex-col items-center">
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={reportStats.ministryData} cx="50%" cy="50%" innerRadius={30} outerRadius={55}
                      paddingAngle={3} dataKey="value" label={({ name, value }) => `${value}`}>
                      {reportStats.ministryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 justify-center text-[9px] mt-2">
                {reportStats.ministryData.map((e, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: e.color }} />
                    {e.name} ({e.value})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Statut des membres</h3>
          <div className="h-48 flex items-center gap-6">
            <div className="h-40 w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={reportStats.statusData} cx="50%" cy="50%" innerRadius={25} outerRadius={45}
                    paddingAngle={3} dataKey="value">
                    {reportStats.statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 text-xs">
              {reportStats.statusData.map((e, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                  <span className="font-semibold">{e.name}</span>
                  <span className="text-slate-500">{e.value} membres</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Revenue composition */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Composition des revenus</h3>
          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold">Dîmes</span>
                <span>{formatFCFA(reportStats.tithesTotal)}</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (reportStats.tithesTotal / (reportStats.annualRevenue || 1)) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold">Offrandes</span>
                <span>{formatFCFA(reportStats.offeringsTotal)}</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (reportStats.offeringsTotal / (reportStats.annualRevenue || 1)) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold">Autres recettes</span>
                <span>{formatFCFA(reportStats.annualRevenue - reportStats.tithesTotal - reportStats.offeringsTotal)}</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, (reportStats.annualRevenue - reportStats.tithesTotal - reportStats.offeringsTotal) / (reportStats.annualRevenue || 1)) * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Export cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button onClick={() => exportCSV('finances')}
          className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer text-left">
          <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-800 block">Finances CSV</span>
            <span className="text-[10px] text-slate-400">Écritures {selectedYear}</span>
          </div>
        </button>

        <button onClick={() => exportCSV('members')}
          className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer text-left">
          <div className="w-9 h-9 rounded-full bg-sky-50 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4 text-sky-600" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-800 block">Membres CSV</span>
            <span className="text-[10px] text-slate-400">{members.length} inscrits</span>
          </div>
        </button>

        <button onClick={() => exportCSV('events')}
          className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer text-left">
          <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4 text-amber-600" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-800 block">Événements CSV</span>
            <span className="text-[10px] text-slate-400">{events.length} cultes</span>
          </div>
        </button>

        <button onClick={openPrintPreview}
          className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer text-left">
          <div className="w-9 h-9 rounded-full bg-stone-50 flex items-center justify-center shrink-0">
            <Printer className="w-4 h-4 text-stone-700" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-800 block">Rapport papier</span>
            <span className="text-[10px] text-slate-400">Bilan {selectedYear}</span>
          </div>
        </button>
      </div>
    </div>
  );
}
