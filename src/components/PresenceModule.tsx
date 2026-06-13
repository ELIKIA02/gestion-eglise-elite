import React, { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, db } from '../firebase';
import { Member, Department } from '../types';
import { CheckCheck, X, Users, Calendar, TrendingUp, BarChart3, Plus, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface AttendanceRecord {
  id?: string;
  date: string;
  eventName: string;
  presentMemberIds: string[];
  notes?: string;
  createdAt: string;
}

const EVENT_TYPES = [
  'Culte dominical', 'Étude biblique', 'Prières', 'Jeûne', 'Réveil',
  'Séminaire', 'École du dimanche', 'Mariage', 'Baptême', 'Funérailles', 'Autre'
];

export default function PresenceModule() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'list' | 'stats'>('list');

  const [formDate, setFormDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [formEvent, setFormEvent] = useState(EVENT_TYPES[0]);
  const [formNotes, setFormNotes] = useState('');
  const [formPresent, setFormPresent] = useState<Set<string>>(new Set());
  const [formSelectAll, setFormSelectAll] = useState(false);

  useEffect(() => {
    const unsubRecords = onSnapshot(query(collection(db, 'church_attendance')), (snapshot) => {
      const items: AttendanceRecord[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as AttendanceRecord));
      setRecords(items.sort((a, b) => b.date.localeCompare(a.date)));
      setLoading(false);
    }, () => setLoading(false));

    const unsubMembers = onSnapshot(query(collection(db, 'church_members')), (snapshot) => {
      const items: Member[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as Member));
      setMembers(items);
    }, () => {});

    const unsubDepts = onSnapshot(query(collection(db, 'church_departments')), (snapshot) => {
      const items: Department[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as Department));
      setDepartments(items);
    }, () => {});

    return () => { unsubRecords(); unsubMembers(); unsubDepts(); };
  }, []);

  const deptNames = useMemo(() => new Set(departments.map(d => d.name.toLowerCase())), [departments]);

  const departmentMembers = useMemo(() =>
    members.filter(m => (m.status === 'Actif' || m.status === 'En observation') && m.ministry && deptNames.has(m.ministry.toLowerCase())),
  [members, deptNames]);

  const monthRecords = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    return records.filter(r => r.date.startsWith(`${year}-${month}`));
  }, [records, currentMonth]);

  const stats = useMemo(() => {
    const totalSessions = monthRecords.length;
    const totalPresent = monthRecords.reduce((s, r) => s + r.presentMemberIds.length, 0);
    const avgAttendance = totalSessions > 0 ? Math.round(totalPresent / totalSessions) : 0;
    const totalMembers = departmentMembers.length;

    const memberAttendance: Record<string, number> = {};
    monthRecords.forEach(r => {
      r.presentMemberIds.forEach(mid => {
        memberAttendance[mid] = (memberAttendance[mid] || 0) + 1;
      });
    });

    return { totalSessions, totalPresent, avgAttendance, totalMembers, memberAttendance };
  }, [monthRecords, departmentMembers]);

  const openAdd = () => {
    const d = new Date();
    setFormDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    setFormEvent(EVENT_TYPES[0]);
    setFormNotes('');
    setFormPresent(new Set());
    setFormSelectAll(false);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formDate || !formEvent) return;
    await addDoc(collection(db, 'church_attendance'), {
      date: formDate,
      eventName: formEvent,
      presentMemberIds: Array.from(formPresent),
      notes: formNotes,
      createdAt: new Date().toISOString(),
    });
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cette séance ?')) return;
    await deleteDoc(doc(db, 'church_attendance', id));
    if (selectedRecord?.id === id) setSelectedRecord(null);
  };

  const toggleMember = (id: string) => {
    setFormPresent(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (formSelectAll) {
      setFormPresent(new Set());
    } else {
      setFormPresent(new Set(departmentMembers.map(m => m.id).filter(Boolean) as string[]));
    }
    setFormSelectAll(!formSelectAll);
  };

  const filteredMembers = useMemo(() => {
    if (!searchTerm) return departmentMembers;
    const term = searchTerm.toLowerCase();
    return departmentMembers.filter(m =>
      m.name.toLowerCase().includes(term) || (m.ministry && m.ministry.toLowerCase().includes(term))
    );
  }, [departmentMembers, searchTerm]);

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

    const totalMembers = departmentMembers.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Présence aux Cultes</h2>
          <p className="text-sm text-slate-500">Suivi d'assistance des membres</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView(view === 'list' ? 'stats' : 'list')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
            {view === 'list' ? '📊 Statistiques' : '📋 Liste'}
          </button>
          <button onClick={openAdd}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Nouvelle séance
          </button>
        </div>
      </div>

      {view === 'stats' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-xl p-4 border border-indigo-200 dark:border-indigo-700">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-semibold mb-1">
                <Calendar className="w-4 h-4" /> Séances
              </div>
              <p className="text-2xl font-bold">{stats.totalSessions}</p>
              <p className="text-xs text-slate-500">ce mois-ci</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-4 border border-emerald-200 dark:border-emerald-700">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-1">
                <Users className="w-4 h-4" /> Moyenne
              </div>
              <p className="text-2xl font-bold">{stats.avgAttendance}</p>
              <p className="text-xs text-slate-500">personnes / séance</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4 border border-amber-200 dark:border-amber-700">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-semibold mb-1">
                <CheckCheck className="w-4 h-4" /> Présents
              </div>
              <p className="text-2xl font-bold">{stats.totalPresent}</p>
              <p className="text-xs text-slate-500">présences totales</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-1">
                <TrendingUp className="w-4 h-4" /> Taux
              </div>
              <p className="text-2xl font-bold">
                {stats.totalSessions > 0 && totalMembers > 0
                  ? `${Math.round((stats.totalPresent / (stats.totalSessions * totalMembers)) * 100)}%`
                  : '—'}
              </p>
              <p className="text-xs text-slate-500">de présence global</p>
            </div>
          </div>

          {/* Top participants */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-sm">Membres les plus assidus</h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {Object.entries(stats.memberAttendance)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([mid, count]) => {
                  const member = members.find(m => m.id === mid);
                  if (!member) return null;
                  const rate = stats.totalSessions > 0 ? Math.round((count / stats.totalSessions) * 100) : 0;
                  return (
                    <div key={mid} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-300">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{member.name}</p>
                          <p className="text-[10px] text-slate-500">{member.ministry || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{count}/{stats.totalSessions}</span>
                        <div className="w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${Math.min(rate, 100)}%` }}></div>
                        </div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-10 text-right">{rate}%</span>
                      </div>
                    </div>
                  );
                })}
              {Object.keys(stats.memberAttendance).length === 0 && (
                <p className="text-center text-slate-400 py-6 text-sm">Aucune donnée ce mois-ci</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Filter by month */}
          <div className="flex items-center justify-between">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" aria-label="Précédent">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-sm">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" aria-label="Suivant">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Records list */}
          {loading ? (
            <p className="text-center text-slate-400 py-8">Chargement...</p>
          ) : monthRecords.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-400 text-sm font-medium">Aucune séance ce mois-ci</p>
              <button onClick={openAdd} className="mt-3 text-indigo-500 hover:text-indigo-600 text-xs font-semibold">
                + Créer une séance de présence
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {monthRecords.map(record => {
                const presentCount = record.presentMemberIds.length;
                const member = members.find(m => m.id === record.presentMemberIds[0]);
                return (
                  <div key={record.id}
                    onClick={() => setSelectedRecord(selectedRecord?.id === record.id ? null : record)}
                    className={`rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedRecord?.id === record.id
                        ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-600'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center shrink-0">
                          <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{record.eventName}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(record.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="font-bold text-lg">{presentCount}</p>
                          <p className="text-[10px] text-slate-500">présents</p>
                        </div>
                        <div className="w-1 h-8 bg-slate-200 dark:bg-slate-600 rounded-full"></div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{totalMembers}</p>
                          <p className="text-[10px] text-slate-500">membres</p>
                        </div>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {selectedRecord?.id === record.id && (
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        {record.notes && (
                          <p className="text-xs text-slate-500 mb-3"><span className="font-medium">Notes:</span> {record.notes}</p>
                        )}

                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold">Membres présents ({presentCount})</h4>
                          <div className="flex gap-2">
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(record.id!); }}
                              className="text-xs text-red-500 hover:text-red-600 font-semibold flex items-center gap-1">
                              <Trash2 className="w-3 h-3" /> Supprimer
                            </button>
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {record.presentMemberIds.length > 0 ? (
                            members.filter(m => record.presentMemberIds.includes(m.id!)).map(m => (
                              <div key={m.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                                    {m.name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-sm">{m.name}</span>
                                </div>
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 text-center py-2">Aucun membre présent</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Add modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold">Nouvelle séance</h3>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Fermer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Date</label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Type de culte</label>
                  <select value={formEvent} onChange={e => setFormEvent(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm">
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Notes (optionnel)</label>
                  <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Ex: Bonne ambiance, audio OK..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold">Membres présents</label>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                          placeholder="Rechercher..." className="pl-7 pr-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 w-36" />
                      </div>
                      <button onClick={toggleSelectAll}
                        className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold">
                        {formSelectAll ? 'Tout désélectionner' : 'Tout sélectionner'}
                      </button>
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredMembers.length === 0 ? (
                      <p className="text-center text-slate-400 py-4 text-xs">Aucun membre trouvé</p>
                    ) : filteredMembers.map(m => (
                      <label key={m.id}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                          formPresent.has(m.id!) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                        }`}>
                        <input type="checkbox" checked={formPresent.has(m.id!)} onChange={() => toggleMember(m.id!)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{m.name}</p>
                          {m.ministry && <p className="text-[10px] text-slate-500 truncate">{m.ministry}</p>}
                        </div>
                        {formPresent.has(m.id!) && <CheckCheck className="w-4 h-4 text-indigo-500 shrink-0" />}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{formPresent.size} membre{formPresent.size > 1 ? 's' : ''} présent{formPresent.size > 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  Annuler
                </button>
                <button onClick={handleSubmit}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
