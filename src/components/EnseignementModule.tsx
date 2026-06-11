import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Plus, Edit2, Trash2, Clock, Calendar, CheckCircle2, Bold, Italic, Strikethrough, Code, Type, ArrowUp, ArrowDown, Loader2, Copy, Send } from 'lucide-react';
import { Enseignement, EnseignementDay, Member } from '../types';

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

// Try to import from PastoralAI series
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
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Auto-import from PastoralAI on mount
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
    setScheduling(true);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < editDays.length; i++) {
      const day = editDays[i];
      const dayDate = new Date(new Date(scheduledAt).getTime() + i * 86400000);
      try {
        const body: any = {
          title: `${editTitle} - ${day.title}`,
          text: day.text,
          targetGroup: 'Tous les membres',
          recipients: members.map(m => ({ name: m.name, phone: m.phone })),
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

  const formatText = (before: string, after: string) => {
    const ta = textRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const current = editDays[editingDayIndex]?.text || '';
    const selected = current.substring(start, end);
    const newText = current.substring(0, start) + before + selected + after + current.substring(end);
    const newDays = [...editDays];
    newDays[editingDayIndex] = { ...newDays[editingDayIndex], text: newText };
    setEditDays(newDays);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const transformSelection = (transform: (t: string) => string) => {
    const ta = textRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return;
    const current = editDays[editingDayIndex]?.text || '';
    const selected = current.substring(start, end);
    const transformed = transform(selected);
    const newText = current.substring(0, start) + transformed + current.substring(end);
    const newDays = [...editDays];
    newDays[editingDayIndex] = { ...newDays[editingDayIndex], text: newText };
    setEditDays(newDays);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, start + transformed.length);
    });
  };

  const copyDayText = (text: string) => {
    navigator.clipboard.writeText(text);
    setMsg('Copié ✓');
    setTimeout(() => setMsg(''), 2000);
  };

  if (view === 'edit' && editing) {
    const currentDay = editDays[editingDayIndex] || editDays[0];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setView('list')} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
            ← Retour à la liste
          </button>
          <div className="flex items-center gap-2">
            {msg && <span className="text-xs text-emerald-600 font-semibold">{msg}</span>}
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
                  <button key={i} onClick={() => setEditingDayIndex(i)}
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
                <button onClick={addDay}
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
            <div className="flex gap-1 pb-1">
              <button type="button" onClick={() => formatText('*', '*')} title="Gras"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Bold className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => formatText('_', '_')} title="Italique"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Italic className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => formatText('*_', '_*')} title="Gras-italique"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Type className="w-3.5 h-3.5" /></button>
              <span className="w-px bg-slate-200 mx-0.5" />
              <button type="button" onClick={() => transformSelection(t => t.toUpperCase())} title="Majuscule"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer font-bold text-[10px] leading-none px-2">A<ArrowUp className="w-3 h-3 inline" /></button>
              <button type="button" onClick={() => transformSelection(t => t.toLowerCase())} title="Minuscule"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer text-[10px] leading-none px-2">a<ArrowDown className="w-3 h-3 inline" /></button>
              <span className="w-px bg-slate-200 mx-0.5" />
              <button type="button" onClick={() => formatText('~', '~')} title="Barré"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Strikethrough className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => formatText('```', '```')} title="Monospace"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Code className="w-3.5 h-3.5" /></button>
              <div className="flex-1" />
              <button type="button" onClick={() => copyDayText(currentDay.text)} title="Copier"
                className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"><Copy className="w-3.5 h-3.5" /></button>
            </div>
            <textarea ref={textRef} value={currentDay.text} onChange={e => {
              const newDays = [...editDays];
              newDays[editingDayIndex] = { ...newDays[editingDayIndex], text: e.target.value };
              setEditDays(newDays);
            }}
              rows={12}
              placeholder="Écrivez le contenu..."
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white font-sans leading-relaxed" />
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
                  <button onClick={handleSchedule} disabled={scheduling || !scheduledAt}
                    className="w-full flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all">
                    {scheduling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {scheduling ? 'Programmation...' : `Programmer (${editDays.length} jour${editDays.length > 1 ? 's' : ''})`}
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
