import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Loader2, Send, FileText, Download, Sparkles, TrendingUp, TrendingDown, Lightbulb, AlertTriangle, CheckCircle2, Target, BarChart3 } from 'lucide-react';
import { ChurchSettings, Member, FinanceTransaction, ChurchEvent } from '../types';

interface ChurchReportModuleProps {
  settings: ChurchSettings | null;
  members: Member[];
  transactions: FinanceTransaction[];
  events: ChurchEvent[];
}

export default function ChurchReportModule({ settings, members, transactions, events }: ChurchReportModuleProps) {
  const [response, setResponse] = useState('');
  const [generating, setGenerating] = useState(false);
  const [focus, setFocus] = useState<string>('complet');
  const responseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  const getChurchData = () => {
    const active = members.filter(m => m.status === 'Actif').length;
    const inactive = members.filter(m => m.status === 'Inactif').length;
    const observation = members.filter(m => m.status === 'En observation').length;
    const rev = transactions.filter(t => t.type === 'Revenu').reduce((s, t) => s + t.amount, 0);
    const exp = transactions.filter(t => t.type === 'Dépense').reduce((s, t) => s + t.amount, 0);
    const avgAtt = events.length > 0
      ? Math.round(events.reduce((s, e) => s + (e.attendance || 0), 0) / events.length)
      : 0;

    const byCategory: Record<string, number> = {};
    transactions.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });
    const topRev = Object.entries(byCategory).filter(([k]) => transactions.some(t => t.category === k && t.type === 'Revenu')).sort((a, b) => b[1] - a[1]);
    const topExp = Object.entries(byCategory).filter(([k]) => transactions.some(t => t.category === k && t.type === 'Dépense')).sort((a, b) => b[1] - a[1]);

    const byMonth: Record<string, { rev: number; exp: number }> = {};
    transactions.forEach(t => {
      const m = t.date.substring(0, 7);
      if (!byMonth[m]) byMonth[m] = { rev: 0, exp: 0 };
      if (t.type === 'Revenu') byMonth[m].rev += t.amount;
      else byMonth[m].exp += t.amount;
    });

    const months = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b));
    const revTrend = months.length >= 2
      ? months[months.length - 1][1].rev - months[months.length - 2][1].rev
      : 0;

    const lastEvents = [...events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const attTrend = lastEvents.length >= 2
      ? lastEvents[0].attendance - lastEvents[1].attendance
      : 0;

    const ministryDist: Record<string, number> = {};
    members.forEach(m => { const k = m.ministry || 'Non assigné'; ministryDist[k] = (ministryDist[k] || 0) + 1; });

    return {
      members: { total: members.length, active, inactive, observation },
      finances: { revenus: rev, depenses: exp, solde: rev - exp, revTrend, topRev: topRev.slice(0, 5), topExp: topExp.slice(0, 5) },
      events: { total: events.length, avgAttendance: avgAtt, attTrend, last: lastEvents },
      months,
      ministryDist
    };
  };

  const buildPrompt = () => {
    const d = getChurchData();
    const mList = Object.entries(d.ministryDist).map(([k, v]) => `- ${k}: ${v}`).join('\n');
    const evList = d.events.last.map(e => `  - ${e.date} | ${e.title} | ${e.attendance || 0} participants`).join('\n');
    const monthRows = d.months.map(([m, v]) => `  - ${m}: +${v.rev.toLocaleString('fr-FR')} / -${v.exp.toLocaleString('fr-FR')} FCFA`).join('\n');

    let focusGuide = '';
    if (focus === 'finances') focusGuide = '\n\nACCENTUE l\'analyse sur la trésorerie, les flux, la gestion budgétaire et la santé financière.';
    else if (focus === 'assistance') focusGuide = '\n\nACCENTUE l\'analyse sur la participation aux cultes, la fidélisation, l\'engagement des membres.';
    else if (focus === 'membres') focusGuide = '\n\nACCENTUE l\'analyse sur la croissance numérique, les ministères, les statuts et l\'implication.';

    return `Tu es un auditeur-expert en administration et gestion d'église, spécialisé dans l'analyse de données paroissiales.

Génère un RAPPORT D'AUDIT D'ÉGLISE structuré et professionnel en français. Utilise des TABLEAUX MARKDOWN pour toutes les données chiffrées.

Voici les données réelles de l'église "${settings?.appName || 'Ma paroisse'}" :

## Données Globales
- Membres: ${d.members.total} (${d.members.active} actifs, ${d.members.inactive} inactifs, ${d.members.observation} en observation)
- Revenus totaux: ${d.finances.revenus.toLocaleString('fr-FR')} FCFA
- Dépenses totales: ${d.finances.depenses.toLocaleString('fr-FR')} FCFA
- Solde: ${d.finances.solde.toLocaleString('fr-FR')} FCFA
- Assistance moyenne: ${d.events.avgAttendance} personnes
- Total cultes: ${d.events.total}

## Top Revenus par catégorie
${d.finances.topRev.map(([k, v]) => `  - ${k}: ${v.toLocaleString('fr-FR')} FCFA`).join('\n')}

## Top Dépenses par catégorie
${d.finances.topExp.map(([k, v]) => `  - ${k}: ${v.toLocaleString('fr-FR')} FCFA`).join('\n')}

## Évolution mensuelle
${monthRows}

## Derniers cultes
${evList}

## Répartition ministères
${mList}

## Tendances
- Tendance revenus (dernier mois): ${d.finances.revTrend >= 0 ? '+' : ''}${d.finances.revTrend.toLocaleString('fr-FR')} FCFA
- Tendance assistance (dernier culte): ${d.events.attTrend >= 0 ? '+' : ''}${d.events.attTrend} personnes${focusGuide}

---

Structure le rapport ainsi :

## 📋 1. Résumé Exécutif
2-3 phrases synthétisant la situation globale.

## 📊 2. Analyse Financière
Tableau : | Indicateur | Valeur | Appréciation |
(Inclus : Revenus, Dépenses, Solde, Ratio dépenses/revenus, Tendance)
Puis un paragraphe d'interprétation.

## 📈 3. Analyse de l'Assistance
Tableau : | Période | Participants | Tendance |
Puis interprétation.

## 👥 4. Analyse des Membres
Tableau : | Statut | Nombre | Pourcentage |
Puis répartition par ministère en tableau.

## ✅ 5. Points Forts
Liste de 3-5 forces avec explications, précédées de l'emoji ✅.

## ⚠️ 6. Points de Vigilance
Liste de 3-5 faiblesses avec explications, précédées de l'emoji ⚠️.

## 💡 7. Recommandations & Plan d'Action
Pour chaque recommandation, un tableau :
| Action | Priorité | Difficulté | Impact | Délai |
Format Markdown professionnel, tableaux propres, chiffres en FCFA.`;
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setResponse('');

    const prompt = buildPrompt();

    try {
      const res = await fetch("/api/assistant/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: 'report',
          prompt,
          apiKey: settings?.mistralApiKey || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setResponse(`### ⚠️ Erreur\n\n${errData.error || `HTTP ${res.status}`}`);
        setGenerating(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setResponse("### ⚠️ Erreur\n\nFlux de lecture indisponible.");
        setGenerating(false);
        return;
      }

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                fullText += data.text;
                setResponse(fullText);
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err: any) {
      setResponse(`### ⚠️ Erreur de connexion\n\n${err.message || 'Vérifie le serveur.'}`);
    } finally {
      setGenerating(false);
    }
  };

  const mdToHtmlWord = (md: string): string => {
    const inlineFormat = (text: string): string =>
      text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>');

    const lines = md.split('\n');
    const result: string[] = [];
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];

    const flushTable = () => {
      if (tableHeaders.length === 0 && tableRows.length === 0) return;
      let html = '<table class="church-table">';
      if (tableHeaders.length > 0) {
        html += '<thead><tr>';
        tableHeaders.forEach(h => { html += `<th>${inlineFormat(h)}</th>`; });
        html += '</tr></thead>';
      }
      if (tableRows.length > 0) {
        html += '<tbody>';
        tableRows.forEach((row, ri) => {
          html += `<tr class="${ri % 2 === 0 ? 'even' : 'odd'}">`;
          row.forEach(c => { html += `<td>${inlineFormat(c)}</td>`; });
          html += '</tr>';
        });
        html += '</tbody>';
      }
      html += '</table>';
      result.push(html);
      tableHeaders = [];
      tableRows = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (/^\|.+\|$/.test(trimmed)) {
        const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
        if (cells.length === 0 || cells.every(c => /^[\s:-]+$/.test(c))) continue;
        if (!inTable) {
          flushTable();
          inTable = true;
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
        continue;
      }

      if (inTable) { flushTable(); inTable = false; }

      if (trimmed === '') { result.push('<p class="spacer">&nbsp;</p>'); continue; }

      let blockTag = 'p';
      let openTag = '';
      let closeTag = '';
      let content = inlineFormat(trimmed);

      if (/^### (.+)$/.test(trimmed)) {
        blockTag = 'h3'; content = inlineFormat(trimmed.replace(/^### (.+)$/, '$1'));
      } else if (/^## (.+)$/.test(trimmed)) {
        blockTag = 'h2'; content = inlineFormat(trimmed.replace(/^## (.+)$/, '$1'));
      } else if (/^# (.+)$/.test(trimmed)) {
        blockTag = 'h1'; content = inlineFormat(trimmed.replace(/^# (.+)$/, '$1'));
      } else if (/^\* (.+)$/.test(trimmed)) {
        blockTag = 'li'; openTag = '<li class="bullet">'; closeTag = '</li>'; content = inlineFormat(trimmed.replace(/^\* (.+)$/, '$1'));
      } else if (/^- (.+)$/.test(trimmed)) {
        blockTag = 'li'; openTag = '<li class="bullet">'; closeTag = '</li>'; content = inlineFormat(trimmed.replace(/^- (.+)$/, '$1'));
      } else if (/^(\d+)\.\s+(.+)$/.test(trimmed)) {
        blockTag = 'li'; openTag = '<li class="num">'; closeTag = '</li>'; content = inlineFormat(trimmed.replace(/^(\d+)\.\s+(.+)$/, '$2'));
      } else if (/^✅ (.+)$/.test(trimmed)) {
        blockTag = 'div'; openTag = '<div class="strength">'; closeTag = '</div>'; content = inlineFormat(trimmed.replace(/^✅ (.+)$/, '✅ $1'));
      } else if (/^⚠️ (.+)$/.test(trimmed)) {
        blockTag = 'div'; openTag = '<div class="weakness">'; closeTag = '</div>'; content = inlineFormat(trimmed.replace(/^⚠️ (.+)$/, '⚠️ $1'));
      } else if (/^💡 (.+)$/.test(trimmed)) {
        blockTag = 'div'; openTag = '<div class="recommend">'; closeTag = '</div>'; content = inlineFormat(trimmed.replace(/^💡 (.+)$/, '💡 $1'));
      } else if (/^🎯 (.+)$/.test(trimmed)) {
        blockTag = 'div'; openTag = '<div class="target">'; closeTag = '</div>'; content = inlineFormat(trimmed.replace(/^🎯 (.+)$/, '🎯 $1'));
      }

      if (blockTag === 'p') {
        result.push(`<p>${content}</p>`);
      } else {
        result.push(`${openTag || `<${blockTag}>`}${content}${closeTag || `</${blockTag}>`}`);
      }
    }

    if (inTable) flushTable();
    return result.map(r => r.trim()).filter(r => r.length > 0).join('\n');
  };

  const exportWord = () => {
    if (!response) return;
    const title = `Audit_Église_${settings?.appName || 'Ma_Paroisse'}`;
    const content = mdToHtmlWord(response);
    const churchName = settings?.appName || "Gestion d'Église Élite";
    const logo = settings?.appLogo?.startsWith('data:image')
      ? `<img src="${settings.appLogo}" alt="Logo" style="width:50px;height:50px;object-fit:contain;vertical-align:middle;margin-bottom:4px;" />`
      : (settings?.appLogo || '†');
    const dateStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const html = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<title>${title}</title>
<style>
  /* Page Setup */
  @page {
    size: A4;
    margin: 2.5cm 2cm 2.5cm 2cm;
    mso-page-orientation: portrait;
  }

  body {
    font-family: 'Calibri', 'Helvetica Neue', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #1e293b;
  }

  /* Report Header */
  .report-header {
    text-align: center;
    border-bottom: 3px double #4f46e5;
    padding-bottom: 14px;
    margin-bottom: 28px;
  }
  .report-header .logo {
    font-size: 28pt;
    font-weight: bold;
    color: #4f46e5;
    margin-bottom: 4px;
  }
  .report-header .name {
    font-size: 16pt;
    font-weight: bold;
    color: #1e293b;
  }
  .report-header .type {
    font-size: 13pt;
    font-weight: bold;
    color: #4f46e5;
    margin-top: 2px;
  }
  .report-header .date {
    font-size: 9pt;
    color: #64748b;
    margin-top: 2px;
  }

  /* Headings */
  h1 {
    font-size: 16pt;
    font-weight: bold;
    color: #4f46e5;
    border-bottom: 2px solid #4f46e5;
    padding-bottom: 6px;
    margin-top: 28px;
    margin-bottom: 12px;
    page-break-before: auto;
  }
  h2 {
    font-size: 14pt;
    font-weight: bold;
    color: #4338ca;
    border-bottom: 1px solid #c7d2fe;
    padding-bottom: 4px;
    margin-top: 22px;
    margin-bottom: 10px;
  }
  h3 {
    font-size: 12pt;
    font-weight: bold;
    color: #6366f1;
    margin-top: 18px;
    margin-bottom: 8px;
  }

  /* Paragraphs */
  p {
    margin: 6px 0;
    text-align: justify;
  }
  p.spacer {
    margin: 4px 0;
    font-size: 4pt;
  }

  /* Lists */
  li.bullet, li.num {
    margin: 2px 0 2px 18px;
    padding-left: 4px;
  }
  li.bullet { list-style-type: disc; }
  li.num { list-style-type: decimal; }

  /* Status blocks — instructive colors */
  .strength {
    color: #059669;
    font-weight: bold;
    margin: 4px 0 4px 12px;
    padding: 3px 10px;
    background: #ecfdf5;
    border-left: 4px solid #059669;
    border-radius: 4px;
  }
  .weakness {
    color: #d97706;
    font-weight: bold;
    margin: 4px 0 4px 12px;
    padding: 3px 10px;
    background: #fffbeb;
    border-left: 4px solid #d97706;
    border-radius: 4px;
  }
  .recommend {
    color: #6366f1;
    font-weight: bold;
    margin: 4px 0 4px 12px;
    padding: 3px 10px;
    background: #eef2ff;
    border-left: 4px solid #6366f1;
    border-radius: 4px;
  }
  .target {
    color: #0891b2;
    font-weight: bold;
    margin: 4px 0 4px 12px;
    padding: 3px 10px;
    background: #ecfeff;
    border-left: 4px solid #0891b2;
    border-radius: 4px;
  }

  /* Verse / citation block */
  .verse {
    color: #7c3aed;
    font-style: italic;
    margin: 8px 0 8px 24px;
    padding: 8px 14px;
    background: #f5f3ff;
    border-left: 4px solid #7c3aed;
    border-radius: 4px;
    font-size: 10pt;
  }

  /* Highlight / important */
  .highlight {
    background: #fef9c3;
    padding: 1px 6px;
    border-radius: 3px;
    font-weight: bold;
    color: #854d0e;
  }

  /* Key metric callout */
  .metric {
    display: inline-block;
    background: linear-gradient(135deg, #4f46e5, #6366f1);
    color: #fff;
    font-weight: bold;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 10pt;
  }

  /* Tables */
  table.church-table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 10pt;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    overflow: hidden;
  }
  table.church-table thead th {
    background: linear-gradient(135deg, #4f46e5, #6366f1);
    color: #ffffff;
    font-weight: bold;
    padding: 8px 12px;
    text-align: left;
    border: none;
  }
  table.church-table tbody td {
    padding: 6px 12px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }
  table.church-table tbody tr.even td {
    background-color: #f8fafc;
  }
  table.church-table tbody tr.odd td {
    background-color: #ffffff;
  }
  table.church-table tbody tr:hover td {
    background-color: #eef2ff;
  }

  /* Inline code */
  code {
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 9.5pt;
    background-color: #f1f5f9;
    padding: 1px 6px;
    border-radius: 4px;
    color: #be123c;
  }

  /* Footer */
  .report-footer {
    margin-top: 36px;
    padding-top: 12px;
    border-top: 1px solid #cbd5e1;
    text-align: center;
    font-size: 9pt;
    color: #94a3b8;
    font-style: italic;
  }
  .report-footer .page-number {
    mso-field-code: "PAGE";
  }

  /* Strong, Em */
  strong { color: #1e293b; font-weight: bold; }
  em { color: #475569; }

  /* Page break */
  .page-break { page-break-before: always; }
</style>
</head>
<body>

<div class="report-header">
  <div class="logo">${logo}</div>
  <div class="name">${churchName}</div>
  <div class="type">Rapport d'Audit &amp; Analyse</div>
  <div class="date">${dateStr}</div>
</div>

${content}

<div class="report-footer">
  ${churchName} — ${dateStr}
</div>

</body>
</html>`;
    const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-eglise-${Date.now()}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (!response) return;
    const logo = settings?.appLogo?.startsWith('data:image')
      ? `<img src="${settings.appLogo}" alt="Logo" style="width:50px;height:50px;object-fit:contain;vertical-align:middle;margin-bottom:4px;" />`
      : (settings?.appLogo || '†');
    const name = settings?.appName || "Gestion d'Église Élite";
    const dateStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const content = mdToHtmlWord(response);

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Audit Église</title>
<style>
  @page { margin: 20mm 15mm; }
  body { font-family: 'Calibri', 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1e293b; }
  .report-header { text-align: center; border-bottom: 3px double #4f46e5; padding-bottom: 14px; margin-bottom: 28px; }
  .report-header .logo { font-size: 28pt; font-weight: bold; color: #4f46e5; margin-bottom: 4px; }
  .report-header .name { font-size: 16pt; font-weight: bold; }
  .report-header .type { font-size: 13pt; font-weight: bold; color: #4f46e5; margin-top: 2px; }
  .report-header .date { font-size: 9pt; color: #64748b; margin-top: 2px; }

  h1 { color: #4f46e5; font-size: 16pt; border-bottom: 2px solid #4f46e5; padding-bottom: 6px; margin-top: 28px; margin-bottom: 12px; }
  h2 { color: #4338ca; font-size: 14pt; margin-top: 22px; margin-bottom: 10px; border-bottom: 1px solid #c7d2fe; padding-bottom: 4px; }
  h3 { color: #6366f1; font-size: 12pt; margin-top: 18px; margin-bottom: 8px; }

  p { margin: 6px 0; text-align: justify; }
  p.spacer { margin: 4px 0; font-size: 4pt; }

  li.bullet, li.num { margin: 2px 0 2px 18px; padding-left: 4px; }
  li.bullet { list-style-type: disc; }
  li.num { list-style-type: decimal; }

  .strength { color: #059669; font-weight: bold; margin: 4px 0 4px 12px; padding: 3px 10px; background: #ecfdf5; border-left: 4px solid #059669; border-radius: 4px; }
  .weakness { color: #d97706; font-weight: bold; margin: 4px 0 4px 12px; padding: 3px 10px; background: #fffbeb; border-left: 4px solid #d97706; border-radius: 4px; }
  .recommend { color: #6366f1; font-weight: bold; margin: 4px 0 4px 12px; padding: 3px 10px; background: #eef2ff; border-left: 4px solid #6366f1; border-radius: 4px; }
  .target { color: #0891b2; font-weight: bold; margin: 4px 0 4px 12px; padding: 3px 10px; background: #ecfeff; border-left: 4px solid #0891b2; border-radius: 4px; }
  .verse { color: #7c3aed; font-style: italic; margin: 8px 0 8px 24px; padding: 8px 14px; background: #f5f3ff; border-left: 4px solid #7c3aed; border-radius: 4px; font-size: 10pt; }
  .highlight { background: #fef9c3; padding: 1px 6px; border-radius: 3px; font-weight: bold; color: #854d0e; }
  .metric { display: inline-block; background: linear-gradient(135deg, #4f46e5, #6366f1); color: #fff; font-weight: bold; padding: 2px 10px; border-radius: 12px; font-size: 10pt; }

  table.church-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
  table.church-table thead th { background: linear-gradient(135deg, #4f46e5, #6366f1); color: #fff; font-weight: bold; padding: 8px 12px; text-align: left; border: none; }
  table.church-table tbody td { padding: 6px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  table.church-table tbody tr.even td { background-color: #f8fafc; }
  table.church-table tbody tr.odd td { background-color: #fff; }
  table.church-table tbody tr:hover td { background-color: #eef2ff; }
  code { font-family: 'Consolas', 'Courier New', monospace; font-size: 9.5pt; background: #f1f5f9; padding: 1px 6px; border-radius: 4px; color: #be123c; }

  .footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 9pt; color: #94a3b8; font-style: italic; }
  @media print { body { font-size: 10pt; } }
</style></head><body>
<div class="report-header">
  <div class="logo">${logo}</div>
  <div class="name">${name}</div>
  <div class="type">Rapport d'Audit &amp; Analyse</div>
  <div class="date">${dateStr}</div>
</div>
${content}
<div class="footer">${name} — ${dateStr}</div>
</body></html>`);
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  const d = getChurchData();

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl text-slate-800 font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Audit & Rapport d'Église
          </h2>
          <p className="text-xs text-slate-500">Analyse complète avec forces, faiblesses et recommandations IA basée sur vos données réelles</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Membres</span>
          <span className="text-lg font-bold text-slate-900">{d.members.total}</span>
          <span className="text-[9px] text-emerald-600 block">{d.members.active} actifs</span>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Revenus</span>
          <span className="text-lg font-bold text-emerald-700">{d.finances.revenus.toLocaleString('fr-FR')} FCFA</span>
          <span className={`text-[9px] ${d.finances.revTrend >= 0 ? 'text-emerald-600' : 'text-rose-600'} block`}>
            {d.finances.revTrend >= 0 ? '+' : ''}{d.finances.revTrend.toLocaleString('fr-FR')} FCFA
          </span>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Dépenses</span>
          <span className="text-lg font-bold text-amber-700">{d.finances.depenses.toLocaleString('fr-FR')} FCFA</span>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Solde</span>
          <span className={`text-lg font-bold ${d.finances.solde >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {d.finances.solde.toLocaleString('fr-FR')} FCFA
          </span>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Assistance</span>
          <span className="text-lg font-bold text-indigo-700">{d.events.avgAttendance}</span>
          <span className={`text-[9px] ${d.events.attTrend >= 0 ? 'text-emerald-600' : 'text-rose-600'} block`}>
            / culte {d.events.attTrend >= 0 ? '+' : ''}{d.events.attTrend}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Axes d'analyse</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'complet', label: 'Rapport complet', icon: BarChart3 },
                { value: 'finances', label: 'Focus Finances', icon: TrendingDown },
                { value: 'assistance', label: 'Focus Assistance', icon: TrendingUp },
                { value: 'membres', label: 'Focus Membres', icon: Sparkles },
              ].map(f => {
                const FIcon = f.icon;
                return (
                  <button
                    key={f.value}
                    onClick={() => setFocus(f.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      focus === f.value
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <FIcon className="w-3.5 h-3.5" />
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-5 py-2.5 rounded-lg text-xs font-bold border border-indigo-500 shadow-sm transition-all cursor-pointer shrink-0"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Génération...</>
            ) : (
              <><Send className="w-4 h-4" /> Générer le rapport</>
            )}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-3 italic">
          Le rapport inclut automatiquement toutes les données de l'église. {focus !== 'complet' ? `Analyse ciblée sur : ${focus}.` : 'Analyse complète de la situation.'}
        </p>
      </div>

      {/* Results */}
      <div className="bg-white p-5 md:p-8 rounded-xl border border-slate-200 shadow-xs min-h-[400px] flex flex-col">
        {/* Toolbar */}
        {response && (
          <div className="flex justify-end gap-2 mb-4 pb-3 border-b border-slate-100 shrink-0">
            <button onClick={exportWord}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-indigo-700 bg-slate-50 hover:bg-indigo-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer">
              <FileText className="w-3.5 h-3.5" /> Word
            </button>
            <button onClick={exportPDF}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-rose-700 bg-slate-50 hover:bg-rose-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer">
              <Printer className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        )}

        {/* Content */}
        <div ref={responseRef} className="flex-1 overflow-y-auto max-h-[600px] pr-1">
          {!response && !generating && (
            <div className="text-center py-24 text-slate-400 space-y-3">
              <BarChart3 className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-medium">Rapport d'audit prêt à être généré</p>
              <p className="text-xs">Les données de l'église ont été collectées automatiquement.</p>
              <p className="text-xs">Cliquez sur <strong>« Générer le rapport »</strong> pour obtenir une analyse complète avec forces, faiblesses et recommandations.</p>
            </div>
          )}
          {generating && !response && (
            <div className="text-center py-24 text-slate-500 space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-indigo-600 animate-pulse">Analyse des données et génération du rapport...</p>
              <p className="text-[10px] text-slate-400">Cela peut prendre 20 à 40 secondes.</p>
            </div>
          )}
          {response && (
            <div className="prose prose-slate prose-xs max-w-none text-xs text-slate-800 leading-relaxed">
              <ReactMarkdown>{response}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
