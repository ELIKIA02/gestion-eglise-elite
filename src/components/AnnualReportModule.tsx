import React, { useState, useMemo } from 'react';
import { Member, FinanceTransaction, ChurchEvent, ChurchSettings, SacramentRegister } from '../types';
import { FileText, Printer, BarChart3, TrendingUp } from 'lucide-react';

interface AnnualReportModuleProps {
  members: Member[];
  transactions: FinanceTransaction[];
  events: ChurchEvent[];
  settings: ChurchSettings | null;
}

const formatFCFA = (amount: number) => {
  return Math.round(amount).toLocaleString('fr-FR') + ' FCFA';
};

const formatNumber = (n: number) => n.toLocaleString('fr-FR');

export default function AnnualReportModule({ members, transactions, events, settings }: AnnualReportModuleProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let i = 0; i < 5; i++) years.push(currentYear - i);
    return years;
  }, [currentYear]);

  const sacraments: SacramentRegister[] = useMemo(() => {
    try {
      const data = localStorage.getItem('church_sacraments');
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  }, []);

  const stats = useMemo(() => {
    const totalMembres = members.length;
    const actifs = members.filter(m => m.status === 'Actif').length;
    const inactifs = members.filter(m => m.status === 'Inactif').length;
    const enObservation = members.filter(m => m.status === 'En observation').length;

    const yearStr = String(selectedYear);
    const yearTx = transactions.filter(t => t.date.startsWith(yearStr));
    const revenus = yearTx.filter(t => t.type === 'Revenu').reduce((s, t) => s + t.amount, 0);
    const depenses = yearTx.filter(t => t.type === 'Dépense').reduce((s, t) => s + t.amount, 0);

    const totalCultes = events.filter(e => e.date.startsWith(yearStr)).length;
    const nouveauxMembres = members.filter(m => m.arrivalDate?.startsWith(yearStr)).length;
    const baptemes = sacraments.filter(s => s.type === 'Baptême' && s.date.startsWith(yearStr)).length;
    const mariages = sacraments.filter(s => s.type === 'Mariage' && s.date.startsWith(yearStr)).length;

    const monthlyMap: Record<string, { month: string; revenus: number; depenses: number }> = {};
    for (let m = 0; m < 12; m++) {
      const mm = String(m + 1).padStart(2, '0');
      const key = `${yearStr}-${mm}`;
      const label = new Date(selectedYear, m).toLocaleString('fr-FR', { month: 'long' });
      monthlyMap[key] = { month: label, revenus: 0, depenses: 0 };
    }
    yearTx.forEach(t => {
      const ym = t.date.substring(0, 7);
      if (monthlyMap[ym]) {
        if (t.type === 'Revenu') monthlyMap[ym].revenus += t.amount;
        else monthlyMap[ym].depenses += t.amount;
      }
    });

    return {
      totalMembres, actifs, inactifs, enObservation,
      revenus, depenses, solde: revenus - depenses,
      totalCultes, nouveauxMembres, baptemes, mariages,
      monthlyData: Object.values(monthlyMap)
    };
  }, [members, transactions, events, sacraments, selectedYear]);

  const maxChartValue = useMemo(() => {
    let max = 0;
    stats.monthlyData.forEach(d => {
      if (d.revenus > max) max = d.revenus;
      if (d.depenses > max) max = d.depenses;
    });
    return max || 1;
  }, [stats.monthlyData]);

  const generatePDF = () => {
    const logo = settings?.appLogo?.startsWith('data:image')
      ? `<img src="${settings.appLogo}" alt="Logo" style="width:60px;height:60px;object-fit:contain;" />`
      : (settings?.appLogo || '');
    const name = settings?.appName || 'Église';
    const dateStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const monthRows = stats.monthlyData.map(d => `
      <tr>
        <td style="text-transform:capitalize;">${d.month}</td>
        <td style="text-align:right;">${formatFCFA(d.revenus)}</td>
        <td style="text-align:right;">${formatFCFA(d.depenses)}</td>
        <td style="text-align:right;font-weight:bold;color:${d.revenus - d.depenses >= 0 ? '#059669' : '#dc2626'};">${formatFCFA(d.revenus - d.depenses)}</td>
      </tr>
    `).join('');

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Rapport Annuel ${selectedYear} - ${name}</title>
<style>
  @page { size: A4; margin: 20mm 15mm; }
  @media print { body { font-size: 10pt; } }
  * { box-sizing: border-box; }
  body {
    font-family: 'Calibri', 'Helvetica Neue', Arial, sans-serif;
    font-size: 11pt; line-height: 1.6; color: #1e293b; margin: 0; padding: 0;
  }
  .report-header {
    text-align: center;
    border-bottom: 3px double #4f46e5;
    padding-bottom: 14px;
    margin-bottom: 28px;
  }
  .report-header .logo { margin-bottom: 8px; }
  .report-header .name { font-size: 18pt; font-weight: bold; color: #1e293b; }
  .report-header .subtitle { font-size: 14pt; font-weight: bold; color: #4f46e5; margin-top: 4px; }
  .report-header .date { font-size: 9pt; color: #64748b; margin-top: 4px; }
  h2 {
    font-size: 14pt; font-weight: bold; color: #4338ca;
    border-bottom: 2px solid #4f46e5; padding-bottom: 6px;
    margin-top: 24px; margin-bottom: 12px;
  }
  .stats-grid { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; }
  .stat-card {
    flex: 1; min-width: 160px;
    border: 1px solid #e2e8f0; border-radius: 8px;
    padding: 12px 16px; text-align: center;
  }
  .stat-card .label { font-size: 8pt; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; }
  .stat-card .value { font-size: 16pt; font-weight: bold; color: #1e293b; margin-top: 4px; }
  .stat-card .sub { font-size: 8pt; color: #059669; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  table thead th {
    background: #4f46e5; color: #fff; font-weight: bold;
    padding: 8px 12px; text-align: left;
  }
  table tbody td { padding: 6px 12px; border-bottom: 1px solid #e2e8f0; }
  table tbody tr:nth-child(even) td { background-color: #f8fafc; }
  .footer {
    margin-top: 36px; padding-top: 12px;
    border-top: 1px solid #cbd5e1;
    text-align: center; font-size: 9pt; color: #94a3b8;
  }
</style>
</head>
<body>
<div class="report-header">
  ${logo ? `<div class="logo">${logo}</div>` : ''}
  <div class="name">${name}</div>
  <div class="subtitle">Rapport Annuel ${selectedYear}</div>
  <div class="date">Généré le ${dateStr}</div>
</div>
<h2>Statistiques Générales</h2>
<div class="stats-grid">
  <div class="stat-card">
    <div class="label">Total Membres</div>
    <div class="value">${formatNumber(stats.totalMembres)}</div>
    <div class="sub">${stats.actifs} actifs, ${stats.inactifs} inactifs</div>
  </div>
  <div class="stat-card">
    <div class="label">Revenus ${selectedYear}</div>
    <div class="value" style="color:#059669;">${formatFCFA(stats.revenus)}</div>
  </div>
  <div class="stat-card">
    <div class="label">Dépenses ${selectedYear}</div>
    <div class="value" style="color:#dc2626;">${formatFCFA(stats.depenses)}</div>
  </div>
  <div class="stat-card">
    <div class="label">Solde ${selectedYear}</div>
    <div class="value" style="color:${stats.solde >= 0 ? '#059669' : '#dc2626'};">${formatFCFA(stats.solde)}</div>
  </div>
</div>
<div class="stats-grid">
  <div class="stat-card">
    <div class="label">Cultes & Événements</div>
    <div class="value">${formatNumber(stats.totalCultes)}</div>
  </div>
  <div class="stat-card">
    <div class="label">Nouveaux Membres</div>
    <div class="value">${formatNumber(stats.nouveauxMembres)}</div>
  </div>
  <div class="stat-card">
    <div class="label">Baptêmes</div>
    <div class="value">${formatNumber(stats.baptemes)}</div>
  </div>
  <div class="stat-card">
    <div class="label">Mariages</div>
    <div class="value">${formatNumber(stats.mariages)}</div>
  </div>
</div>
<h2>Finances Mensuelles ${selectedYear}</h2>
<table>
  <thead>
    <tr>
      <th>Mois</th>
      <th style="text-align:right;">Revenus</th>
      <th style="text-align:right;">Dépenses</th>
      <th style="text-align:right;">Solde</th>
    </tr>
  </thead>
  <tbody>
    ${monthRows}
  </tbody>
</table>
<h2>Répartition des Membres</h2>
<table>
  <thead>
    <tr><th>Statut</th><th style="text-align:right;">Nombre</th></tr>
  </thead>
  <tbody>
    <tr><td>Actifs</td><td style="text-align:right;">${formatNumber(stats.actifs)}</td></tr>
    <tr><td>Inactifs</td><td style="text-align:right;">${formatNumber(stats.inactifs)}</td></tr>
    <tr><td>En observation</td><td style="text-align:right;">${formatNumber(stats.enObservation)}</td></tr>
    <tr><td style="font-weight:bold;">Total</td><td style="font-weight:bold;text-align:right;">${formatNumber(stats.totalMembres)}</td></tr>
  </tbody>
</table>
<div class="footer">
  ${name} — Rapport Annuel ${selectedYear} — Généré le ${dateStr}
</div>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl text-slate-800 dark:text-slate-200 font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Rapport Annuel
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Générez un rapport annuel complet avec les statistiques de l'église
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
              Année du rapport
            </label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="w-full sm:w-48 text-sm p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-indigo-600 dark:focus:outline-indigo-400 font-medium text-slate-800 dark:text-slate-200"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={generatePDF}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold border border-indigo-500 shadow-sm transition-all cursor-pointer shrink-0"
          >
            <FileText className="w-4 h-4" />
            Générer le PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">Membres</span>
            <TrendingUp className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatNumber(stats.totalMembres)}</div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">{stats.actifs} actifs</div>
          <div className="text-[11px] text-slate-400">{stats.inactifs} inactifs · {stats.enObservation} obs.</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">Finances {selectedYear}</span>
            <BarChart3 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{formatFCFA(stats.revenus)}</div>
          <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">-{formatFCFA(stats.depenses)}</div>
          <div className={`text-[11px] font-bold ${stats.solde >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            Solde: {formatFCFA(stats.solde)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">Cultes & Événements</span>
            <FileText className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatNumber(stats.totalCultes)}</div>
          <div className="text-[11px] text-slate-400 mt-1">total {selectedYear}</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">Sacrements</span>
            <Printer className="w-4 h-4 text-purple-500 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatNumber(stats.baptemes)}</div>
          <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">{stats.nouveauxMembres} nouveaux membres</div>
          <div className="text-[11px] text-slate-400">{stats.mariages} mariages</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Finances Mensuelles {selectedYear} (FCFA)
        </h3>
        <div className="flex items-end gap-1 h-48">
          {stats.monthlyData.map((d, i) => {
            const revPct = Math.max((d.revenus / maxChartValue) * 100, 1);
            const expPct = Math.max((d.depenses / maxChartValue) * 100, 1);
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <div className="w-full flex items-end justify-center gap-0.5" style={{ height: '100%' }}>
                  <div
                    className="w-1/2 bg-emerald-500 dark:bg-emerald-600 rounded-t-sm transition-all"
                    style={{ height: `${revPct}%` }}
                    title={`Revenus: ${formatFCFA(d.revenus)}`}
                  />
                  <div
                    className="w-1/2 bg-rose-500 dark:bg-rose-600 rounded-t-sm transition-all"
                    style={{ height: `${expPct}%` }}
                    title={`Dépenses: ${formatFCFA(d.depenses)}`}
                  />
                </div>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 mt-1 text-center leading-tight">
                  {d.month.substring(0, 3)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-4 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 dark:bg-emerald-600" />
            Revenus
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-500 dark:bg-rose-600" />
            Dépenses
          </span>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={generatePDF}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-bold border border-indigo-500 shadow-sm transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Générer le rapport PDF & Imprimer
        </button>
      </div>
    </div>
  );
}
