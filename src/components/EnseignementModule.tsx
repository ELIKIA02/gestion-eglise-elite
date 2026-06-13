import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Plus, Edit2, Trash2, Clock, Calendar, CheckCircle2, Bold, Italic, Strikethrough, Code, Type, ArrowUp, ArrowDown, Loader2, Copy, Send, FileDown } from 'lucide-react';
import { Enseignement, EnseignementDay, Member } from '../types';

function markdownToHtml(md: string): string {
  if (!md) return '';
  return md
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*_(.+?)_\*/g, '<b><i>$1</i></b>')
    .replace(/_(.+?)_/g, '<i>$1</i>')
    .replace(/\*(.+?)\*/g, '<b>$1</b>')
    .replace(/~(.+?)~/g, '<s>$1</s>')
    .replace(/\n/g, '<br>');
}

function htmlToMarkdown(html: string): string {
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?div>/gi, '\n')
    .replace(/<\/?p>/gi, '\n')
    .replace(/<\/?span[^>]*>/gi, '')
    .replace(/<b><i>(.*?)<\/i><\/b>/gi, '*_$1_*')
    .replace(/<i><b>(.*?)<\/b><\/i>/gi, '*_$1_*')
    .replace(/<b>(.*?)<\/b>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '_$1_')
    .replace(/<s>(.*?)<\/s>/gi, '~$1~')
    .replace(/<code>(.*?)<\/code>/gi, '`$1`')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  return text.trim();
}

const STORAGE_KEY = 'church_enseignements';

