import React, { useState, useMemo, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, db, handleFirestoreError, OperationType } from '../firebase';
import { ChurchEvent, ChurchSettings } from '../types';
import { Sparkles, Calendar, Plus, CalendarIcon, Users, User, Clock, AlertTriangle, Trash2, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { generateGoogleCalendarUrl, generateOutlookCalendarUrl } from '../utils/calendar';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ServicePlanningModule from './ServicePlanningModule';

interface EventsModuleProps {
  events: ChurchEvent[];
  loading: boolean;
  onRefresh: () => void;
  settings: ChurchSettings | null;
}

export default function EventsModule({ events, loading, onRefresh, settings }: EventsModuleProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [cultesSubTab, setCultesSubTab] = useState<'activites' | 'planning'>('activites');

  // Dynamically compute worship options from settings
  const worshipCategories = useMemo(() => {
    if (!settings?.worshipTypes) {
      return ["Prédication", "École du dimanche", "Jeûne", "Séminaire", "Culte régulier", "Autre"];
    }
    return settings.worshipTypes.split(',').map(t => t.trim()).filter(t => t.length > 0);
  }, [settings]);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    type: 'Culte régulier' as string,
    date: new Date().toISOString().substring(0, 10),
    time: '10:00',
    attendance: '',
    preacher: '',
    notes: '',
    observations: ''
  });

  // Sync default type value when categories change
  useEffect(() => {
    if (worshipCategories.length > 0) {
      setFormData(prev => {
        if (!worshipCategories.includes(prev.type)) {
          return { ...prev, type: worshipCategories[0] };
        }
        return prev;
      });
    }
  }, [worshipCategories]);

  const resetForm = () => {
    setIsAdding(false);
    setFormData({
      title: '',
      type: worshipCategories[0] || 'Culte régulier',
      date: new Date().toISOString().substring(0, 10),
      time: '10:00',
      attendance: '',
      preacher: '',
      notes: '',
      observations: ''
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setSaving(true);
    const path = 'church_events';
    try {
      await addDoc(collection(db, path), {
        title: formData.title,
        type: formData.type,
        date: formData.date,
        time: formData.time,
        attendance: parseInt(formData.attendance) || 0,
        preacher: formData.preacher,
        notes: formData.notes,
        observations: formData.observations,
        createdAt: new Date().toISOString()
      });

      resetForm();
      onRefresh();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet événement ?")) return;
    const path = `church_events/${id}`;
    try {
      await deleteDoc(doc(db, 'church_events', id));
      onRefresh();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Sorted list of past events for metrics
  const chronologicalEvents = useMemo(() => {
    return [...events].sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);

  // Attendance Statistics & Decline Detection Alerts
  const attendanceMetrics = useMemo(() => {
    if (events.length <= 1) return { decline: false, percent: 0, average: 0 };
    
    const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));
    const latestEvent = sorted[0];
    const previousEvents = sorted.slice(1);
    
    const sum = previousEvents.reduce((acc, curr) => acc + (curr.attendance || 0), 0);
    const averagePrior = sum / previousEvents.length;

    if (averagePrior === 0) return { decline: false, percent: 0, average: 0 };

    const diff = averagePrior - latestEvent.attendance;
    const declinePercent = (diff / averagePrior) * 100;

    return {
      decline: declinePercent >= 15,
      percent: Math.round(declinePercent),
      average: Math.round(averagePrior),
      latestAttendance: latestEvent.attendance,
      latestTitle: latestEvent.title
    };
  }, [events]);

  // Format attendance list for Recharts
  const chartData = useMemo(() => {
    return chronologicalEvents.map(evt => ({
      dateLabel: evt.date,
      attendance: evt.attendance,
      title: evt.title
    }));
  }, [chronologicalEvents]);

  // Dynamically compute fixed worship days from settings
  const fixedWorshipDaysList = useMemo(() => {
    const daysRaw = settings?.worshipDays || "Dimanche, Mercredi";
    return daysRaw.split(',').map(d => d.trim()).filter(d => d.length > 0);
  }, [settings]);

  // Date generator for a French weekday name
  const getCalculatedDateForDay = (frenchDayName: string): { dateStr: string; label: string } => {
    const daysMap: Record<string, number> = {
      'dimanche': 0, 'dim': 0,
      'lundi': 1, 'lun': 1,
      'mardi': 2, 'mar': 2,
      'mercredi': 3, 'mer': 3,
      'jeudi': 4, 'jeu': 4,
      'vendredi': 5, 'ven': 5,
      'samedi': 6, 'sam': 6
    };
    
    const normalized = frenchDayName.toLowerCase().trim();
    let targetDayNum = -1;
    for (const key in daysMap) {
      if (normalized.includes(key)) {
        targetDayNum = daysMap[key];
        break;
      }
    }
    
    if (targetDayNum === -1) {
      const today = new Date();
      return {
        dateStr: today.toISOString().substring(0, 10),
        label: frenchDayName
      };
    }
    
    const now = new Date();
    const currentDayNum = now.getDay();
    
    const diff = targetDayNum - currentDayNum;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + diff);
    
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const formattedDate = targetDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    
    return {
      dateStr,
      label: formattedDate
    };
  };

  // Calendar helpers
  const monthYear = useMemo(() => {
    return currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }, [currentMonth]);

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

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ChurchEvent[]>();
    events.forEach(evt => {
      const existing = map.get(evt.date) || [];
      existing.push(evt);
      map.set(evt.date, existing);
    });
    return map;
  }, [events]);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    setSelectedDay(null);
  };

  const handleDayClick = (date: Date) => {
    const dateStr = date.toISOString().substring(0, 10);
    setSelectedDay(prev => prev === dateStr ? null : dateStr);
  };

  const selectedDayEvents = selectedDay ? (eventsByDate.get(selectedDay) || []) : [];
  const todayStr = new Date().toISOString().substring(0, 10);

  const weekdayHeaders = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const isDateInMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl text-slate-800 dark:text-slate-200 font-bold tracking-tight">Cultes & Événements Paroissiaux</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Planifiez les liturgies, enregistrez les participations et résumez les homélies.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Liste
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Calendrier
            </button>
          </div>
          {!isAdding && (
            <button
              id="btn-add-event"
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm cursor-pointer border border-indigo-500"
            >
              <Plus className="w-4 h-4 text-indigo-200" />
              Programmer Culte / Événement
            </button>
          )}
        </div>
      </div>

      {/* Attendance Decrease Alert */}
      {attendanceMetrics.decline && (
        <div id="attendance-alarm" className="bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-300 p-4 rounded-xl border border-amber-200 dark:border-amber-700 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="text-xs space-y-1">
            <span className="font-bold uppercase block text-amber-800 dark:text-amber-300">Alerte de baisse d'affluence détectée</span>
            <p>
              La participation au dernier culte <strong>"{attendanceMetrics.latestTitle}"</strong> ({attendanceMetrics.latestAttendance} fidèles) est en baisse de <strong>{attendanceMetrics.percent}%</strong> par rapport à la moyenne habituelle ({attendanceMetrics.average} fidèles).
            </p>
            <p className="text-stone-500 dark:text-stone-400 font-light italic">
              Piste d'action pastorale conseillée : Envoyez des messages de soutien via l'onglet <strong>Communications IA</strong> ou planifiez des visites fraternelles.
            </p>
          </div>
        </div>
      )}

      {/* Cultes sub-tabs */}
      <div className="border-b border-slate-200 dark:border-slate-600 flex gap-4 text-xs font-bold overflow-x-auto shrink-0 pb-0.5">
        <button onClick={() => setCultesSubTab('activites')}
          className={`pb-2.5 px-1 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            cultesSubTab === 'activites' ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}>
          <Sparkles className="w-3.5 h-3.5" /> Activités
        </button>
        <button onClick={() => setCultesSubTab('planning')}
          className={`pb-2.5 px-1 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            cultesSubTab === 'planning' ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}>
          <CalendarDays className="w-3.5 h-3.5" /> Planning
        </button>
      </div>

      {cultesSubTab === 'activites' ? (
        <>

      {isAdding && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm space-y-4">
          <h3 className="font-semibold text-sm text-indigo-650 border-b border-slate-100 dark:border-slate-700 pb-2">
            Programmer un culte, jeûne ou séminaire
          </h3>

          {/* Assistant de programmation automatique pour Jours de Cultes Fixes */}
          {fixedWorshipDaysList.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-250/70 dark:border-slate-600 space-y-2">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <span className="font-bold text-[11px] uppercase tracking-wider text-indigo-950 dark:text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                    Assistant de Culte Fixe ({settings?.appName || "Ma Paroisse"})
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                    Planifiez rapidement vos cultes de la semaine. Cliquez sur l'un de vos cultes fixes configurés pour attribuer automatiquement son titre par défaut et la date de ce jour programmé :
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {fixedWorshipDaysList.map((dayName, idx) => {
                  const { dateStr, label } = getCalculatedDateForDay(dayName);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          title: `Culte du ${dayName}`,
                          type: "Culte régulier",
                          date: dateStr
                        }));
                      }}
                      className="bg-white dark:bg-slate-800 hover:border-indigo-500 hover:bg-indigo-50/25 dark:hover:bg-indigo-900/20 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 text-left transition-all cursor-pointer flex flex-col justify-between min-w-[135px] shadow-3xs hover:shadow-xs"
                    >
                      <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100">Culte du {dayName}</span>
                      <span className="text-[9px] text-indigo-600 font-semibold pt-1 mt-auto block capitalize">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1 col-span-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Titre de l'Événement *</label>
              <input 
                type="text" 
                required
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Ex : Culte Dominical - Célébration & Louange"
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Type de Service *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600"
              >
                {worshipCategories.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Date *</label>
              <input 
                type="date" 
                required
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Heure de début *</label>
              <input 
                type="time" 
                required
                value={formData.time}
                onChange={(e) => setFormData({...formData, time: e.target.value})}
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Nombre de Présents</label>
              <input 
                type="number" 
                value={formData.attendance}
                onChange={(e) => setFormData({...formData, attendance: e.target.value})}
                placeholder="Ex : 120"
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Officiant / Prédicateur</label>
              <input 
                type="text" 
                value={formData.preacher}
                onChange={(e) => setFormData({...formData, preacher: e.target.value})}
                placeholder="Ex : Pasteur Michel"
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Thème ou Grands Points de Prédication</label>
              <textarea 
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows={3}
                placeholder="Notes de prédication théologique, versets clés..."
                className="w-full text-xs p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Synthèse & Observations Administratives</label>
              <textarea 
                value={formData.observations}
                onChange={(e) => setFormData({...formData, observations: e.target.value})}
                rows={3}
                placeholder="Observations techniques, incidents, remarques sur l'école du dimanche..."
                className="w-full text-xs p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            <button 
              type="button" 
              onClick={resetForm}
              className="text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-1.5 rounded-md text-sm transition-all cursor-pointer font-medium"
            >
              Annuler
            </button>
            <button 
              type="submit" 
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm font-semibold transition-all cursor-pointer border border-indigo-500 shadow-sm"
            >
              {saving ? "Sauvegarde..." : "Programmer le Culte"}
            </button>
          </div>
        </form>
      )}

      {/* Analytics chart of attendance */}
      {events.length > 0 && (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-650" />
            Suivi des Tendances d'Assistance aux Cultes
          </h3>
          <div className="h-60 w-full text-xs">
            {chartData.length < 2 ? (
              <div className="text-slate-400 dark:text-slate-500 py-10 text-center">Ajoutez d'autres cultes pour tracer la courbe assistancielle.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="attendanceColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="dateLabel" stroke="#999" fontSize={9} />
                  <YAxis stroke="#999" fontSize={9} />
                  <Tooltip wrapperStyle={{ fontSize: 10 }} />
                  <Area type="monotone" dataKey="attendance" stroke="#4F46E5" strokeWidth={2} name="Participants" fillOpacity={1} fill="url(#attendanceColor)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* View: Calendar */}
      {viewMode === 'calendar' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs overflow-hidden">
          {/* Calendar header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer text-slate-600 dark:text-slate-400"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 capitalize">
              {monthYear}
            </h3>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer text-slate-600 dark:text-slate-400"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700">
            {weekdayHeaders.map(day => (
              <div key={day} className="text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 py-2 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((cell, idx) => {
              if (!cell) {
                return <div key={`empty-${idx}`} className="min-h-[90px] sm:min-h-[100px] p-1 bg-slate-50/50 dark:bg-slate-700/20" />;
              }

              const dateStr = cell.toISOString().substring(0, 10);
              const dayEvents = eventsByDate.get(dateStr) || [];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDay;
              const isCurrentMonth = isDateInMonth(cell);

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(cell)}
                  className={`min-h-[90px] sm:min-h-[100px] p-1.5 border-b border-r border-slate-100 dark:border-slate-700 text-left transition-all cursor-pointer relative group ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-900/30'
                      : isToday
                        ? 'bg-blue-50/70 dark:bg-blue-900/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/40 bg-white dark:bg-slate-800'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full mb-1 ${
                    isToday
                      ? 'bg-indigo-600 text-white'
                      : isSelected
                        ? 'bg-indigo-600 text-white'
                        : isCurrentMonth
                          ? 'text-slate-700 dark:text-slate-300'
                          : 'text-slate-300 dark:text-slate-600'
                  }`}>
                    {cell.getDate()}
                  </span>

                  {dayEvents.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {dayEvents.slice(0, 2).map(evt => (
                          <span
                            key={evt.id}
                            className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400"
                            title={`${evt.title} - ${evt.time}`}
                          />
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold">+{dayEvents.length - 2}</span>
                        )}
                      </div>
                      {/* Show first event title on larger screens */}
                      <p className="text-[9px] text-slate-600 dark:text-slate-400 leading-tight hidden sm:block truncate">
                        {dayEvents[0].title}
                      </p>
                    </div>
                  )}

                  {/* Tooltip on hover */}
                  {dayEvents.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-10 bg-slate-800 dark:bg-slate-900 text-white text-[10px] rounded-lg p-2 shadow-lg whitespace-nowrap min-w-[180px]">
                      {dayEvents.map(evt => (
                        <div key={evt.id} className="py-0.5">
                          <span className="font-semibold">{evt.title}</span>
                          <span className="text-slate-300 ml-1">{evt.time}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected day events */}
          {selectedDay && selectedDayEvents.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-700/30">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">
                Événements du {new Date(selectedDay + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h4>
              <div className="space-y-2">
                {selectedDayEvents.map(evt => (
                  <div key={evt.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                      <a href={generateGoogleCalendarUrl({ title: evt.title, date: evt.date, time: evt.time, description: evt.notes })}
                        target="_blank" rel="noopener noreferrer"
                        className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 transition-all"
                        title="Google Calendar">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M7.4 2h9.2L20 5.6V22H4V5.6L7.4 2zm.6 2L5 6.5V20h14V6.5L16 4H8z"/><rect x="8" y="9" width="2" height="2" rx="1"/><rect x="11" y="9" width="2" height="2" rx="1"/><rect x="14" y="9" width="2" height="2" rx="1"/><rect x="8" y="12" width="2" height="2" rx="1"/><rect x="11" y="12" width="2" height="2" rx="1"/><rect x="14" y="12" width="2" height="2" rx="1"/><rect x="8" y="15" width="2" height="2" rx="1"/><rect x="11" y="15" width="2" height="2" rx="1"/></svg>
                      </a>
                      <a href={generateOutlookCalendarUrl({ title: evt.title, date: evt.date, time: evt.time, description: evt.notes })}
                        target="_blank" rel="noopener noreferrer"
                        className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-600 transition-all"
                        title="Outlook">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v2H4V4zm0 4h16v2H4V8zm0 4h16v2H4v-2zm0 4h10v2H4v-2zm13 0h3v2h-3v-2z"/></svg>
                      </a>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{evt.title}</span>
                        <span className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 font-bold rounded shrink-0">{evt.type}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {evt.time}
                        </span>
                        {evt.attendance > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {evt.attendance} participants
                          </span>
                        )}
                        {evt.preacher && (
                          <span className="flex items-center gap-1 truncate">
                            <User className="w-3 h-3" />
                            {evt.preacher}
                          </span>
                        )}
                      </div>
                    </div>
                    {evt.id && (
                      <button
                        onClick={() => handleDelete(evt.id!)}
                        className="hover:text-rose-600 p-1 text-slate-400 dark:text-slate-500 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1 text-[10px] cursor-pointer font-medium shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* View: List */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Chronologie des Cultes et Rassemblements</h3>
          {loading ? (
            <div className="text-slate-500 dark:text-slate-400 py-6 text-center text-xs">Chargement...</div>
          ) : events.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 text-center py-12 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 text-sm">
              Aucun culte recensé pour l'instant. Utilisez le bouton ci-dessus pour planifier de futures assemblées chrétiennes.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...events].sort((a,b) => b.date.localeCompare(a.date)).map(evt => (
                <div key={evt.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 p-5 space-y-4 shadow-xs hover:border-slate-350 dark:hover:border-slate-500 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{evt.title}</h4>
                      <span className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 relative top-1 px-2 py-0.5 font-bold rounded-md">
                        {evt.type}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <a
                        href={generateGoogleCalendarUrl({ title: evt.title, date: evt.date, time: evt.time, description: evt.notes, location: evt.observations })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-all"
                        title="Ajouter à Google Calendar"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M7.4 2h9.2L20 5.6V22H4V5.6L7.4 2zm.6 2L5 6.5V20h14V6.5L16 4H8z"/><rect x="8" y="9" width="2" height="2" rx="1"/><rect x="11" y="9" width="2" height="2" rx="1"/><rect x="14" y="9" width="2" height="2" rx="1"/><rect x="8" y="12" width="2" height="2" rx="1"/><rect x="11" y="12" width="2" height="2" rx="1"/><rect x="14" y="12" width="2" height="2" rx="1"/><rect x="8" y="15" width="2" height="2" rx="1"/><rect x="11" y="15" width="2" height="2" rx="1"/></svg>
                      </a>
                      <a
                        href={generateOutlookCalendarUrl({ title: evt.title, date: evt.date, time: evt.time, description: evt.notes, location: evt.observations })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                        title="Ajouter à Outlook"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v2H4V4zm0 4h16v2H4V8zm0 4h16v2H4v-2zm0 4h10v2H4v-2zm13 0h3v2h-3v-2z"/></svg>
                      </a>
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-600">
                        <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>{evt.attendance || 0} participants</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[11px]">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5 text-indigo-650" />
                      <span>{evt.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span>{evt.time}</span>
                    </div>
                    {evt.preacher && (
                      <div className="flex items-center gap-1 col-span-1 truncate">
                        <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span className="truncate text-slate-700 dark:text-slate-300" title={evt.preacher}>{evt.preacher}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    {evt.notes && (
                      <div className="bg-slate-50/70 dark:bg-slate-700/30 p-2 rounded border border-slate-100 dark:border-slate-700">
                        <span className="font-bold text-slate-400 dark:text-slate-500 block text-[9px] uppercase tracking-wider">Contenu / Prédication</span>
                        <p className="text-slate-700 dark:text-slate-300 line-clamp-3 leading-relaxed font-sans">{evt.notes}</p>
                      </div>
                    )}
                    {evt.observations && (
                      <div className="p-1 font-sans">
                        <span className="font-bold text-slate-400 dark:text-slate-500 block text-[9px] uppercase tracking-wider">Remarques paroissiales</span>
                        <span className="text-slate-600 dark:text-slate-400 italic leading-snug">{evt.observations}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-700">
                    <button 
                      onClick={() => evt.id && handleDelete(evt.id)}
                      className="hover:text-rose-600 p-1 text-slate-400 dark:text-slate-500 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1 text-[11px] cursor-pointer font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer l'historique
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
        </>
      ) : (
        <ServicePlanningModule />
      )}
    </div>
  );
}
