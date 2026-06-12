import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, db, handleFirestoreError, OperationType, onSnapshot, query } from '../firebase';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, List, Grid3x3, Edit2, Trash2, X, CheckCircle2 } from 'lucide-react';

const COLLECTION = 'church_service_planning';

export interface ServicePlanning {
  id?: string;
  date: string;
  serviceType: 'Culte du dimanche' | 'École du dimanche' | 'Étude biblique' | 'Jeûne' | 'Veillée' | 'Autre';
  preacher: string;
  theme: string;
  bibleText: string;
  worshipLead: string;
  choir: string;
  intercession: string;
  announcements: string;
  notes: string;
  createdAt: string;
}

const serviceTypes: ServicePlanning['serviceType'][] = [
  'Culte du dimanche',
  'École du dimanche',
  'Étude biblique',
  'Jeûne',
  'Veillée',
  'Autre',
];

const weekdayHeaders = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const initialForm: Omit<ServicePlanning, 'id' | 'createdAt'> = {
  date: new Date().toISOString().substring(0, 10),
  serviceType: 'Culte du dimanche',
  preacher: '',
  theme: '',
  bibleText: '',
  worshipLead: '',
  choir: '',
  intercession: '',
  announcements: '',
  notes: '',
};

export default function ServicePlanningModule() {
  const [services, setServices] = useState<ServicePlanning[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<ServicePlanning | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Omit<ServicePlanning, 'id' | 'createdAt'>>({ ...initialForm });

  useEffect(() => {
    const ref = query(collection(db, COLLECTION));
    const unsub = onSnapshot(ref, (snapshot) => {
      const data: ServicePlanning[] = [];
      snapshot.forEach((doc) => { const d = doc.data() || {}; data.push({ id: doc.id, date: d.date || '', serviceType: d.serviceType || 'Culte du dimanche', preacher: d.preacher || '', theme: d.theme || '', bibleText: d.bibleText || '', worshipLead: d.worshipLead || '', choir: d.choir || '', intercession: d.intercession || '', announcements: d.announcements || '', notes: d.notes || '', createdAt: d.createdAt || '' } as ServicePlanning); });
      setServices(data);
      setLoading(false);
    }, (err) => { handleFirestoreError(err, OperationType.LIST, COLLECTION); setLoading(false); });
    return unsub;
  }, []);

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

  const servicesByDate = useMemo(() => {
    const map = new Map<string, ServicePlanning[]>();
    services.forEach(s => {
      const existing = map.get(s.date) || [];
      existing.push(s);
      map.set(s.date, existing);
    });
    return map;
  }, [services]);

  const selectedDayServices = selectedDay ? (servicesByDate.get(selectedDay) || []) : [];
  const todayStr = new Date().toISOString().substring(0, 10);

  const prevMonth = useCallback(() => { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)); setSelectedDay(null); }, [currentMonth]);
  const nextMonth = useCallback(() => { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)); setSelectedDay(null); }, [currentMonth]);

  const handleDayClick = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setSelectedDay(prev => prev === dateStr ? null : dateStr);
  };

  const openAddForDay = (dateStr?: string) => {
    setEditingService(null);
    setForm({
      ...initialForm,
      date: dateStr || new Date().toISOString().substring(0, 10),
    });
    setShowForm(true);
  };

  const openEdit = (service: ServicePlanning) => {
    setEditingService(service);
    setForm({
      date: service.date,
      serviceType: service.serviceType,
      preacher: service.preacher || '',
      theme: service.theme || '',
      bibleText: service.bibleText || '',
      worshipLead: service.worshipLead || '',
      choir: service.choir || '',
      intercession: service.intercession || '',
      announcements: service.announcements || '',
      notes: service.notes || '',
    });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingService(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) return;
    setSaving(true);
    try {
      const data = {
        date: form.date,
        serviceType: form.serviceType,
        preacher: form.preacher.trim(),
        theme: form.theme.trim(),
        bibleText: form.bibleText.trim(),
        worshipLead: form.worshipLead.trim(),
        choir: form.choir.trim(),
        intercession: form.intercession.trim(),
        announcements: form.announcements.trim(),
        notes: form.notes.trim(),
      };
      if (editingService) {
        if (!editingService.id) return;
        await updateDoc(doc(db, COLLECTION, editingService.id), { ...data, updatedAt: new Date().toISOString() });
      } else {
        await addDoc(collection(db, COLLECTION), { ...data, createdAt: new Date().toISOString() });
      }
      closeForm();
    } catch (err) { handleFirestoreError(err, editingService ? OperationType.UPDATE : OperationType.CREATE, COLLECTION);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cette planification ?')) return;
    if (!id) return;
    try { await deleteDoc(doc(db, COLLECTION, id)); } catch (err) { handleFirestoreError(err, OperationType.DELETE, `${COLLECTION}/${id}`); }
  };

  const isDateInMonth = (date: Date) => date.getMonth() === currentMonth.getMonth();

  const futureServices = useMemo(() => {
    return [...services]
      .filter(s => s.date >= todayStr)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [services, todayStr]);

  const serviceTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'Culte du dimanche': 'bg-indigo-100 text-indigo-700 border-indigo-200',
      'École du dimanche': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'Étude biblique': 'bg-amber-100 text-amber-700 border-amber-200',
      'Jeûne': 'bg-violet-100 text-violet-700 border-violet-200',
      'Veillée': 'bg-sky-100 text-sky-700 border-sky-200',
      'Autre': 'bg-slate-100 text-slate-600 border-slate-200',
    };
    return colors[type] || colors['Autre'];
  };

  const dotColor = (type: string) => {
    const colors: Record<string, string> = {
      'Culte du dimanche': 'bg-indigo-500',
      'École du dimanche': 'bg-emerald-500',
      'Étude biblique': 'bg-amber-500',
      'Jeûne': 'bg-violet-500',
      'Veillée': 'bg-sky-500',
      'Autre': 'bg-slate-500',
    };
    return colors[type] || colors['Autre'];
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
        <div>
          <h2 className="text-xl text-slate-800 dark:text-slate-200 font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-600" />
            Planification des Cultes
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Programmez et gérez les services de l'église.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Grid3x3 className="w-3.5 h-3.5" /> Calendrier
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Liste
            </button>
          </div>
          <button
            onClick={() => openAddForDay()}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Planifier
          </button>
        </div>
      </div>

      {viewMode === 'calendar' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-700">
            <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer text-slate-500"><ChevronLeft className="w-4 h-4" /></button>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 capitalize">{monthYear}</h3>
            <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer text-slate-500"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700">
            {weekdayHeaders.map(day => (
              <div key={day} className="text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 py-2 uppercase tracking-wider">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((cell, idx) => {
              if (!cell) return <div key={`empty-${idx}`} className="min-h-[90px] p-1 bg-slate-50/50 dark:bg-slate-700/20" />;
              const dateStr = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(cell.getDate()).padStart(2, '0')}`;
              const dayServices = servicesByDate.get(dateStr) || [];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDay;
              const isCurrentMonth = isDateInMonth(cell);

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(cell)}
                  className={`min-h-[90px] p-1.5 border-b border-r border-slate-100 dark:border-slate-700 text-left transition-all cursor-pointer relative group ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-900/30'
                      : isToday
                        ? 'bg-blue-50/70 dark:bg-blue-900/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/40 bg-white dark:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full ${
                      isToday ? 'bg-indigo-600 text-white' : isCurrentMonth ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600'
                    }`}>{cell.getDate()}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); openAddForDay(dateStr); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-all cursor-pointer"
                      title="Ajouter un service"
                    >
                      <Plus className="w-3 h-3 text-indigo-500" />
                    </button>
                  </div>
                  {dayServices.length > 0 && (
                    <div className="mt-1 space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {dayServices.slice(0, 3).map(s => (
                          <span key={s.id} className={`inline-block w-2 h-2 rounded-full ${dotColor(s.serviceType)}`} title={s.serviceType} />
                        ))}
                        {dayServices.length > 3 && (
                          <span className="text-[8px] text-indigo-600 dark:text-indigo-400 font-semibold">+{dayServices.length - 3}</span>
                        )}
                      </div>
                      <p className="text-[8px] text-slate-500 dark:text-slate-400 leading-tight hidden sm:block truncate">
                        {dayServices[0].theme || dayServices[0].serviceType}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {selectedDay && (
            <div className="border-t border-slate-100 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-700/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Services du {new Date(selectedDay + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h4>
                <button
                  onClick={() => openAddForDay(selectedDay)}
                  className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Ajouter
                </button>
              </div>
              {selectedDayServices.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">Aucun service planifié pour ce jour.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayServices.map(s => (
                    <div key={s.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 p-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${serviceTypeColor(s.serviceType)}`}>{s.serviceType}</span>
                          {s.theme && <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{s.theme}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
                          {s.preacher && <span>Prédicateur : {s.preacher}</span>}
                          {s.worshipLead && <span>Louange : {s.worshipLead}</span>}
                          {s.bibleText && <span className="font-semibold text-indigo-600 dark:text-indigo-400">{s.bibleText}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700 cursor-pointer" title="Modifier"><Edit2 className="w-3.5 h-3.5 text-slate-500" /></button>
                        <button onClick={() => handleDelete(s.id!)} className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 cursor-pointer" title="Supprimer"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {viewMode === 'list' && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Services à venir</h3>
          {loading ? (
            <div className="text-center py-8 text-xs text-slate-400">Chargement...</div>
          ) : futureServices.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 text-center py-12 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 text-sm">
              Aucun service planifié à venir. Utilisez le bouton ci-dessus pour planifier.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {futureServices.map(s => (
                <div key={s.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 p-4 hover:border-indigo-200 dark:hover:border-indigo-700 transition-all shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${serviceTypeColor(s.serviceType)}`}>{s.serviceType}</span>
                        {s.theme && <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{s.theme}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap mt-1">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3 text-indigo-500" />
                          {new Date(s.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        {s.preacher && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" />{s.preacher}</span>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                        {s.bibleText && <span>📖 {s.bibleText}</span>}
                        {s.worshipLead && <span>🎵 {s.worshipLead}</span>}
                        {s.choir && <span>🎤 {s.choir}</span>}
                        {s.intercession && <span>🙏 {s.intercession}</span>}
                      </div>
                      {s.announcements && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 line-clamp-2">{s.announcements}</p>}
                      {s.notes && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 italic line-clamp-1">{s.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer" title="Modifier"><Edit2 className="w-3.5 h-3.5 text-slate-400" /></button>
                      <button onClick={() => handleDelete(s.id!)} className="p-1.5 rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 cursor-pointer" title="Supprimer"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {editingService ? 'Modifier le service' : 'Planifier un service'}
              </h3>
              <button onClick={closeForm} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required
                    className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Type de service *</label>
                  <select value={form.serviceType} onChange={e => setForm({ ...form, serviceType: e.target.value as ServicePlanning['serviceType'] })}
                    className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                    {serviceTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Prédicateur</label>
                <input type="text" value={form.preacher} onChange={e => setForm({ ...form, preacher: e.target.value })} placeholder="Nom du prédicateur"
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Thème</label>
                <input type="text" value={form.theme} onChange={e => setForm({ ...form, theme: e.target.value })} placeholder="Thème du service"
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Texte biblique</label>
                <input type="text" value={form.bibleText} onChange={e => setForm({ ...form, bibleText: e.target.value })} placeholder="Ex: Jean 3:16"
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Responsable louange</label>
                  <input type="text" value={form.worshipLead} onChange={e => setForm({ ...form, worshipLead: e.target.value })} placeholder="Nom"
                    className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Chorale</label>
                  <input type="text" value={form.choir} onChange={e => setForm({ ...form, choir: e.target.value })} placeholder="Nom de la chorale"
                    className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Intercession</label>
                <input type="text" value={form.intercession} onChange={e => setForm({ ...form, intercession: e.target.value })} placeholder="Responsable intercession"
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Annonces</label>
                <textarea value={form.announcements} onChange={e => setForm({ ...form, announcements: e.target.value })} rows={2} placeholder="Annonces paroissiales..."
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 resize-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Notes supplémentaires..."
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 resize-none" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={closeForm}
                  className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2 rounded-lg cursor-pointer transition-all">Annuler</button>
                <button type="submit" disabled={saving}
                  className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-lg cursor-pointer transition-all">
                  {saving ? 'Enregistrement...' : editingService ? 'Enregistrer' : 'Planifier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