function loadAll(): Enseignement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAll(data: Enseignement[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function genId(): string {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function importFromPastoralAI(): { days: { day: number; text: string }[]; theme: string } | null {
  try {
    const raw = localStorage.getItem('exhortation-saved-series');
    if (raw) {
      const data = JSON.parse(raw);
      if (data?.days?.length > 0) return data;
    }
  } catch {}
  return null;
}

interface EnseignementModuleProps {
  settings: any;
  members: Member[];
  departments: any[];
}

export default function EnseignementModule({ settings, members, departments }: EnseignementModuleProps) {
  const [enseignements, setEnseignements] = useState<Enseignement[]>(loadAll);
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [editing, setEditing] = useState<Enseignement | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTheme, setEditTheme] = useState('');
  const [editDays, setEditDays] = useState<EnseignementDay[]>([]);
  const [editingDayIndex, setEditingDayIndex] = useState(0);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [msg, setMsg] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);

  useEffect(() => {
    const imported = importFromPastoralAI();
    if (imported && enseignements.length === 0) {
      const existing = loadAll();
      const alreadyHas = existing.some(e => e.theme === imported.theme);
      if (!alreadyHas) {
        const newEns: Enseignement = {
          id: genId(),
          title: imported.theme,
          theme: imported.theme,
          days: imported.days.map(d => ({ day: d.day, title: `Jour ${d.day}`, text: d.text })),
          type: imported.days.length > 1 ? 'series' : 'single',
          dayCount: imported.days.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'draft',
        };
        const updated = [newEns, ...existing];
        saveAll(updated);
        setEnseignements(updated);
      }
    }
  }, []);

  const startNew = () => {
    const imported = importFromPastoralAI();
    if (imported) {
      const newEns: Enseignement = {
        id: genId(),
        title: imported.theme,
        theme: imported.theme,
        days: imported.days.map(d => ({ day: d.day, title: `Jour ${d.day}`, text: d.text })),
        type: imported.days.length > 1 ? 'series' : 'single',
        dayCount: imported.days.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft',
      };
      openEditor(newEns);
    } else {
      const newEns: Enseignement = {
        id: genId(),
        title: '',
        theme: '',
        days: [{ day: 1, title: 'Jour 1', text: '' }],
        type: 'single',
        dayCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft',
      };
      openEditor(newEns);
    }
  };

  const openEditor = (ens: Enseignement) => {
    setEditing(ens);
    setEditTitle(ens.title);
    setEditTheme(ens.theme);
    setEditDays(ens.days.map(d => ({ ...d })));
    setEditingDayIndex(0);
    setScheduleMode(false);
    setScheduledAt('');
    setMsg('');
    setView('edit');
  };

  const handleSave = () => {
    if (!editing) return;
    syncWysiwyg();
    const updated: Enseignement = {
      ...editing,
      title: editTitle,
      theme: editTheme,
      days: editDays,
      dayCount: editDays.length,
      updatedAt: new Date().toISOString(),
    };
    const all = loadAll();
    const idx = all.findIndex(e => e.id === editing.id);
    if (idx !== -1) {
      all[idx] = updated;
    } else {
      all.unshift(updated);
    }
    saveAll(all);
    setEnseignements(all);
    setEditing(updated);
    setMsg('Enregistré ✓');
    setTimeout(() => setMsg(''), 2000);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Supprimer cet enseignement ?')) return;
    const all = loadAll().filter(e => e.id !== id);
    saveAll(all);
    setEnseignements(all);
    if (editing?.id === id) setView('list');
  };

  const handleSchedule = async () => {
    if (!editing || !scheduledAt) return;
    syncWysiwyg();
    setScheduling(true);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < editDays.length; i++) {
      const day = editDays[i];
      const dayDate = new Date(new Date(scheduledAt).getTime() + i * 86400000);
      try {
        const targetMembers = members.filter(m => m.id && selectedRecipients.includes(m.id));
        const body: any = {
          title: `${editTitle} - ${day.title}`,
          text: day.text,
          targetGroup: `${selectedRecipients.length} membre(s) sélectionné(s)`,
          recipients: targetMembers.map(m => ({ name: m.name, phone: m.phone })),
          scheduledAt: dayDate.toISOString(),
        };
        const res = await fetch('/api/whatsapp/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) success++; else failed++;
      } catch { failed++; }
    }

    const updated: Enseignement = { ...editing, status: 'scheduled', scheduledAt, updatedAt: new Date().toISOString() };
    const all = loadAll();
    const idx = all.findIndex(e => e.id === editing.id);
    if (idx !== -1) { all[idx] = updated; saveAll(all); setEnseignements(all); setEditing(updated); }

    setScheduling(false);
    setMsg(`${success}/${editDays.length} jour(s) programmé(s)`);
    setTimeout(() => setMsg(''), 4000);
  };

  const addDay = () => {
    const num = editDays.length + 1;
    setEditDays([...editDays, { day: num, title: `Jour ${num}`, text: '' }]);
  };

  const removeDay = (idx: number) => {
    if (editDays.length <= 1) return;
    setEditDays(editDays.filter((_, i) => i !== idx));
    if (editingDayIndex >= editDays.length - 1) setEditingDayIndex(Math.max(0, editDays.length - 2));
  };

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    syncWysiwyg();
  };

  const transformText = (fn: (t: string) => string) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const text = range.toString();
    if (!text) return;
    range.deleteContents();
    range.insertNode(document.createTextNode(fn(text)));
    sel.removeAllRanges();
    syncWysiwyg();
  };

  const uppercaseBold = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const text = sel.toString();
    if (!text) return;
    document.execCommand('bold', false);
    const sel2 = window.getSelection();
    if (sel2 && !sel2.isCollapsed && sel2.rangeCount) {
      const range = sel2.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text.toUpperCase()));
      sel2.removeAllRanges();
    }
    syncWysiwyg();
  };

  const syncWysiwyg = () => {
    const el = document.getElementById(`wysiwyg-${editing?.id}`);
    if (!el) return;
    const newDays = [...editDays];
    newDays[editingDayIndex] = { ...newDays[editingDayIndex], text: htmlToMarkdown(el.innerHTML) };
    setEditDays(newDays);
  };

  const copyDayText = (text: string) => {
    navigator.clipboard.writeText(text);
    setMsg('Copié ✓');
    setTimeout(() => setMsg(''), 2000);
  };

  const exportWord = () => {
    if (!editing) return;
    const title = editTitle || 'Enseignement';
    const daysHtml = editDays.map(d => `
      <div style="margin-bottom: 24px; page-break-inside: avoid;">
        <h2 style="color: #4f46e5; font-size: 16pt; font-family: 'Calibri', Arial, sans-serif; margin-bottom: 8px; border-bottom: 2px solid #4f46e5; padding-bottom: 4px;">${d.title}</h2>
        <div style="font-size: 11pt; font-family: 'Calibri', Arial, sans-serif; line-height: 1.6; color: #1e293b;">
          ${markdownToHtml(d.text).replace(/<br>/g, '<br>')}
        </div>
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: 'Calibri', Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1e293b; margin: 40px; }
  h1 { color: #4f46e5; font-size: 18pt; border-bottom: 3px double #4f46e5; padding-bottom: 6px; }
  h2 { color: #4f46e5; font-size: 14pt; margin-top: 20px; }
  b, strong { font-weight: bold; }
  i, em { font-style: italic; }
  s { text-decoration: line-through; }
  code { background-color: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 10pt; font-family: 'Courier New', monospace; }
</style></head>
<body>
  <div style="text-align: center; border-bottom: 3px double #4f46e5; padding-bottom: 10px; margin-bottom: 20px;">
    <div style="font-size: 20pt; font-weight: bold; color: #4f46e5;">${title}</div>
    ${editTheme ? `<div style="font-size: 10pt; color: #64748b; margin-top: 4px;">${editTheme}</div>` : ''}
    <div style="font-size: 9pt; color: #94a3b8; margin-top: 4px;">${editDays.length} jour${editDays.length > 1 ? 's' : ''} · ${new Date().toLocaleDateString('fr-FR')}</div>
  </div>
  ${daysHtml}
</body></html>`;

    const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (view === 'edit' && editing) {
    const currentDay = editDays[editingDayIndex] || editDays[0];
    const wysiwygId = `wysiwyg-${editing.id}`;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setView('list')} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
            ← Retour à la liste
          </button>
          <div className="flex items-center gap-2">
            {msg && <span className="text-xs text-emerald-600 font-semibold">{msg}</span>}
            <button onClick={exportWord}
              className="flex items-center gap-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all">
              <FileDown className="w-3.5 h-3.5" /> Word
            </button>
            <button onClick={handleSave} disabled={saving || !editTitle.trim()}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:bg-indigo-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Enregistrer
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: editor */}
          <div className="lg:col-span-8 space-y-3">
            <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
              placeholder="Titre de l'enseignement"
              className="w-full text-sm font-bold p-2.5 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white" />

            <input type="text" value={editTheme} onChange={e => setEditTheme(e.target.value)}
              placeholder="Thème (optionnel)"
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white" />

            {/* Day tabs */}
            {editDays.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {editDays.map((d, i) => (
                  <button key={i} onClick={() => { syncWysiwyg(); setEditingDayIndex(i); }}
                    className={`text-[10px] px-2.5 py-1 rounded-full font-semibold cursor-pointer transition-all ${
                      editingDayIndex === i ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>
                    Jour {d.day}
                    {i === editingDayIndex && editDays.length > 1 && (
                      <span onClick={(e) => { e.stopPropagation(); removeDay(i); }}
                        className="ml-1.5 text-[9px] opacity-60 hover:opacity-100">×</span>
                    )}
                  </button>
                ))}
                <button onClick={() => { syncWysiwyg(); addDay(); }}
                  className="text-[10px] px-2.5 py-1 rounded-full font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer">
                  + Jour
                </button>
              </div>
            )}

            {/* Day title */}
            <input type="text" value={currentDay.title} onChange={e => {
              const newDays = [...editDays];
              newDays[editingDayIndex] = { ...newDays[editingDayIndex], title: e.target.value };
              setEditDays(newDays);
            }}
              placeholder="Titre du jour"
              className="w-full text-xs font-semibold p-2 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white" />

            {/* Formatting toolbar */}
            <div className="flex gap-1 pb-1 flex-wrap">
              <button type="button" onMouseDown={e => { e.preventDefault(); exec('bold'); }} title="Gras"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Bold className="w-3.5 h-3.5" /></button>
              <button type="button" onMouseDown={e => { e.preventDefault(); exec('italic'); }} title="Italique"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Italic className="w-3.5 h-3.5" /></button>
              <button type="button" onMouseDown={e => { e.preventDefault(); exec('bold'); exec('italic'); }} title="Gras italique"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Type className="w-3.5 h-3.5" /></button>
              <span className="w-px bg-slate-200 mx-0.5" />
              <button type="button" onMouseDown={e => { e.preventDefault(); transformText(t => t.toUpperCase()); }} title="Majuscule"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer font-bold text-[10px] leading-none px-2">A<ArrowUp className="w-3 h-3 inline" /></button>
              <button type="button" onMouseDown={e => { e.preventDefault(); transformText(t => t.toLowerCase()); }} title="Minuscule"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer text-[10px] leading-none px-2">a<ArrowDown className="w-3 h-3 inline" /></button>
              <button type="button" onMouseDown={e => { e.preventDefault(); uppercaseBold(); }} title="Majuscule gras"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer font-bold text-[10px] leading-none px-2"><Bold className="w-3 h-3 inline" />A<ArrowUp className="w-3 h-3 inline" /></button>
              <span className="w-px bg-slate-200 mx-0.5" />
              <button type="button" onMouseDown={e => { e.preventDefault(); exec('strikeThrough'); }} title="Barré"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Strikethrough className="w-3.5 h-3.5" /></button>
              <button type="button" onMouseDown={e => { e.preventDefault(); transformText(t => '`' + t + '`'); }} title="Monospace"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Code className="w-3.5 h-3.5" /></button>
              <div className="flex-1" />
              <button type="button" onClick={() => copyDayText(currentDay.text)} title="Copier"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Copy className="w-3.5 h-3.5" /></button>
            </div>

            {/* WYSIWYG editor */}
            <div
              id={wysiwygId}
              contentEditable
              suppressContentEditableWarning
              onInput={syncWysiwyg}
              dangerouslySetInnerHTML={{ __html: markdownToHtml(currentDay.text) }}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white font-sans leading-relaxed min-h-[300px] [&_b]:font-bold [&_i]:italic [&_s]:line-through [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:rounded [&_code]:text-[10px]"
            />
          </div>

          {/* Right: scheduling */}
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Programmation
              </h3>
              {editDays.length > 1 && (
                <p className="text-[10px] text-slate-500">{editDays.length} jours · {editDays.filter(d => d.text.trim()).length} rédigés</p>
              )}
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                <input type="checkbox" checked={scheduleMode} onChange={e => setScheduleMode(e.target.checked)} className="accent-indigo-600" />
                Programmer l'envoi
              </label>
              {scheduleMode && (
                <>
                  <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white" />
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 block">Destinataires</label>
                    <div className="relative">
                      <input type="text" value={recipientSearch}
                        onChange={e => { setRecipientSearch(e.target.value); setShowRecipientDropdown(true); }}
                        onFocus={() => setShowRecipientDropdown(true)}
                        placeholder="Rechercher des membres..."
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white" />
                      {showRecipientDropdown && recipientSearch && (
                        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {members.filter(m => (m.name || '').toLowerCase().includes(recipientSearch.toLowerCase())).slice(0, 10).map(m => {
                            const selected = selectedRecipients.includes(m.id!);
                            return (
                              <button key={m.id} type="button"
                                onClick={() => {
                                  setSelectedRecipients(prev =>
                                    selected ? prev.filter(id => id !== m.id) : [...prev, m.id!]
                                  );
                                  setRecipientSearch('');
                                  setShowRecipientDropdown(false);
                                }}
                                className={`w-full text-left p-2 text-xs hover:bg-indigo-50 cursor-pointer flex items-center gap-2 ${selected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}>
                                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[8px] ${selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                                  {selected ? '✓' : ''}
                                </span>
                                {m.name} — {m.phone || 'Sans téléphone'}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {selectedRecipients.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedRecipients.map(id => {
                          const m = members.find(mm => mm.id === id);
                          if (!m) return null;
                          return (
                            <span key={id} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-medium">
                              {m.name}
                              <button type="button" onClick={() => setSelectedRecipients(prev => prev.filter(x => x !== id))}
                                className="hover:text-indigo-900 cursor-pointer">&times;</button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400">{selectedRecipients.length} membre(s) sélectionné(s)</p>
                  </div>
                  <button onClick={handleSchedule} disabled={scheduling || !scheduledAt || selectedRecipients.length === 0}
                    className="w-full flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all">
                    {scheduling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {scheduling ? 'Programmation...' : `Programmer (${editDays.length} jour${editDays.length > 1 ? 's' : ''}, ${selectedRecipients.length} dst.)`}
                  </button>
                </>
              )}
              <div className="text-[10px] text-slate-400 space-y-1">
                <p>💡 Les jours seront espacés de 24h à partir de la date choisie.</p>
                <p>📱 Les messages seront envoyés via WhatsApp aux membres.</p>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-1.5">
              <h3 className="text-xs font-bold text-slate-700">Informations</h3>
              <div className="text-[10px] text-slate-500 space-y-0.5">
                <p>Type : {editing.type === 'series' ? 'Série' : 'Unique'}</p>
                <p>Jours : {editing.dayCount}</p>
                <p>Créé le : {new Date(editing.createdAt).toLocaleDateString('fr-FR')}</p>
                <p>Statut : {editing.status === 'scheduled' ? 'Programmé' : 'Brouillon'}</p>
                {editing.scheduledAt && <p>Envoi : {new Date(editing.scheduledAt).toLocaleDateString('fr-FR')}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl text-slate-800 font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Enseignements
          </h2>
          <p className="text-xs text-slate-500">Gérez vos exhortations et enseignements.</p>
        </div>
        <button onClick={startNew}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all">
          <Plus className="w-3.5 h-3.5" /> Nouveau
        </button>
      </div>

      {enseignements.length === 0 ? (
        <div className="text-center py-12 text-slate-400 space-y-2">
          <BookOpen className="w-10 h-10 mx-auto opacity-40" />
          <p className="text-sm font-medium">Aucun enseignement</p>
          <p className="text-xs">Les exhortations générées depuis l'Assistant IA apparaîtront ici.</p>
          <button onClick={startNew}
            className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer">
            Créer un enseignement
          </button>
        </div>
      ) : (
        <div className="grid gap-2">
          {enseignements.map(ens => (
            <div key={ens.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-200 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-slate-800 truncate">{ens.title || 'Sans titre'}</h3>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                      ens.status === 'scheduled' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {ens.status === 'scheduled' ? 'Programmé' : 'Brouillon'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span>{ens.dayCount} jour{ens.dayCount > 1 ? 's' : ''}</span>
                    <span>{ens.type === 'series' ? 'Série' : 'Unique'}</span>
                    <span>{new Date(ens.updatedAt).toLocaleDateString('fr-FR')}</span>
                    {ens.scheduledAt && <span className="text-amber-600">📅 {new Date(ens.scheduledAt).toLocaleDateString('fr-FR')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { openEditor(ens); setTimeout(() => exportWord(), 100); }}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 cursor-pointer" title="Exporter Word">
                    <FileDown className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                  <button onClick={() => openEditor(ens)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 cursor-pointer" title="Modifier">
                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                  <button onClick={() => handleDelete(ens.id!)}
                    className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 cursor-pointer" title="Supprimer">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
