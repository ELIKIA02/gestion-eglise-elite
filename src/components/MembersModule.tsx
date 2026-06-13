import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, db, handleFirestoreError, OperationType } from '../firebase';
import { Member, MemberStatus, Department, ChurchSettings } from '../types';
import { Search, UserPlus, Mail, Phone, Edit2, Trash2, Filter, Eye, X, Calendar, MapPin, Users, Award, List, Grid3x3, ChevronLeft, ChevronRight, Upload, Gift, HeartHandshake } from 'lucide-react';
import AnniversariesModule from './AnniversariesModule';
import PastoralVisitsModule from './PastoralVisitsModule';

interface MembersModuleProps {
  members: Member[];
  departments: Department[];
  loading: boolean;
  onRefresh: () => void;
  settings?: ChurchSettings | null;
}

const FALLBACK_MINISTRIES = ["Accueil (Ushers)", "Musique & Louange", "École du dimanche", "Médias & Technique", "Jeunesse", "Intercession", "Aucun"];

const GROUPS = ["Groupe de Jeunesse", "Groupe des Femmes", "Groupe des Hommes", "Groupe des Mariés", "École du dimanche", "Aucun"];

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function groupCounts(members: Member[]) {
  const counts: Record<string, number> = {};
  for (const g of GROUPS) counts[g] = 0;
  for (const m of members) {
    const key = m.group && GROUPS.includes(m.group) ? m.group : 'Aucun';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

export default function MembersModule({ members, departments, loading, onRefresh, settings }: MembersModuleProps) {
  const MINISTRIES = departments.length > 0
    ? [...departments.map(d => d.name), 'Aucun']
    : FALLBACK_MINISTRIES;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ministryFilter, setMinistryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [searchTerm, statusFilter, ministryFilter]);

  const [memberSubTab, setMemberSubTab] = useState<'liste' | 'anniversaires' | 'visites'>('liste');

  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    status: 'Actif' as MemberStatus,
    ministry: 'Aucun',
    birthday: '',
    address: '',
    group: 'Aucun',
    birthPlace: '',
    nationality: '',
    gender: '',
    maritalStatus: '',
    profession: '',
    conversionDate: '',
    formerChurch: '',
    arrivalDate: '',
    baptized: '',
    baptismDate: '',
    talents: '',
    motivation: '',
    spouseName: '',
    childrenCount: '',
    childrenAges: '',
    emergencyPhone: '',
    emergencyContact: '',
  });

  const [saving, setSaving] = useState(false);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const d = json.data || json;
        setFormData(prev => ({
          ...prev,
          name: d.name || prev.name,
          email: d.email || prev.email,
          phone: d.phone || prev.phone,
          birthday: d.birthday || prev.birthday,
          birthPlace: d.birthPlace || prev.birthPlace,
          nationality: d.nationality || prev.nationality,
          gender: d.gender || prev.gender,
          maritalStatus: d.maritalStatus || prev.maritalStatus,
          profession: d.profession || prev.profession,
          address: d.address || prev.address,
          conversionDate: d.conversionDate || prev.conversionDate,
          formerChurch: d.formerChurch || prev.formerChurch,
          arrivalDate: d.arrivalDate || prev.arrivalDate,
          baptized: d.baptized || prev.baptized,
          baptismDate: d.baptismDate || prev.baptismDate,
          talents: d.talents || prev.talents,
          motivation: d.motivation || prev.motivation,
          spouseName: d.spouseName || prev.spouseName,
          childrenCount: d.childrenCount || prev.childrenCount,
          childrenAges: d.childrenAges || prev.childrenAges,
          emergencyPhone: d.emergencyPhone || prev.emergencyPhone,
          emergencyContact: d.emergencyContact || prev.emergencyContact,
        }));
        setIsAdding(true);
        setEditingId(null);
      } catch {
        alert('Erreur : fichier JSON invalide.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      status: 'Actif',
      ministry: 'Aucun',
      birthday: '',
      address: '',
      group: 'Aucun',
      birthPlace: '',
      nationality: '',
      gender: '',
      maritalStatus: '',
      profession: '',
      conversionDate: '',
      formerChurch: '',
      arrivalDate: '',
      baptized: '',
      baptismDate: '',
      talents: '',
      motivation: '',
      spouseName: '',
      childrenCount: '',
      childrenAges: '',
      emergencyPhone: '',
      emergencyContact: '',
    });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    const path = 'church_members';
    try {
      await addDoc(collection(db, path), {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        status: formData.status,
        ministry: formData.ministry,
        birthday: formData.birthday || null,
        address: formData.address || null,
        group: formData.group || null,
        birthPlace: formData.birthPlace || null,
        nationality: formData.nationality || null,
        gender: formData.gender || null,
        maritalStatus: formData.maritalStatus || null,
        profession: formData.profession || null,
        conversionDate: formData.conversionDate || null,
        formerChurch: formData.formerChurch || null,
        arrivalDate: formData.arrivalDate || null,
        baptized: formData.baptized || null,
        baptismDate: formData.baptismDate || null,
        talents: formData.talents || null,
        motivation: formData.motivation || null,
        spouseName: formData.spouseName || null,
        childrenCount: formData.childrenCount || null,
        childrenAges: formData.childrenAges || null,
        emergencyPhone: formData.emergencyPhone || null,
        emergencyContact: formData.emergencyContact || null,
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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !formData.name.trim()) return;

    setSaving(true);
    const path = `church_members/${editingId}`;
    try {
      await updateDoc(doc(db, 'church_members', editingId), {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        status: formData.status,
        ministry: formData.ministry,
        birthday: formData.birthday || null,
        address: formData.address || null,
        group: formData.group || null,
        birthPlace: formData.birthPlace || null,
        nationality: formData.nationality || null,
        gender: formData.gender || null,
        maritalStatus: formData.maritalStatus || null,
        profession: formData.profession || null,
        conversionDate: formData.conversionDate || null,
        formerChurch: formData.formerChurch || null,
        arrivalDate: formData.arrivalDate || null,
        baptized: formData.baptized || null,
        baptismDate: formData.baptismDate || null,
        talents: formData.talents || null,
        motivation: formData.motivation || null,
        spouseName: formData.spouseName || null,
        childrenCount: formData.childrenCount || null,
        childrenAges: formData.childrenAges || null,
        emergencyPhone: formData.emergencyPhone || null,
        emergencyContact: formData.emergencyContact || null,
      });
      resetForm();
      onRefresh();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce membre ?")) return;
    const path = `church_members/${id}`;
    try {
      await deleteDoc(doc(db, 'church_members', id));
      onRefresh();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const startEdit = (member: Member) => {
    setEditingId(member.id || null);
    setFormData({
      name: member.name,
      email: member.email,
      phone: member.phone,
      status: member.status,
      ministry: member.ministry,
      birthday: member.birthday || '',
      address: member.address || '',
      group: member.group || 'Aucun',
      birthPlace: member.birthPlace || '',
      nationality: member.nationality || '',
      gender: member.gender || '',
      maritalStatus: member.maritalStatus || '',
      profession: member.profession || '',
      conversionDate: member.conversionDate || '',
      formerChurch: member.formerChurch || '',
      arrivalDate: member.arrivalDate || '',
      baptized: member.baptized || '',
      baptismDate: member.baptismDate || '',
      talents: member.talents || '',
      motivation: member.motivation || '',
      spouseName: member.spouseName || '',
      childrenCount: member.childrenCount || '',
      childrenAges: member.childrenAges || '',
      emergencyPhone: member.emergencyPhone || '',
      emergencyContact: member.emergencyContact || '',
    });
    setIsAdding(true);
    setViewingMember(null);
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          member.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
    const matchesMinistry = ministryFilter === 'all' || member.ministry === ministryFilter;

    return matchesSearch && matchesStatus && matchesMinistry;
  });

  const counts = groupCounts(members);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl text-slate-800 dark:text-slate-200 font-bold tracking-tight">Registre des Membres ({filteredMembers.length})</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Gérez les fidèles, assignations de ministères et statuts d'activité.</p>
        </div>
        {!isAdding && (
          <div className="flex items-center gap-2">
            <button
              id="btn-add-member"
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm cursor-pointer border border-indigo-500"
            >
              <UserPlus className="w-4 h-4 text-indigo-200 dark:text-indigo-300" />
              Nouveau Membre
            </button>
            <button
              onClick={() => document.getElementById('import-json-input')?.click()}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm cursor-pointer border border-emerald-500"
            >
              <Upload className="w-4 h-4" />
              Importer JSON
            </button>
            <input id="import-json-input" type="file" accept=".json" className="hidden"
              onChange={handleImportJson} />
          </div>
        )}
      </div>

      <div className="border-b border-slate-200 dark:border-slate-600 flex gap-3 text-xs font-bold overflow-x-auto shrink-0">
        <button onClick={() => setMemberSubTab('liste')}
          className={`pb-2 px-1 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            memberSubTab === 'liste' ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}>
          <Users className="w-3.5 h-3.5" /> Membres
        </button>
        <button onClick={() => setMemberSubTab('anniversaires')}
          className={`pb-2 px-1 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            memberSubTab === 'anniversaires' ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}>
          <Gift className="w-3.5 h-3.5" /> Anniversaires
        </button>
        <button onClick={() => setMemberSubTab('visites')}
          className={`pb-2 px-1 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            memberSubTab === 'visites' ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}>
          <HeartHandshake className="w-3.5 h-3.5" /> Visites Pastorales
        </button>
      </div>

      {memberSubTab === 'liste' && (
        <>
        {/* Group Stats Row */}
        <div className="flex flex-wrap gap-2">
          {GROUPS.map(g => {
            const count = counts[g] || 0;
            return (
              <div key={g} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs shadow-xs">
                <Users className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span className="font-medium text-slate-700 dark:text-slate-300">{g}</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 ml-0.5">{count}</span>
              </div>
            );
          })}
        </div>

        {isAdding && (
          <form onSubmit={editingId ? handleUpdate : handleCreate} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm space-y-4">
            <h3 className="font-semibold text-sm text-indigo-650 dark:text-indigo-400 border-b border-slate-100 dark:border-slate-700 pb-2">
              {editingId ? "Modifier la fiche de membre" : "Ajouter un nouveau membre dans le registre"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Nom Complet *</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Ex: Jean-Louis Kabange"
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Date de Naissance</label>
                <input type="date" value={formData.birthday} onChange={(e) => setFormData({...formData, birthday: e.target.value})}
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Lieu de Naissance</label>
                <input type="text" value={formData.birthPlace} onChange={(e) => setFormData({...formData, birthPlace: e.target.value})}
                  placeholder="Ex: Brazzaville"
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Nationalité</label>
                <input type="text" value={formData.nationality} onChange={(e) => setFormData({...formData, nationality: e.target.value})}
                  placeholder="Ex: Congolaise"
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Sexe</label>
                <select value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})}
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-indigo-600 dark:focus:outline-indigo-400">
                  <option value="">—</option><option value="Masculin">Masculin</option><option value="Féminin">Féminin</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Situation Matrimoniale</label>
                <select value={formData.maritalStatus} onChange={(e) => setFormData({...formData, maritalStatus: e.target.value})}
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-indigo-600 dark:focus:outline-indigo-400">
                  <option value="">—</option><option value="Célibataire">Célibataire</option><option value="Marié(e)">Marié(e)</option><option value="Divorcé(e)">Divorcé(e)</option><option value="Veuf(ve)">Veuf(ve)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Profession</label>
                <input type="text" value={formData.profession} onChange={(e) => setFormData({...formData, profession: e.target.value})}
                  placeholder="Ex: Enseignant"
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="Ex: j.kabange@gmail.com"
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Téléphone / WhatsApp</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="Ex: +242 06 123 4567"
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Adresse</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Ex: 12 Rue de l'Église, Brazzaville"
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
            </div>

            <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider pt-2">Vie Spirituelle</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Date de Conversion</label>
                <input type="date" value={formData.conversionDate} onChange={(e) => setFormData({...formData, conversionDate: e.target.value})}
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Ancienne Église</label>
                <input type="text" value={formData.formerChurch} onChange={(e) => setFormData({...formData, formerChurch: e.target.value})}
                  placeholder="Ex: Assemblée de Dieu"
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Date d'Arrivée dans l'Église</label>
                <input type="date" value={formData.arrivalDate} onChange={(e) => setFormData({...formData, arrivalDate: e.target.value})}
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Baptême</label>
                <select value={formData.baptized} onChange={(e) => setFormData({...formData, baptized: e.target.value})}
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-indigo-600 dark:focus:outline-indigo-400">
                  <option value="">—</option><option value="Oui">Oui</option><option value="Non">Non</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Date de Baptême</label>
                <input type="date" value={formData.baptismDate} onChange={(e) => setFormData({...formData, baptismDate: e.target.value})}
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
            </div>

            <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider pt-2">Engagement & Ministère</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Ministère</label>
                <select value={formData.ministry} onChange={(e) => setFormData({...formData, ministry: e.target.value})}
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-indigo-600 dark:focus:outline-indigo-400">
                  {MINISTRIES.map(m => (<option key={m} value={m}>{m}</option>))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Groupe</label>
                <select value={formData.group} onChange={(e) => setFormData({...formData, group: e.target.value})}
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-indigo-600 dark:focus:outline-indigo-400">
                  {GROUPS.map(g => (<option key={g} value={g}>{g}</option>))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Dons / Talents</label>
                <textarea value={formData.talents} onChange={(e) => setFormData({...formData, talents: e.target.value})}
                  placeholder="Ex: Chant, musique, enseignement..."
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 min-h-[60px]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Motivation</label>
                <textarea value={formData.motivation} onChange={(e) => setFormData({...formData, motivation: e.target.value})}
                  placeholder="Pourquoi souhaitez-vous servir ?"
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 min-h-[60px]" />
              </div>
            </div>

            <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider pt-2">Famille</h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Nom du Conjoint(e)</label>
                <input type="text" value={formData.spouseName} onChange={(e) => setFormData({...formData, spouseName: e.target.value})}
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Nombre d'Enfants</label>
                <input type="text" value={formData.childrenCount} onChange={(e) => setFormData({...formData, childrenCount: e.target.value})}
                  placeholder="Ex: 3"
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Âges des Enfants</label>
                <input type="text" value={formData.childrenAges} onChange={(e) => setFormData({...formData, childrenAges: e.target.value})}
                  placeholder="Ex: 5, 8, 12 ans"
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Téléphone Urgence</label>
                <input type="tel" value={formData.emergencyPhone} onChange={(e) => setFormData({...formData, emergencyPhone: e.target.value})}
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Contact d'Urgence (Nom & Lien)</label>
                <input type="text" value={formData.emergencyContact} onChange={(e) => setFormData({...formData, emergencyContact: e.target.value})}
                  placeholder="Ex: Marie Kabange, sœur"
                  className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
            </div>

            <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider pt-2">Statut & Service</h4>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={resetForm}
                className="text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 px-3 py-1.5 rounded-md text-sm transition-all cursor-pointer font-medium"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md text-sm font-semibold transition-all cursor-pointer border border-indigo-500 shadow-sm"
              >
                {saving ? "Enregistrement..." : editingId ? "Enregistrer les modifications" : "Ajouter le membre"}
              </button>
            </div>
          </form>
        )}

        {/* Filters & Search Row */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/90 dark:border-slate-600 flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher par nom, email, téléphone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-indigo-600 dark:focus:outline-indigo-400 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-white dark:bg-slate-700 border border-stone-200 dark:border-stone-600 rounded-lg px-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent border-0 focus:ring-0 py-1 text-xs text-slate-700 dark:text-slate-300"
              >
                <option value="all">Tous les Statuts</option>
                <option value="Actif">Actif</option>
                <option value="Inactif">Inactif</option>
                <option value="En observation">En observation</option>
              </select>
            </div>

            <div className="flex items-center gap-1 bg-white dark:bg-slate-700 border border-stone-200 dark:border-stone-600 rounded-lg px-2 text-xs">
              <Award className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
              <select
                value={ministryFilter}
                onChange={(e) => setMinistryFilter(e.target.value)}
                className="bg-transparent border-0 focus:ring-0 py-1 text-xs text-slate-700 dark:text-slate-300"
              >
                <option value="all">Tous les Ministères</option>
                {MINISTRIES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* View toggle + result count */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{filteredMembers.length} membre(s)</span>
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 border border-slate-200 dark:border-slate-600">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Grid3x3 className="w-3.5 h-3.5" /> Cartes
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Tableau
            </button>
          </div>
        </div>

        {/* Vue Tableau compact avec pagination */}
        {viewMode === 'table' && !loading && filteredMembers.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                    <th className="text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">Nom</th>
                    <th className="text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px] hidden md:table-cell">Email</th>
                    <th className="text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px] hidden lg:table-cell">Téléphone</th>
                    <th className="text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">Statut</th>
                    <th className="text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px] hidden lg:table-cell">Ministère</th>
                    <th className="text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px] hidden xl:table-cell">Groupe</th>
                    <th className="text-right px-3 py-2 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.slice((page - 1) * pageSize, page * pageSize).map((member, idx) => (
                    <tr key={member.id} className={`border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/30 dark:bg-slate-800/50'}`}>
                      <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{member.name}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400 hidden md:table-cell truncate max-w-[180px]">{member.email || '—'}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400 hidden lg:table-cell">{member.phone || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          member.status === 'Actif' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                          member.status === 'Inactif' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                          'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                        }`}>{member.status}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400 hidden lg:table-cell truncate max-w-[140px]">{member.ministry}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400 hidden xl:table-cell">{member.group && member.group !== 'Aucun' ? member.group : '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setViewingMember(member)} className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-400 dark:text-slate-500 cursor-pointer" title="Voir"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => startEdit(member)} className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-400 dark:text-slate-500 cursor-pointer" title="Modifier"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => member.id && handleDelete(member.id)} className="p-1 hover:text-rose-600 dark:hover:text-rose-400 text-slate-400 dark:text-slate-500 cursor-pointer" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {filteredMembers.length > pageSize && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/30">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredMembers.length)} sur {filteredMembers.length}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    aria-label="Précédent"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => (p * pageSize < filteredMembers.length ? p + 1 : p))}
                    disabled={page * pageSize >= filteredMembers.length}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    aria-label="Suivant"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Grid of member cards */}
        {viewMode === 'cards' && (loading ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm font-medium animate-pulse">Chargement du registre...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 text-center py-12 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
            <p className="text-slate-400 dark:text-slate-500 text-sm font-light">Aucun membre ne correspond à vos critères.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMembers.map(member => (
              <div key={member.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200/90 dark:border-slate-600 shadow-xs flex flex-col justify-between hover:border-slate-350 dark:hover:border-slate-500 hover:shadow-md hover:shadow-slate-100/50 dark:hover:shadow-slate-900/50 transition-all">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{member.name}</h4>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 font-bold px-2 py-0.5 rounded-full inline-block">
                          {member.ministry}
                        </span>
                        {member.group && member.group !== 'Aucun' && (
                          <span className="text-[10px] text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/30 font-bold px-2 py-0.5 rounded-full inline-block">
                            {member.group}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 font-bold rounded-md ${
                      member.status === 'Actif' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                      member.status === 'Inactif' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                      'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                    }`}>
                      {member.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-50 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span>{member.email || "Non renseignée"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span>{member.phone || "Non renseigné"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span className="truncate">{member.address || "Non renseignée"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span>{member.birthday ? formatDate(member.birthday) : "Non renseigné"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500">
                  <button
                    onClick={() => setViewingMember(member)}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all cursor-pointer"
                    title="Voir détails"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => startEdit(member)}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all cursor-pointer"
                    title="Modifier"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => member.id && handleDelete(member.id)}
                    className="hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all cursor-pointer"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Member Details Modal */}
        {viewingMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setViewingMember(null)} />
            <div className="relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">Détails du Membre</h3>
                <button
                    onClick={() => setViewingMember(null)}
                    className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all cursor-pointer"
                    aria-label="Fermer"
                  >
                    <X className="w-5 h-5" />
                  </button>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Nom Complet</span>
                  <span className="text-slate-900 dark:text-slate-100 font-semibold">{viewingMember.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Email</span>
                    <span className="text-slate-800 dark:text-slate-200">{viewingMember.email || "Non renseignée"}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Téléphone</span>
                    <span className="text-slate-800 dark:text-slate-200">{viewingMember.phone || "Non renseigné"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Date de Naissance</span>
                    <span className="text-slate-800 dark:text-slate-200">{viewingMember.birthday ? formatDate(viewingMember.birthday) : "Non renseigné"}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Lieu de Naissance</span>
                    <span className="text-slate-800 dark:text-slate-200">{viewingMember.birthPlace || "Non renseigné"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Nationalité</span>
                    <span className="text-slate-800 dark:text-slate-200">{viewingMember.nationality || "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Sexe</span>
                    <span className="text-slate-800 dark:text-slate-200">{viewingMember.gender || "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Situation Matri.</span>
                    <span className="text-slate-800 dark:text-slate-200">{viewingMember.maritalStatus || "—"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Profession</span>
                    <span className="text-slate-800 dark:text-slate-200">{viewingMember.profession || "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Adresse</span>
                    <span className="text-slate-800 dark:text-slate-200">{viewingMember.address || "Non renseignée"}</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
                  <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400 block mb-2 uppercase tracking-wider">Vie Spirituelle</span>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Conversion</span>
                      <span className="text-slate-800 dark:text-slate-200">{viewingMember.conversionDate ? formatDate(viewingMember.conversionDate) : "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Ancienne Église</span>
                      <span className="text-slate-800 dark:text-slate-200">{viewingMember.formerChurch || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Arrivée</span>
                      <span className="text-slate-800 dark:text-slate-200">{viewingMember.arrivalDate ? formatDate(viewingMember.arrivalDate) : "—"}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Baptême</span>
                      <span className="text-slate-800 dark:text-slate-200">{viewingMember.baptized || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Date de Baptême</span>
                      <span className="text-slate-800 dark:text-slate-200">{viewingMember.baptismDate ? formatDate(viewingMember.baptismDate) : "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
                  <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400 block mb-2 uppercase tracking-wider">Engagement & Famille</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Ministère</span>
                      <span className="text-slate-800 dark:text-slate-200">{viewingMember.ministry}</span>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Groupe</span>
                      <span className="text-slate-800 dark:text-slate-200">{viewingMember.group && viewingMember.group !== 'Aucun' ? viewingMember.group : "Aucun"}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Dons / Talents</span>
                      <span className="text-slate-800 dark:text-slate-200">{viewingMember.talents || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Motivation</span>
                      <span className="text-slate-800 dark:text-slate-200">{viewingMember.motivation || "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
                  <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400 block mb-2 uppercase tracking-wider">Famille</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Conjoint(e)</span>
                      <span className="text-slate-800 dark:text-slate-200">{viewingMember.spouseName || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Enfants</span>
                      <span className="text-slate-800 dark:text-slate-200">{viewingMember.childrenCount ? `${viewingMember.childrenCount} (${viewingMember.childrenAges || "âges non renseignés"})` : "—"}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Tél. Urgence</span>
                      <span className="text-slate-800 dark:text-slate-200">{viewingMember.emergencyPhone || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Contact Urgence</span>
                      <span className="text-slate-800 dark:text-slate-200">{viewingMember.emergencyContact || "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-700 pt-3">
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Statut</span>
                    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-md mt-0.5 ${
                      viewingMember.status === 'Actif' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                      viewingMember.status === 'Inactif' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                      'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                    }`}>{viewingMember.status}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Date d'Inscription</span>
                    <span className="text-slate-800 dark:text-slate-200">{formatDate(viewingMember.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                <button
                  onClick={() => setViewingMember(null)}
                  className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md text-sm font-semibold transition-all cursor-pointer border border-indigo-500 shadow-sm"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </>
      )}
      {memberSubTab === 'anniversaires' && <AnniversariesModule members={members} settings={settings} />}
      {memberSubTab === 'visites' && <PastoralVisitsModule members={members} />}
    </div>
  );
}