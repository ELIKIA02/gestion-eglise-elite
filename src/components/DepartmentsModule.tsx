import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, db, handleFirestoreError, OperationType } from '../firebase';
import { Department, Member } from '../types';
import { Plus, Edit2, Trash2, Users, Send, Palette, X, ChevronDown, ChevronRight } from 'lucide-react';

interface DepartmentsModuleProps {
  departments: Department[];
  members: Member[];
  loading: boolean;
  onRefresh: () => void;
  onMessage: (deptName: string) => void;
}

const COLORS = [
  '#4f46e5', '#059669', '#d97706', '#dc2626', '#0891b2',
  '#7c3aed', '#db2777', '#65a30d', '#0ea5e9', '#e11d48'
];

export default function DepartmentsModule({ departments, members, loading, onRefresh, onMessage }: DepartmentsModuleProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', color: '#4f46e5' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({ name: '', description: '', color: '#4f46e5' });
    setShowForm(false);
    setEditing(null);
  };

  const startEdit = (d: Department) => {
    setFormData({ name: d.name, description: d.description, color: d.color });
    setEditing(d.id || null);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSaving(true);
    setSuccessMsg(null);
    try {
      if (editing) {
        await updateDoc(doc(db, 'church_departments', editing), {
          name: formData.name.trim(),
          description: formData.description.trim(),
          color: formData.color
        });
      } else {
        await addDoc(collection(db, 'church_departments'), {
          name: formData.name.trim(),
          description: formData.description.trim(),
          color: formData.color,
          createdAt: new Date().toISOString()
        });
      }
      setSuccessMsg(`Département « ${formData.name.trim()} » ${editing ? 'modifié' : 'créé'} avec succès !`);
      resetForm();
      onRefresh();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      handleFirestoreError(err, editing ? OperationType.UPDATE : OperationType.CREATE, 'church_departments');
      alert("Erreur Firestore : " + (err as any).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Supprimer le département "${name}" ? Les membres ne seront pas supprimés mais n'auront plus ce département.`)) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'church_departments', id));
      onRefresh();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'church_departments');
      alert("Erreur suppression : " + (err as any).message);
    } finally {
      setDeleting(null);
    }
  };

  const getMembersByDept = (deptName: string) =>
    members.filter(m => m.ministry === deptName);

  const activeDepts = departments.filter(d => d.name !== 'Aucun');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl text-slate-800 font-bold tracking-tight">Départements & Services</h2>
          <p className="text-xs text-slate-500">Créez des départements, assignez-y des membres depuis l'onglet Membres, et envoyez-leur des messages.</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold border border-indigo-500 shadow-sm transition-all cursor-pointer">
            <Plus className="w-4 h-4 text-indigo-200" />
            Nouveau Département
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-semibold text-sm text-indigo-650 border-b border-slate-100 pb-2">
            {editing ? 'Modifier le département' : 'Créer un nouveau département'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 block">Nom *</label>
              <input type="text" required value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="Ex: Louange & Adoration"
                className="w-full text-sm p-2 border border-slate-200 rounded-md focus:outline-indigo-600" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 block">Description</label>
              <input type="text" value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Ex: Équipe de chant et musique"
                className="w-full text-sm p-2 border border-slate-200 rounded-md focus:outline-indigo-600" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 block">Couleur</label>
              <div className="flex gap-1.5 items-center h-[38px]">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setFormData({...formData, color: c})}
                    className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${formData.color === c ? 'border-slate-900 scale-110' : 'border-transparent'}`}
                    style={{ background: c }} />
                ))}
                <input type="text" value={formData.color}
                  onChange={e => setFormData({...formData, color: e.target.value})}
                  className="ml-1 w-16 text-[10px] p-1 border border-slate-200 rounded font-mono" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={resetForm}
              className="text-slate-500 hover:bg-slate-50 px-3 py-1.5 rounded-md text-sm cursor-pointer font-medium">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm font-semibold border border-indigo-500 shadow-sm transition-all cursor-pointer disabled:bg-indigo-400">
              {saving ? 'Enregistrement...' : editing ? 'Enregistrer' : 'Créer le département'}
            </button>
          </div>
        </form>
      )}

      {/* Success message */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-sm text-emerald-800 font-semibold flex items-center gap-2">
          <span>✅</span> {successMsg}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-8 text-slate-500 text-sm font-medium animate-pulse">Chargement des départements...</div>
      ) : activeDepts.length === 0 && !showForm ? (
        <div className="bg-white text-center py-12 rounded-xl border border-slate-200 shadow-xs">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-light">Aucun département pour l'instant.</p>
          <p className="text-xs text-slate-400 mt-1">Créez votre premier département pour organiser les membres.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeDepts.map(dept => {
            const deptMembers = getMembersByDept(dept.name);
            const isExpanded = expanded === dept.id;
            return (
              <div key={dept.id} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                {/* Header */}
                <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-all"
                  onClick={() => setExpanded(isExpanded ? null : dept.id || null)}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: dept.color }}>
                      {dept.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900 text-sm block">{dept.name}</span>
                      <span className="text-[10px] text-slate-400">{dept.description || 'Aucune description'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                      {deptMembers.length} membre{deptMembers.length !== 1 ? 's' : ''}
                    </span>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {/* Expanded member list */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {/* Actions */}
                    <div className="flex gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100">
                      <button onClick={() => { onMessage(dept.name); }}
                        className="flex items-center gap-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100 bg-indigo-50 px-2.5 py-1 rounded-md transition-all cursor-pointer">
                        <Send className="w-3 h-3" /> Message
                      </button>
                      <button onClick={() => startEdit(dept)}
                        className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-200 bg-slate-100 px-2.5 py-1 rounded-md transition-all cursor-pointer">
                        <Edit2 className="w-3 h-3" /> Modifier
                      </button>
                      <button onClick={() => dept.id && handleDelete(dept.id, dept.name)} disabled={deleting === dept.id}
                        className="flex items-center gap-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-100 bg-rose-50 px-2.5 py-1 rounded-md transition-all cursor-pointer disabled:opacity-50">
                        <Trash2 className="w-3 h-3" /> {deleting === dept.id ? '...' : 'Supprimer'}
                      </button>
                    </div>

                    {/* Members */}
                    <div className="max-h-52 overflow-y-auto">
                      {deptMembers.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center py-6 italic">
                          Aucun membre dans ce département.
                          <br />Assignez-en depuis l'onglet <strong>Membres</strong>.
                        </p>
                      ) : (
                        deptMembers.map(m => (
                          <div key={m.id} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0">
                            <div>
                              <span className="text-xs font-medium text-slate-800">{m.name}</span>
                              <span className="text-[9px] text-slate-400 ml-2">{m.phone || m.email}</span>
                            </div>
                            <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                              m.status === 'Actif' ? 'bg-emerald-50 text-emerald-700' :
                              m.status === 'Inactif' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'
                            }`}>{m.status}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tip */}
      {activeDepts.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-xs text-indigo-800 space-y-1">
          <p className="font-semibold">💡 Comment ça marche ?</p>
          <p>1. Créez vos départements ici → 2. Allez dans l'onglet <strong>Membres</strong> pour assigner chaque membre à un département → 3. Revenez ici pour voir les effectifs → 4. Cliquez <strong>Message</strong> pour envoyer un rappel à tout le département.</p>
        </div>
      )}
    </div>
  );
}
