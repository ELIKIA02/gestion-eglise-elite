import React, { useMemo, useState } from 'react';
import { FinanceTransaction, ChurchEvent, Member, ChurchSettings } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { FileDown, Printer, TrendingUp, Users, DollarSign, Calendar, Download, Filter, BarChart3, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';

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

  // Advanced Statistics
  const advancedStats = useMemo(() => {
    const memberGrowth: Record<string, number> = {};
    members.forEach(m => {
      const month = m.createdAt ? m.createdAt.substring(0, 7) : 'Inconnu';
      memberGrowth[month] = (memberGrowth[month] || 0) + 1;
    });
    const memberGrowthData = Object.entries(memberGrowth).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({
      month,
      count
    }));

    const balance = transactions.reduce((sum, t) =>
      t.type === 'Revenu' ? sum + t.amount : sum - t.amount, 0
    );
    const totalRevenue = transactions.filter(t => t.type === 'Revenu').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'Dépense').reduce((s, t) => s + t.amount, 0);

    const eventTypeCount: Record<string, number> = {};
    let totalAttendanceAll = 0;
    events.forEach(e => {
      eventTypeCount[e.type] = (eventTypeCount[e.type] || 0) + 1;
      totalAttendanceAll += e.attendance || 0;
    });
    const avgAttendanceAll = events.length > 0 ? Math.round(totalAttendanceAll / events.length) : 0;
    const mostPopularType = Object.entries(eventTypeCount).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';

    return { memberGrowthData, balance, totalRevenue, totalExpenses, avgAttendanceAll, mostPopularType, eventTypeCount };
  }, [members, transactions, events]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const memberSheet = XLSX.utils.json_to_sheet(members.map(m => ({
      Nom: m.name,
      Email: m.email,
      Téléphone: m.phone,
      Statut: m.status,
      Ministère: m.ministry,
      Date_création: m.createdAt
    })));
    XLSX.utils.book_append_sheet(wb, memberSheet, 'Membres');

    const financeSheet = XLSX.utils.json_to_sheet(transactions.map(t => ({
      Date: t.date,
      Type: t.type,
      Catégorie: t.category,
      Montant: t.amount,
      Contributeur: t.contributor || '',
      Notes: t.notes || ''
    })));
    XLSX.utils.book_append_sheet(wb, financeSheet, 'Finances');

    const eventSheet = XLSX.utils.json_to_sheet(events.map(e => ({
      Date: e.date,
      Titre: e.title,
      Type: e.type,
      Participants: e.attendance,
      Prédicateur: e.preacher,
      Notes: e.notes
    })));
    XLSX.utils.book_append_sheet(wb, eventSheet, 'Événements');

    const statsSheet = XLSX.utils.json_to_sheet([
      { Indicateur: 'Total membres', Valeur: members.length },
      { Indicateur: 'Membres actifs', Valeur: members.filter(m => m.status === 'Actif').length },
      { Indicateur: 'Total revenus', Valeur: advancedStats.totalRevenue },
      { Indicateur: 'Total dépenses', Valeur: advancedStats.totalExpenses },
      { Indicateur: 'Solde', Valeur: advancedStats.balance },
      { Indicateur: 'Total événements', Valeur: events.length },
      { Indicateur: 'Assistance moyenne', Valeur: advancedStats.avgAttendanceAll },
      { Indicateur: 'Type le plus fréquent', Valeur: advancedStats.mostPopularType },
    ]);
    XLSX.utils.book_append_sheet(wb, statsSheet, 'Statistiques');

    XLSX.writeFile(wb, `rapport_eglise_${selectedYear}.xlsx`);
  };

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

  const exportPDF = () => {
    const monthlyRows = reportStats.monthlyData.map(m =>
      `<tr><td>${m.name}</td><td>${formatFCFA(m.Recettes)}</td><td>${formatFCFA(m.Dépenses)}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Rapport ${selectedYear}</title>
<style>
  @page { margin: 20mm 15mm; }
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
     ${settings?.appLogo?.startsWith('data:image') ? `<img src="${settings.appLogo}" alt="Logo" style="width:40px;height:40px;object-fit:contain;vertical-align:middle;margin-right:8px;" />` : (settings?.appLogo || '⛪')} ${settings?.appName || 'ELIKIA EKLESIA'}
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
</body></html>`;
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

  const exportFullPDF = () => {
    const memberRows = members.map(m =>
      `<tr><td>${m.name}</td><td>${m.phone}</td><td>${m.status}</td><td>${m.ministry || '-'}</td></tr>`
    ).join('');

    const financeRows = transactions.filter(t => parseInt(t.date.substring(0, 4)) === parseInt(selectedYear)).map(t =>
      `<tr><td>${t.date}</td><td>${t.type}</td><td>${t.category}</td><td style="text-align:right">${formatFCFA(t.amount)}</td></tr>`
    ).join('');

    const eventRows = events.filter(e => parseInt(e.date.substring(0, 4)) === parseInt(selectedYear)).map(e =>
      `<tr><td>${e.date}</td><td>${e.title}</td><td>${e.attendance || 0}</td><td>${e.preacher || '-'}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rapport Complet ${selectedYear}</title>
    <style>
      @page { margin: 15mm; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 20px; color: #333; font-size: 11px; }
      h1 { color: #4F46E5; text-align: center; font-size: 20px; border-bottom: 2px solid #4F46E5; padding-bottom: 8px; }
      h2 { color: #1e293b; font-size: 14px; margin-top: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
      .header { text-align: center; margin-bottom: 20px; }
      .header img { width: 48px; height: 48px; object-fit: contain; vertical-align: middle; }
      .header .name { font-size: 18px; font-weight: bold; color: #4F46E5; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
      th { background: #4F46E5; color: white; padding: 6px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
      td { border: 1px solid #e2e8f0; padding: 5px; }
      tr:nth-child(even) { background: #f8fafc; }
      .kpi { display: inline-block; border: 1px solid #e2e8f0; padding: 10px; margin: 5px; text-align: center; min-width: 120px; border-radius: 6px; }
      .kpi-val { font-size: 16px; font-weight: bold; color: #4F46E5; }
      .footer { text-align: center; margin-top: 30px; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      .page-break { page-break-before: always; }
    </style></head><body>
    <div class="header">
      ${settings?.appLogo?.startsWith('data:image') ? `<img src="${settings.appLogo}" alt="Logo" />` : (settings?.appLogo || '⛪')}
      <div class="name">${settings?.appName || 'ELIKIA EKLESIA'}</div>
      <div style="font-size:10px;color:#64748b;">${settings?.reportHeader?.split('\n')[0] || ''}</div>
    </div>
    <h1>Rapport Complet ${selectedYear}</h1>
    <p style="text-align:center;font-size:10px;color:#94a3b8;">Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    <div style="text-align:center;margin:15px 0;">
      <span class="kpi"><div>Membres</div><div class="kpi-val">${members.length}</div></span>
      <span class="kpi"><div>Revenus</div><div class="kpi-val">${formatFCFA(reportStats.annualRevenue)}</div></span>
      <span class="kpi"><div>Dépenses</div><div class="kpi-val">${formatFCFA(reportStats.annualExpense)}</div></span>
      <span class="kpi"><div>Solde</div><div class="kpi-val" style="color:${reportStats.netBalance >= 0 ? '#10B981' : '#EF4444'}">${formatFCFA(reportStats.netBalance)}</div></span>
      <span class="kpi"><div>Cultes</div><div class="kpi-val">${reportStats.totalServices}</div></span>
      <span class="kpi"><div>Moy. assistance</div><div class="kpi-val">${reportStats.avgAttendance}</div></span>
    </div>
    <h2>👥 Liste des membres</h2>
    <table><thead><tr><th>Nom</th><th>Téléphone</th><th>Statut</th><th>Ministère</th></tr></thead><tbody>${memberRows}</tbody></table>
    <p style="font-size:9px;color:#94a3b8;">Total: ${members.length} membres (${reportStats.activeMembers} actifs, ${reportStats.observationMembers} en observation)</p>
    <div class="page-break"></div>
    <h2>💰 Mouvements financiers (${selectedYear})</h2>
    <table><thead><tr><th>Date</th><th>Type</th><th>Catégorie</th><th style="text-align:right">Montant</th></tr></thead><tbody>${financeRows}</tbody></table>
    <p style="font-size:9px;color:#94a3b8;">Total recettes: ${formatFCFA(reportStats.annualRevenue)} · Total dépenses: ${formatFCFA(reportStats.annualExpense)}</p>
    <div class="page-break"></div>
    <h2>📅 Cultes et événements (${selectedYear})</h2>
    <table><thead><tr><th>Date</th><th>Titre</th><th>Participants</th><th>Prédicateur</th></tr></thead><tbody>${eventRows}</tbody></table>
    <p style="font-size:9px;color:#94a3b8;">Total: ${reportStats.totalServices} cultes · Moyenne: ${reportStats.avgAttendance} participants/culte</p>
    <div class="footer">
      ${settings?.appName || 'ELIKIA EKLESIA'} · Document officiel généré numériquement<br>
      ${new Date().toLocaleDateString('fr-FR')}
    </div>
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) { w.focus(); }
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
    ${settings?.appLogo?.startsWith('data:image') ? `<img src="${settings.appLogo}" alt="Logo" style="width:40px;height:40px;object-fit:contain;vertical-align:middle;margin-right:8px;" />` : (settings?.appLogo || '⛪')} ${settings?.appName || 'ELIKIA EKLESIA'}
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
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Rapports & Statistiques</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Bilans annuels, graphiques et exports CSV</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 dark:text-slate-200 font-semibold"
          >
            {years.length > 0 ? years.map(y => (
              <option key={y} value={y}>{y}</option>
            )) : <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>}
          </select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-1">
            <DollarSign className="w-3.5 h-3.5" /> Recettes
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatFCFA(reportStats.annualRevenue)}</span>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-1">
            <TrendingUp className="w-3.5 h-3.5" /> Dépenses
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatFCFA(reportStats.annualExpense)}</span>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider mb-1">
            <Users className="w-3.5 h-3.5" /> Membres actifs
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{reportStats.activeMembers}</span>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-1">
            <Calendar className="w-3.5 h-3.5" /> Moy. assistance
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{reportStats.avgAttendance} / culte</span>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly financial trends */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Évolution financière mensuelle ({selectedYear})</h3>
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
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Répartition par ministère</h3>
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
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Statut des membres</h3>
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
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Composition des revenus</h3>
            <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Dîmes</span>
                <span className="text-slate-700 dark:text-slate-300">{formatFCFA(reportStats.tithesTotal)}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (reportStats.tithesTotal / (reportStats.annualRevenue || 1)) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Offrandes</span>
                <span className="text-slate-700 dark:text-slate-300">{formatFCFA(reportStats.offeringsTotal)}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (reportStats.offeringsTotal / (reportStats.annualRevenue || 1)) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Autres recettes</span>
                <span className="text-slate-700 dark:text-slate-300">{formatFCFA(reportStats.annualRevenue - reportStats.tithesTotal - reportStats.offeringsTotal)}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, (reportStats.annualRevenue - reportStats.tithesTotal - reportStats.offeringsTotal) / (reportStats.annualRevenue || 1)) * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Export cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <button onClick={() => exportCSV('finances')}
          className="flex items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all cursor-pointer text-left">
          <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Finances CSV</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Écritures {selectedYear}</span>
          </div>
        </button>

        <button onClick={() => exportCSV('members')}
          className="flex items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all cursor-pointer text-left">
          <div className="w-9 h-9 rounded-full bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Membres CSV</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">{members.length} inscrits</span>
          </div>
        </button>

        <button onClick={() => exportCSV('events')}
          className="flex items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all cursor-pointer text-left">
          <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Événements CSV</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">{events.length} cultes</span>
          </div>
        </button>

        <button onClick={exportExcel}
          className="flex items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-sm transition-all cursor-pointer text-left min-h-[56px]">
          <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <FileDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Exporter vers Excel</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Classeur XLSX</span>
          </div>
        </button>

        <button onClick={exportPDF}
          className="flex items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-sm transition-all cursor-pointer text-left min-h-[56px]">
          <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">PDF Synthèse</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Rapport {selectedYear}</span>
          </div>
        </button>

        <button onClick={exportFullPDF}
          className="flex items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-sm transition-all cursor-pointer text-left min-h-[56px]">
          <div className="w-9 h-9 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">PDF Complet</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Membres + finances + cultes</span>
          </div>
        </button>

        <button onClick={openPrintPreview}
          className="flex items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all cursor-pointer text-left min-h-[56px]">
          <div className="w-9 h-9 rounded-full bg-stone-50 dark:bg-stone-900/30 flex items-center justify-center shrink-0">
            <Printer className="w-4 h-4 text-stone-700 dark:text-stone-400" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Rapport papier</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Bilan {selectedYear}</span>
          </div>
        </button>
      </div>

      {/* Advanced Statistics */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Statistiques Avancées
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Croissance des membres</h4>
            {advancedStats.memberGrowthData.length > 0 ? (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={advancedStats.memberGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={9} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={9} tickLine={false} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#4F46E5" strokeWidth={2} dot={{ r: 2 }} name="Nouveaux membres" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-8 text-center">Aucune donnée</p>
            )}
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Résumé financier</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                <span className="text-slate-600 dark:text-slate-400">Revenus totaux</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatFCFA(advancedStats.totalRevenue)}</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                <span className="text-slate-600 dark:text-slate-400">Dépenses totales</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{formatFCFA(advancedStats.totalExpenses)}</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                <span className="text-slate-600 dark:text-slate-400">Solde</span>
                <span className={`font-bold ${advancedStats.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatFCFA(advancedStats.balance)}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Statistiques des événements</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                <span className="text-slate-600 dark:text-slate-400">Total événements</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{events.length}</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                <span className="text-slate-600 dark:text-slate-400">Assistance moyenne</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{advancedStats.avgAttendanceAll} / culte</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                <span className="text-slate-600 dark:text-slate-400">Type le plus fréquent</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{advancedStats.mostPopularType}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
