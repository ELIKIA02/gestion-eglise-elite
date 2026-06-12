import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, db, handleFirestoreError, OperationType, onSnapshot, query } from '../firebase';
import { LiturgicalTheme, ChurchSettings, Member } from '../types';
import { Bookmark, Plus, Edit2, Trash2, ChevronLeft, ChevronRight, X, Search, Send, Calendar, Check, Clock } from 'lucide-react';

const COLLECTION = 'church_liturgical_themes';

const defaultSeasonColors: Record<string, string> = {
  avent: 'bg-purple-100 text-purple-700 border-purple-200',
  careme: 'bg-violet-100 text-violet-700 border-violet-200',
  paques: 'bg-amber-100 text-amber-700 border-amber-200',
  pentecote: 'bg-red-100 text-red-700 border-red-200',
  ordinaire: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  noel: 'bg-red-100 text-red-700 border-red-200',
};

const defaultSeasonColorsHex: Record<string, string> = {
  avent: '#7c3aed',
  careme: '#6d28d9',
  paques: '#d97706',
  pentecote: '#dc2626',
  ordinaire: '#059669',
  noel: '#b91c1c',
};

const weekdayHeaders = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

interface LiturgicalThemesModuleProps {
  settings: ChurchSettings | null;
  members: Member[];
}

