import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, db, handleFirestoreError, OperationType, onSnapshot, query } from '../firebase';
import { AppUser, UserRole } from '../types';
import { Shield, UserPlus, Edit2, Trash2, LogOut, LogIn, Lock, Mail, Key, User, Clock, AlertCircle, Info, X, Eye, EyeOff } from 'lucide-react';

const ROLES: { value: UserRole; label: string; color: string; bg: string }[] = [
  { value: 'admin', label: 'Administrateur', color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  { value: 'secretaire', label: 'Secrétaire', color: 'text-cyan-700 dark:text-cyan-300', bg: 'bg-cyan-50 dark:bg-cyan-900/30' },
  { value: 'tresorier', label: 'Trésorier', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
  { value: 'pasteur', label: 'Pasteur', color: 'text-violet-700 dark:text-violet-300', bg: 'bg-violet-50 dark:bg-violet-900/30' },
  { value: 'lecture', label: 'Lecture seule', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/30' },
];

function getRoleConfig(role: UserRole) {
  return ROLES.find(r => r.value === role) || ROLES[4];
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

export default function UsersModule() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'lecture' as UserRole });
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('church_current_user');
    if (stored) {
      try { setCurrentUser(JSON.parse(stored)); } catch { localStorage.removeItem('church_current_user'); }
    }
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'church_users')), (snapshot) => {
      const items: AppUser[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as AppUser));
      setUsers(items);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!loading && users.length === 0) {
      addDoc(collection(db, 'church_users'), {
        name: 'Administrateur',
        email: 'admin@eglise.com',
        password: 'admin123',
        role: 'admin',
        createdAt: new Date().toISOString(),
      });
    }
  }, [loading, users.length]);

  const resetForm = () => {
    setFormData({ name: '', email: '', password: '', role: 'lecture' });
    setEditingId(null);
    setShowForm(false);
    setShowPassword(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) return;
    if (users.some(u => u.email === formData.email && u.id !== editingId)) {
      alert('Cet email est déjà utilisé.');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'church_users'), {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        createdAt: new Date().toISOString(),
      });
      resetForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'church_users');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !formData.name.trim() || !formData.email.trim()) return;
    if (users.some(u => u.email === formData.email && u.id !== editingId)) {
      alert('Cet email est déjà utilisé.');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        role: formData.role,
      };
      if (formData.password.trim()) payload.password = formData.password;
      await updateDoc(doc(db, 'church_users', editingId), payload);
      resetForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `church_users/${editingId}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const target = users.find(u => u.id === id);
    if (!target) return;
    if (target.id === currentUser?.id) {
      alert('Vous ne pouvez pas supprimer votre propre compte.');
      return;
    }
    if (!window.confirm(`Supprimer l'utilisateur "${target.name}" ? Cette action est irréversible.`)) return;
    try {
      await deleteDoc(doc(db, 'church_users', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `church_users/${id}`);
    }
  };

  const startEdit = (user: AppUser) => {
    setEditingId(user.id || null);
    setFormData({ name: user.name, email: user.email, password: '', role: user.role });
    setShowForm(true);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const found = users.find(u => u.email.toLowerCase() === loginEmail.trim().toLowerCase() && u.password === loginPassword);
    if (!found) {
      setLoginError('Email ou mot de passe incorrect.');
      return;
    }
    const loginData = { ...found, lastLogin: new Date().toISOString() };
    localStorage.setItem('church_current_user', JSON.stringify(loginData));
    updateDoc(doc(db, 'church_users', found.id!), { lastLogin: new Date().toISOString() }).catch(() => {});
    setCurrentUser(loginData);
    setLoginEmail('');
    setLoginPassword('');
    setLoginError('');
  };

  const handleLogout = () => {
    localStorage.removeItem('church_current_user');
    setCurrentUser(null);
  };

  const isAdmin = currentUser?.role === 'admin';

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-xl text-slate-800 dark:text-slate-200 font-bold tracking-tight">Gestion des Utilisateurs</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Connectez-vous pour accéder à la gestion des comptes.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Adresse Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="admin@eglise.com"
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-indigo-600 dark:focus:outline-indigo-400 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Mot de Passe</label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-indigo-600 dark:focus:outline-indigo-400 text-slate-900 dark:text-slate-100"
                  />
                  <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer" aria-label="Afficher ou masquer le mot de passe">
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm cursor-pointer border border-indigo-500"
              >
                <LogIn className="w-4 h-4" />
                Se connecter
              </button>
            </form>

            <div className="mt-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
                  <p className="font-semibold">Compte par défaut</p>
                  <p>admin@eglise.com / admin123</p>
                  <p className="text-[10px] opacity-75">Créé automatiquement si aucun utilisateur n'existe.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
        <div>
          <h2 className="text-xl text-slate-800 dark:text-slate-200 font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            Gestion des Utilisateurs
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Gérez les comptes et les accès à l'application.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5">
            <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
              {currentUser.name.charAt(0).toUpperCase()}
            </span>
            <div className="text-xs">
              <p className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">{currentUser.name}</p>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getRoleConfig(currentUser.role).bg} ${getRoleConfig(currentUser.role).color}`}>
                {getRoleConfig(currentUser.role).label}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </button>
        </div>
      </div>

      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 dark:text-amber-300">
          <span className="font-semibold">Compte par défaut :</span> admin@eglise.com / admin123
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{users.length} utilisateur(s)</span>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm cursor-pointer border border-indigo-500"
        >
          <UserPlus className="w-4 h-4" />
          Ajouter
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                <th className="text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">Nom</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px] hidden md:table-cell">Email</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">Rôle</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px] hidden lg:table-cell">Dernière connexion</th>
                <th className="text-right px-3 py-2 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm font-medium animate-pulse">Chargement...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">Aucun utilisateur.</td>
                </tr>
              ) : (
                users.map((user, idx) => {
                  const roleCfg = getRoleConfig(user.role);
                  return (
                    <tr key={user.id} className={`border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/30 dark:bg-slate-800/50'}`}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 hidden md:table-cell truncate max-w-[200px]">{user.email}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${roleCfg.bg} ${roleCfg.color}`}>
                          {roleCfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 hidden lg:table-cell text-[10px]">
                        {user.lastLogin ? formatDate(user.lastLogin) : 'Jamais'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {isAdmin ? (
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => startEdit(user)} className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-400 dark:text-slate-500 cursor-pointer" title="Modifier">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => user.id && handleDelete(user.id)} className="p-1 hover:text-rose-600 dark:hover:text-rose-400 text-slate-400 dark:text-slate-500 cursor-pointer" title="Supprimer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1 text-slate-300 dark:text-slate-600">
                            <Lock className="w-3.5 h-3.5" aria-label="Réservé aux administrateurs" />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={resetForm} />
          <div className="relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {editingId ? "Modifier l'utilisateur" : 'Ajouter un utilisateur'}
              </h3>
              <button onClick={resetForm} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all cursor-pointer" aria-label="Fermer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingId ? handleUpdate : handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Nom Complet *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: Jean Kabange"
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-indigo-600 dark:focus:outline-indigo-400 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Adresse Email *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="Ex: j.kabange@eglise.com"
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-indigo-600 dark:focus:outline-indigo-400 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                  Mot de Passe {editingId ? '(laisser vide pour conserver)' : '*'}
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editingId}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder={editingId ? '•••••••• ou laisser vide' : '••••••••'}
                    className="w-full pl-9 pr-10 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-indigo-600 dark:focus:outline-indigo-400 text-slate-900 dark:text-slate-100"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer" aria-label="Afficher ou masquer le mot de passe">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block">Rôle *</label>
                <div className="relative">
                  <Shield className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-indigo-600 dark:focus:outline-indigo-400 text-slate-900 dark:text-slate-100 appearance-none"
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
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
                  className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md text-sm font-semibold transition-all cursor-pointer border border-indigo-500 shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
