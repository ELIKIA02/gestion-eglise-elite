import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, query, onSnapshot, db } from '../firebase';
import { Member, PastoralVisit } from '../types';
import { HeartHandshake, Search, Filter, Plus, ChevronDown, ChevronUp, X } from 'lucide-react';

interface PastoralVisitsModuleProps {
  members: Member[];
}

const VISIT_TYPES: PastoralVisit['visitType'][] = [
  'Visite domicile',
  'Visite hôpital',
  'Visite prison',
  'Accompagnement',
  'Autre',
];

export default function PastoralVisitsModule({ members }: PastoralVisitsModuleProps) {
  const [visits, setVisits] = useState<PastoralVisit[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    memberSearch: '',
    memberId: '',
    memberName: '',
    visitDate: new Date().toISOString().substring(0, 10),
    visitType: 'Visite domicile' as PastoralVisit['visitType'],
    purpose: '',
    report: '',
    prayerNeeds: '',
    pastoralNotes: '',
    visitedBy: '',
  });

  const [filterMember, setFilterMember] = useState('');
  const [filterType, setFilterType] = useState('');

  const memberFiltered = useMemo(() => {
    if (!formData.memberSearch.trim()) return [];
    const q = formData.memberSearch.toLowerCase();
    return members.filter(m => (m.name || '').toLowerCase().includes(q)).slice(0, 10);
  }, [members, formData.memberSearch]);

  useEffect(() => {
    const q = query(collection(db, 'church_visits'));
    const unsub = onSnapshot(q, (snapshot) => {
      const arr: PastoralVisit[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        arr.push({
          id: doc.id,
          memberId: d.memberId || '',
          memberName: d.memberName || '',
          visitDate: d.visitDate || '',
          visitType: d.visitType || '',
          purpose: d.purpose || '',
          report: d.report || '',
          prayerNeeds: d.prayerNeeds || '',
          pastoralNotes: d.pastoralNotes || '',
          visitedBy: d.visitedBy || '',
          createdAt: d.createdAt || '',
        } as PastoralVisit);
      });
      arr.sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || ''));
      setVisits(arr);
    });
    return unsub;
  }, []);

  const resetForm = () => {
    setIsAdding(false);
    setFormData({
      memberSearch: '',
      memberId: '',
      memberName: '',
      visitDate: new Date().toISOString().substring(0, 10),
      visitType: 'Visite domicile',
      purpose: '',
      report: '',
      prayerNeeds: '',
      pastoralNotes: '',
      visitedBy: '',
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.memberName.trim() || !formData.visitDate) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'church_visits'), {
        memberId: formData.memberId || '',
        memberName: formData.memberName,
        visitDate: formData.visitDate,
        visitType: formData.visitType,
        purpose: formData.purpose,
        report: formData.report,
        prayerNeeds: formData.prayerNeeds,
        pastoralNotes: formData.pastoralNotes,
        visitedBy: formData.visitedBy,
        createdAt: new Date().toISOString(),
      });
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const filteredVisits = useMemo(() => {
    return visits.filter(v => {
      if (filterMember && !(v.memberName || '').toLowerCase().includes(filterMember.toLowerCase())) return false;
      if (filterType && v.visitType !== filterType) return false;
      return true;
    });
  }, [visits, filterMember, filterType]);

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl text-slate-800 dark:text-slate-200 font-bold tracking-tight flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-indigo-600" />
            Visites Pastorales
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {visits.length} visite{visits.length !== 1 ? 's' : ''} enregistrée{visits.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm cursor-pointer border border-indigo-500"
          >
            <Plus className="w-4 h-4 text-indigo-200" />
            Nouvelle visite
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm space-y-4">
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-2">
            Enregistrer une visite pastorale
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 relative">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Membre *</label>
              <input
                type="text"
                value={formData.memberSearch}
                onChange={(e) => {
                  setFormData({ ...formData, memberSearch: e.target.value, memberId: '', memberName: '' });
                }}
                placeholder="Rechercher un membre..."
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              />
              {formData.memberSearch && !formData.memberName && memberFiltered.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {memberFiltered.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        memberSearch: m.name,
                        memberId: m.id || '',
                        memberName: m.name,
                      })}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
              {formData.memberName && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md font-medium">
                    {formData.memberName}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, memberSearch: '', memberId: '', memberName: '' })}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label="Fermer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Date de visite *</label>
              <input
                type="date"
                required
                value={formData.visitDate}
                onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Type de visite *</label>
              <select
                value={formData.visitType}
                onChange={(e) => setFormData({ ...formData, visitType: e.target.value as PastoralVisit['visitType'] })}
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600"
              >
                {VISIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Visité par</label>
              <input
                type="text"
                value={formData.visitedBy}
                onChange={(e) => setFormData({ ...formData, visitedBy: e.target.value })}
                placeholder="Pasteur, ancien, etc."
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">But de la visite</label>
            <textarea
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              rows={2}
              placeholder="Motif de la visite..."
              className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Compte-rendu</label>
              <textarea
                value={formData.report}
                onChange={(e) => setFormData({ ...formData, report: e.target.value })}
                rows={3}
                placeholder="Déroulement de la visite..."
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Besoins en prière</label>
              <textarea
                value={formData.prayerNeeds}
                onChange={(e) => setFormData({ ...formData, prayerNeeds: e.target.value })}
                rows={3}
                placeholder="Requêtes de prière..."
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">Notes pastorales</label>
              <textarea
                value={formData.pastoralNotes}
                onChange={(e) => setFormData({ ...formData, pastoralNotes: e.target.value })}
                rows={3}
                placeholder="Observations et suivi..."
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
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
              {saving ? 'Sauvegarde...' : 'Enregistrer la visite'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={filterMember}
                onChange={(e) => setFilterMember(e.target.value)}
                placeholder="Filtrer par membre..."
                className="w-full text-sm pl-9 p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              />
            </div>
            <div className="relative w-full sm:w-56">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full text-sm pl-9 p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600"
              >
                <option value="">Tous les types</option>
                {VISIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="text-left p-3 font-semibold">Date</th>
                <th className="text-left p-3 font-semibold">Membre</th>
                <th className="text-left p-3 font-semibold">Type</th>
                <th className="text-left p-3 font-semibold hidden md:table-cell">But</th>
                <th className="text-left p-3 font-semibold hidden sm:table-cell">Visité par</th>
                <th className="p-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400 dark:text-slate-500 text-sm">
                    Aucune visite trouvée
                  </td>
                </tr>
              ) : (
                filteredVisits.map(visit => (
                  <React.Fragment key={visit.id}>
                    <tr
                      className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-all cursor-pointer"
                      onClick={() => setExpandedId(expandedId === visit.id ? null : (visit.id || null))}
                    >
                      <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{visit.visitDate}</td>
                      <td className="p-3 text-slate-800 dark:text-slate-200 font-semibold">{visit.memberName}</td>
                      <td className="p-3">
                        <span className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 font-bold rounded-md">
                          {visit.visitType}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400 hidden md:table-cell truncate max-w-[200px]">
                        {visit.purpose || '—'}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                        {visit.visitedBy || '—'}
                      </td>
                      <td className="p-3 text-slate-400">
                        {expandedId === visit.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </td>
                    </tr>
                    {expandedId === visit.id && (
                      <tr className="bg-slate-50/70 dark:bg-slate-700/20">
                        <td colSpan={6} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div>
                              <span className="font-bold text-slate-400 dark:text-slate-500 block text-[9px] uppercase tracking-wider mb-1">But</span>
                              <p className="text-slate-700 dark:text-slate-300">{visit.purpose || 'Non renseigné'}</p>
                            </div>
                            <div>
                              <span className="font-bold text-slate-400 dark:text-slate-500 block text-[9px] uppercase tracking-wider mb-1">Compte-rendu</span>
                              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{visit.report || 'Non renseigné'}</p>
                            </div>
                            <div>
                              <span className="font-bold text-slate-400 dark:text-slate-500 block text-[9px] uppercase tracking-wider mb-1">Besoins en prière</span>
                              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{visit.prayerNeeds || 'Non renseigné'}</p>
                            </div>
                            <div className="md:col-span-3">
                              <span className="font-bold text-slate-400 dark:text-slate-500 block text-[9px] uppercase tracking-wider mb-1">Notes pastorales</span>
                              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{visit.pastoralNotes || 'Non renseigné'}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
