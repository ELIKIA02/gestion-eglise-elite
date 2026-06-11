import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, db, handleFirestoreError, OperationType } from '../firebase';
import { Member, MemberStatus, Department } from '../types';
import { Search, UserPlus, Mail, Phone, Edit2, Trash2, Filter, Eye, X, Calendar, MapPin, Users, Award } from 'lucide-react';

interface MembersModuleProps {
  members: Member[];
  departments: Department[];
  loading: boolean;
  onRefresh: () => void;
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

export default function MembersModule({ members, departments, loading, onRefresh }: MembersModuleProps) {
  const MINISTRIES = departments.length > 0
    ? [...departments.map(d => d.name), 'Aucun']
    : FALLBACK_MINISTRIES;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ministryFilter, setMinistryFilter] = useState<string>('all');

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
    group: 'Aucun'
  });

  const [saving, setSaving] = useState(false);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      status: 'Actif',
      ministry: 'Aucun',
      birthday: '',
      address: '',
      group: 'Aucun'
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
        group: formData.group || null
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
      group: member.group || 'Aucun'
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
          <button
            id="btn-add-member"
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm cursor-pointer border border-indigo-500"
          >
            <UserPlus className="w-4 h-4 text-indigo-200 dark:text-indigo-300" />
            Nouveau Membre
          </button>
        )}
      </div>

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
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Ex: Jean-Louis Kabange"
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Adresse Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="Ex: j.kabange@gmail.com"
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Numéro Téléphone / WhatsApp</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="Ex: +33 6 12 34 56 78"
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Date de Naissance</label>
              <input
                type="date"
                value={formData.birthday}
                onChange={(e) => setFormData({...formData, birthday: e.target.value})}
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Adresse</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="Ex: 12 Rue de l'Église, Kinshasa"
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Groupe</label>
              <select
                value={formData.group}
                onChange={(e) => setFormData({...formData, group: e.target.value})}
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-indigo-600 dark:focus:outline-indigo-400"
              >
                {GROUPS.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Statut d'Activité</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value as MemberStatus})}
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-indigo-600 dark:focus:outline-indigo-400"
              >
                <option value="Actif">Actif (Régulier aux cultes)</option>
                <option value="Inactif">Inactif (Absent prolongé)</option>
                <option value="En observation">En observation (Nouveau membre / Intégration)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Ministère / Département de Service</label>
              <select
                value={formData.ministry}
                onChange={(e) => setFormData({...formData, ministry: e.target.value})}
                className="w-full text-sm p-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-indigo-600 dark:focus:outline-indigo-400"
              >
                {MINISTRIES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

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

      {/* Grid of member cards */}
      {loading ? (
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
      )}

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
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Adresse</span>
                  <span className="text-slate-800 dark:text-slate-200">{viewingMember.address || "Non renseignée"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Statut</span>
                  <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-md mt-0.5 ${
                    viewingMember.status === 'Actif' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                    viewingMember.status === 'Inactif' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                    'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                  }`}>{viewingMember.status}</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Ministère</span>
                  <span className="text-slate-800 dark:text-slate-200">{viewingMember.ministry}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Groupe</span>
                  <span className="text-slate-800 dark:text-slate-200">{viewingMember.group && viewingMember.group !== 'Aucun' ? viewingMember.group : "Aucun"}</span>
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
    </div>
  );
}