export default function LiturgicalThemesModule({ settings, members }: LiturgicalThemesModuleProps) {
  const [themes, setThemes] = useState<LiturgicalTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTheme, setEditingTheme] = useState<LiturgicalTheme | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterSeason, setFilterSeason] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formPreacher, setFormPreacher] = useState('');
  const [formBibleText, setFormBibleText] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSeason, setFormSeason] = useState('');
  const [formHymns, setFormHymns] = useState('');
  const [formThemeType, setFormThemeType] = useState('');
  const [formScheduled, setFormScheduled] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const seasonsList = useMemo(() => {
    const raw = settings?.liturgicalSeasons || "Avent, Carême, Pâques, Pentecôte, Ordinaire, Noël";
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }, [settings?.liturgicalSeasons]);

  const typesList = useMemo(() => {
    const raw = settings?.liturgicalTypes || "Dimanche, Mercredi, Spécial, Jeûne, Séminaire";
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }, [settings?.liturgicalTypes]);

  const seasonColor = (s: string) => {
    const key = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const idx = seasonsList.indexOf(s);
    const colors = ['bg-purple-100 text-purple-700 border-purple-200', 'bg-violet-100 text-violet-700 border-violet-200', 'bg-amber-100 text-amber-700 border-amber-200', 'bg-red-100 text-red-700 border-red-200', 'bg-emerald-100 text-emerald-700 border-emerald-200', 'bg-blue-100 text-blue-700 border-blue-200', 'bg-pink-100 text-pink-700 border-pink-200', 'bg-teal-100 text-teal-700 border-teal-200'];
    return colors[idx % colors.length] || 'bg-slate-100 text-slate-600 border-slate-200';
  };

  useEffect(() => {
    const ref = query(collection(db, COLLECTION));
    const unsub = onSnapshot(ref, (snapshot) => {
      const data: LiturgicalTheme[] = [];
      snapshot.forEach((doc) => { data.push({ id: doc.id, ...doc.data() } as LiturgicalTheme); });
      setThemes(data);
      setLoading(false);
    }, (err) => { handleFirestoreError(err, OperationType.LIST, COLLECTION); setLoading(false); });
    return unsub;
  }, []);

  const prevMonth = useCallback(() => { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)); }, [currentMonth]);
  const nextMonth = useCallback(() => { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)); }, [currentMonth]);

  const monthYear = useMemo(() => `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`, [currentMonth]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  }, [currentMonth]);

  const filteredThemes = useMemo(() => {
    return themes.filter(t => {
      const [ty, tm] = t.date.split('-').map(Number);
      const matchesMonth = ty === currentMonth.getFullYear() && tm === (currentMonth.getMonth() + 1);
      const matchesSeason = filterSeason === 'all' || t.season === filterSeason;
      const matchesType = filterType === 'all' || t.themeType === filterType;
      return matchesMonth && matchesSeason && matchesType;
    });
  }, [themes, currentMonth, filterSeason, filterType]);

  const themesByDate = useMemo(() => {
    const map = new Map<string, LiturgicalTheme[]>();
    filteredThemes.forEach(t => { const existing = map.get(t.date) || []; existing.push(t); map.set(t.date, existing); });
    return map;
  }, [filteredThemes]);

  const openAdd = () => {
    setEditingTheme(null);
    setFormTitle(''); setFormDate(new Date().toISOString().substring(0, 10));
    setFormPreacher(''); setFormBibleText(''); setFormDescription('');
    setFormSeason(''); setFormThemeType(typesList[0] || 'Dimanche'); setFormHymns(''); setFormScheduled(false);
    setShowModal(true);
  };

  const openEdit = (theme: LiturgicalTheme) => {
    setEditingTheme(theme);
    setFormTitle(theme.title); setFormDate(theme.date);
    setFormPreacher(theme.preacher || ''); setFormBibleText(theme.bibleText || '');
    setFormDescription(theme.description || ''); setFormSeason(theme.season || '');
    setFormThemeType(theme.themeType || typesList[0] || 'Dimanche'); setFormHymns(theme.hymns || '');
    setFormScheduled(theme.scheduled || false);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingTheme(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDate) return;
    setSaving(true);
    try {
      const data: any = {
        title: formTitle.trim(), date: formDate, preacher: formPreacher.trim(),
        bibleText: formBibleText.trim(), description: formDescription.trim(),
        season: formSeason || '', themeType: formThemeType, hymns: formHymns.trim(), scheduled: formScheduled,
      };
      if (editingTheme) {
        await updateDoc(doc(db, COLLECTION, editingTheme.id!), { ...data, updatedAt: new Date().toISOString() });
      } else {
        await addDoc(collection(db, COLLECTION), { ...data, createdAt: new Date().toISOString() });
      }
      closeModal();
    } catch (err) { handleFirestoreError(err, editingTheme ? OperationType.UPDATE : OperationType.CREATE, COLLECTION);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer ce thème liturgique ?')) return;
    try { await deleteDoc(doc(db, COLLECTION, id)); } catch (err) { handleFirestoreError(err, OperationType.DELETE, `${COLLECTION}/${id}`); }
  };

  const handleScheduleSend = async (theme: LiturgicalTheme) => {
    if (!window.confirm(`Programmer l'envoi du thème "${theme.title}" par WhatsApp ?`)) return;
    setSending(theme.id || null);
    try {
      const text = `📖 *Thème Liturgique* 📖\n\n*${theme.title}*\n📅 ${new Date(theme.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}\n${theme.preacher ? `👤 Prédicateur : ${theme.preacher}\n` : ''}${theme.bibleText ? `📖 Texte : ${theme.bibleText}\n` : ''}${theme.description ? `\n${theme.description}\n` : ''}${theme.hymns ? `\n🎵 Cantiques : ${theme.hymns}` : ''}`;
      await addDoc(collection(db, 'church_communications'), {
        type: 'WhatsApp', title: `Thème: ${theme.title}`,
        template: text, sentToGroup: 'Tous',
        sentAt: new Date().toISOString(), recipientCount: members.length,
        status: 'Envoyé', createdAt: new Date().toISOString()
      });
      await updateDoc(doc(db, COLLECTION, theme.id!), { scheduled: false });
      alert('✅ Thème envoyé par WhatsApp avec succès !');
    } catch (err) { alert('Erreur lors de l\'envoi.'); }
    finally { setSending(null); }
  };

  const isToday = (dateStr: string) => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return dateStr === today;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl text-slate-800 font-bold tracking-tight flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-indigo-600" />
            Thèmes Liturgiques
          </h2>
          <p className="text-xs text-slate-500">Planifiez les thèmes des cultes et célébrations.</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all">
          <Plus className="w-3.5 h-3.5" /> Nouveau thème
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <select value={filterSeason} onChange={e => setFilterSeason(e.target.value)}
            className="bg-transparent border-0 focus:ring-0 text-xs font-medium text-slate-600 outline-none">
            <option value="all">Toutes saisons</option>
            {seasonsList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="bg-transparent border-0 focus:ring-0 text-xs font-medium text-slate-600 outline-none">
            <option value="all">Tous types</option>
            {typesList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="text-xs text-slate-500 font-semibold ml-auto">
          {filteredThemes.length} thème{filteredThemes.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-slate-100">
          <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all cursor-pointer text-slate-500"><ChevronLeft className="w-4 h-4" /></button>
          <h3 className="text-sm font-bold text-slate-700 capitalize">{monthYear}</h3>
          <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all cursor-pointer text-slate-500"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-7 border-b border-slate-100">
          {weekdayHeaders.map(day => <div key={day} className="text-center text-[10px] font-semibold text-slate-400 py-2 uppercase tracking-wider">{day}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((cell, idx) => {
            if (!cell) return <div key={`empty-${idx}`} className="min-h-[100px] p-1 bg-slate-50/50" />;
            const dateStr = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(cell.getDate()).padStart(2, '0')}`;
            const dayThemes = themesByDate.get(dateStr) || [];
            const today = isToday(dateStr);
            return (
              <div key={dateStr} className={`min-h-[100px] p-1.5 border-b border-r border-slate-100 text-left transition-all relative ${today ? 'bg-blue-50/50' : 'bg-white'}`}>
                <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full mb-1 ${today ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>{cell.getDate()}</span>
                <div className="space-y-1">
                  {dayThemes.slice(0, 2).map(theme => (
                    <div key={theme.id} className="text-[9px] leading-tight px-1 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold truncate cursor-pointer hover:bg-indigo-100 transition-colors" title={theme.title} onClick={() => openEdit(theme)}>
                      {theme.scheduled && <span className="mr-0.5 text-green-600">✓</span>}{theme.title}
                    </div>
                  ))}
                  {dayThemes.length > 2 && <span className="text-[9px] text-indigo-500 font-semibold pl-1">+{dayThemes.length - 2}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8 text-xs text-slate-400">Chargement...</div>
        ) : filteredThemes.length === 0 ? (
          <div className="text-center py-8 text-slate-400 space-y-2">
            <Bookmark className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-sm font-medium">Aucun thème pour ce mois</p>
            <button onClick={openAdd} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer">Ajouter un thème</button>
          </div>
        ) : (
          <div className="space-y-2">
            {[...filteredThemes].sort((a, b) => a.date.localeCompare(b.date)).map(theme => (
              <div key={theme.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-200 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-bold text-slate-800">{theme.title}</h3>
                      {theme.season && <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${seasonColor(theme.season)}`}>{theme.season}</span>}
                      {theme.themeType && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">{theme.themeType}</span>}
                      {theme.scheduled && <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-50 text-green-700 border border-green-200"><Clock className="w-2.5 h-2.5" />Programmé</span>}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
                      <span>{new Date(theme.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                      {theme.preacher && <span>Prédicateur : {theme.preacher}</span>}
                      {theme.bibleText && <span className="font-semibold text-slate-600">{theme.bibleText}</span>}
                    </div>
                    {theme.description && <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{theme.description}</p>}
                    {theme.hymns && <p className="text-[10px] text-slate-400 mt-0.5">Cantiques : {theme.hymns}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleScheduleSend(theme)} disabled={sending === theme.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50 text-emerald-700 text-[10px] font-semibold cursor-pointer disabled:opacity-50 transition-all"
                      title="Programmer l'envoi WhatsApp">
                      {sending === theme.id ? <Clock className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Envoyer
                    </button>
                    <button onClick={() => openEdit(theme)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 cursor-pointer" title="Modifier"><Edit2 className="w-3.5 h-3.5 text-slate-500" /></button>
                    <button onClick={() => handleDelete(theme.id!)} className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 cursor-pointer" title="Supprimer"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">{editingTheme ? 'Modifier le thème' : 'Nouveau thème liturgique'}</h3>
              <button onClick={closeModal} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Titre *</label>
                <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} required placeholder="Titre du thème" className="w-full text-sm p-2 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Date *</label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} required className="w-full text-sm p-2 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Prédicateur</label>
                  <input type="text" value={formPreacher} onChange={e => setFormPreacher(e.target.value)} placeholder="Nom" className="w-full text-sm p-2 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Référence biblique</label>
                <input type="text" value={formBibleText} onChange={e => setFormBibleText(e.target.value)} placeholder="Ex: Jean 3:16" className="w-full text-sm p-2 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Description</label>
                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={3} placeholder="Description du thème..." className="w-full text-sm p-2 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Type *</label>
                  <select value={formThemeType} onChange={e => setFormThemeType(e.target.value)} className="w-full text-sm p-2 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white">
                    {typesList.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Saison liturgique</label>
                  <select value={formSeason} onChange={e => setFormSeason(e.target.value)} className="w-full text-sm p-2 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white">
                    <option value="">— Aucune —</option>
                    {seasonsList.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Cantiques</label>
                <input type="text" value={formHymns} onChange={e => setFormHymns(e.target.value)} placeholder="Ex: ADC 45, 120" className="w-full text-sm p-2 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white" />
              </div>
              <label className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={formScheduled} onChange={e => setFormScheduled(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                <span className="text-xs font-medium text-slate-700">Programmer pour envoi WhatsApp</span>
              </label>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="text-xs font-semibold text-slate-500 hover:bg-slate-50 px-4 py-2 rounded-lg cursor-pointer transition-all">Annuler</button>
                <button type="submit" disabled={saving} className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-lg cursor-pointer transition-all">
                  {saving ? 'Enregistrement...' : editingTheme ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
