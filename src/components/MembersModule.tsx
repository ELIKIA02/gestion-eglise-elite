import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, db, handleFirestoreError, OperationType } from '../firebase';
import { Member, MemberStatus, Department } from '../types';
import { Search, UserPlus, Mail, Phone, Edit2, Trash2, Filter, CheckCircle2, ShieldAlert, Award } from 'lucide-react';

interface MembersModuleProps {
  members: Member[];
  departments: Department[];
  loading: boolean;
  onRefresh: () => void;
}

const FALLBACK_MINISTRIES = ["Accueil (Ushers)", "Musique & Louange", "École du dimanche", "Médias & Technique", "Jeunesse", "Intercession", "Aucun"];

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
    ministry: 'Aucun'
  });

  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      status: 'Actif',
      ministry: 'Aucun'
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
        ministry: formData.ministry
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
      ministry: member.ministry
    });
    setIsAdding(true);
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          member.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
    const matchesMinistry = ministryFilter === 'all' || member.ministry === ministryFilter;
    
    return matchesSearch && matchesStatus && matchesMinistry;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl text-slate-800 font-bold tracking-tight">Registre des Membres ({filteredMembers.length})</h2>
          <p className="text-xs text-slate-500">Gérez les fidèles, assignations de ministères et statuts d'activité.</p>
        </div>
        {!isAdding && (
          <button 
            id="btn-add-member"
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm cursor-pointer border border-indigo-500"
          >
            <UserPlus className="w-4 h-4 text-indigo-200" />
            Nouveau Membre
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={editingId ? handleUpdate : handleCreate} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-semibold text-sm text-indigo-650 border-b border-slate-100 pb-2">
            {editingId ? "Modifier la fiche de membre" : "Ajouter un nouveau membre dans le registre"}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 block">Nom Complet *</label>
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Ex: Jean-Louis Kabange"
                className="w-full text-sm p-2 border border-slate-200 rounded-md focus:outline-indigo-600"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 block">Adresse Email</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="Ex: j.kabange@gmail.com"
                className="w-full text-sm p-2 border border-slate-200 rounded-md focus:outline-indigo-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 block">Numéro Téléphone / WhatsApp</label>
              <input 
                type="tel" 
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="Ex: +33 6 12 34 56 78"
                className="w-full text-sm p-2 border border-slate-200 rounded-md focus:outline-indigo-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 block">Statut d'Activité</label>
              <select 
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value as MemberStatus})}
                className="w-full text-sm p-2 border border-slate-200 rounded-md bg-white focus:outline-indigo-600"
              >
                <option value="Actif">Actif (Régulier aux cultes)</option>
                <option value="Inactif">Inactif (Absent prolongé)</option>
                <option value="En observation">En observation (Nouveau membre / Intégration)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 block">Ministère / Département de Service</label>
              <select 
                value={formData.ministry}
                onChange={(e) => setFormData({...formData, ministry: e.target.value})}
                className="w-full text-sm p-2 border border-slate-200 rounded-md bg-white focus:outline-indigo-600"
              >
                {MINISTRIES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button 
              type="button" 
              onClick={resetForm}
              className="text-slate-500 hover:bg-slate-50 px-3 py-1.5 rounded-md text-sm transition-all cursor-pointer font-medium"
            >
              Annuler
            </button>
            <button 
              type="submit" 
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm font-semibold transition-all cursor-pointer border border-indigo-500 shadow-sm"
            >
              {saving ? "Enregistrement..." : editingId ? "Enregistrer les modifications" : "Ajouter le membre"}
            </button>
          </div>
        </form>
      )}

      {/* Filters & Search Row */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input 
            type="text" 
            placeholder="Rechercher par nom, email, téléphone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-indigo-600"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg px-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-0 focus:ring-0 py-1 text-xs"
            >
              <option value="all">Tous les Statuts</option>
              <option value="Actif">Actif</option>
              <option value="Inactif">Inactif</option>
              <option value="En observation">En observation</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg px-2 text-xs">
            <Award className="w-3.5 h-3.5 text-stone-400" />
            <select 
              value={ministryFilter}
              onChange={(e) => setMinistryFilter(e.target.value)}
              className="bg-transparent border-0 focus:ring-0 py-1 text-xs"
            >
              <option value="all">Tous les Ministères</option>
              {MINISTRIES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grid of member cards or table */}
      {loading ? (
        <div className="text-center py-8 text-slate-500 text-sm font-medium animate-pulse">Chargement du registre...</div>
      ) : filteredMembers.length === 0 ? (
        <div className="bg-white text-center py-12 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-slate-400 text-sm font-light">Aucun membre ne correspond à vos critères.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map(member => (
            <div key={member.id} className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-slate-350 hover:shadow-md hover:shadow-slate-100/50 transition-all">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">{member.name}</h4>
                    <span className="text-[10px] text-indigo-700 bg-indigo-50 font-bold px-2 py-0.5 rounded-full inline-block mt-1">
                      {member.ministry}
                    </span>
                  </div>
                  
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 font-bold rounded-md ${
                    member.status === 'Actif' ? 'bg-emerald-50 text-emerald-700' :
                    member.status === 'Inactif' ? 'bg-amber-50 text-amber-700' :
                    'bg-sky-50 text-sky-700'
                  }`}>
                    {member.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{member.email || "Non renseignée"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{member.phone || "Non renseigné"}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100 text-slate-400">
                <button 
                  onClick={() => startEdit(member)}
                  className="hover:text-indigo-600 p-1 rounded hover:bg-slate-50 transition-all cursor-pointer"
                  title="Modifier"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => member.id && handleDelete(member.id)}
                  className="hover:text-rose-600 p-1 rounded hover:bg-slate-50 transition-all cursor-pointer"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
