import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, query, onSnapshot, db, updateDoc, doc, deleteDoc } from '../firebase';
import { LibraryBook, BookLoan, Member } from '../types';
import { BookOpen, Plus, Search, RotateCcw, AlertTriangle } from 'lucide-react';

interface LibraryModuleProps {
  members: Member[];
}

const CATEGORIES = ['Théologie', 'Bible', 'Histoire chrétienne', 'Jeunesse', 'Louange', 'Autre'];

export default function LibraryModule({ members }: LibraryModuleProps) {
  const [activeTab, setActiveTab] = useState<'livres' | 'prets'>('livres');
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loans, setLoans] = useState<BookLoan[]>([]);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Book form
  const [showAddBook, setShowAddBook] = useState(false);
  const [bookForm, setBookForm] = useState({ title: '', author: '', category: 'Théologie', quantity: '1', location: '', notes: '' });
  const [bookSearch, setBookSearch] = useState('');

  // Loan form
  const [showNewLoan, setShowNewLoan] = useState(false);
  const [loanForm, setLoanForm] = useState({ bookId: '', bookTitle: '', memberId: '', memberName: '', borrowDate: new Date().toISOString().substring(0, 10), dueDate: new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10), notes: '' });
  const [loanBookSearch, setLoanBookSearch] = useState('');
  const [loanMemberSearch, setLoanMemberSearch] = useState('');

  useEffect(() => {
    const unsubBooks = onSnapshot(query(collection(db, 'church_library')), (snapshot) => {
      const items: LibraryBook[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as LibraryBook));
      setBooks(items);
    });
    const unsubLoans = onSnapshot(query(collection(db, 'church_loans')), (snapshot) => {
      const items: BookLoan[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as BookLoan));
      setLoans(items);
    });
    return () => { unsubBooks(); unsubLoans(); };
  }, []);

  const activeLoans = useMemo(() => loans.filter(l => l.status === 'en cours' || l.status === 'retard'), [loans]);

  const getAvailable = (bookId: string, quantity: number) => {
    const borrowed = activeLoans.filter(l => l.bookId === bookId).length;
    return quantity - borrowed;
  };

  const filteredBooks = useMemo(() => {
    const q = bookSearch.toLowerCase();
    return books.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
  }, [books, bookSearch]);

  const filteredLoanBooks = useMemo(() => {
    const q = loanBookSearch.toLowerCase();
    return books.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
  }, [books, loanBookSearch]);

  const filteredMembers = useMemo(() => {
    const q = loanMemberSearch.toLowerCase();
    return members.filter(m => (m.name || '').toLowerCase().includes(q));
  }, [members, loanMemberSearch]);

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(bookForm.quantity);
    if (isNaN(qty) || qty < 1) { alert('Veuillez saisir une quantité valide.'); return; }
    if (!bookForm.title.trim() || !bookForm.author.trim()) { alert('Veuillez saisir le titre et l\'auteur.'); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, 'church_library'), {
        title: bookForm.title.trim(),
        author: bookForm.author.trim(),
        category: bookForm.category,
        quantity: qty,
        available: qty,
        location: bookForm.location.trim(),
        ...(bookForm.notes.trim() ? { notes: bookForm.notes.trim() } : {}),
        createdAt: new Date().toISOString()
      });
      setSuccessMsg('Livre ajouté avec succès.');
      setTimeout(() => setSuccessMsg(null), 3000);
      setShowAddBook(false);
      setBookForm({ title: '', author: '', category: 'Théologie', quantity: '1', location: '', notes: '' });
    } catch { alert('Erreur lors de l\'ajout du livre.'); }
    finally { setSaving(false); }
  };

  const handleDeleteBook = async (id: string, title: string) => {
    if (!window.confirm(`Supprimer "${title}" définitivement ?`)) return;
    try {
      await deleteDoc(doc(db, 'church_library', id));
      setSuccessMsg('Livre supprimé.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch { alert('Erreur lors de la suppression.'); }
  };

  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.bookId || !loanForm.memberId) { alert('Veuillez sélectionner un livre et un membre.'); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, 'church_loans'), {
        bookId: loanForm.bookId,
        bookTitle: loanForm.bookTitle,
        memberId: loanForm.memberId,
        memberName: loanForm.memberName,
        borrowDate: loanForm.borrowDate,
        dueDate: loanForm.dueDate,
        status: 'en cours',
        ...(loanForm.notes.trim() ? { notes: loanForm.notes.trim() } : {}),
        createdAt: new Date().toISOString()
      });
      setSuccessMsg('Prêt enregistré.');
      setTimeout(() => setSuccessMsg(null), 3000);
      setShowNewLoan(false);
      setLoanForm({ bookId: '', bookTitle: '', memberId: '', memberName: '', borrowDate: new Date().toISOString().substring(0, 10), dueDate: new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10), notes: '' });
    } catch { alert('Erreur lors de l\'enregistrement du prêt.'); }
    finally { setSaving(false); }
  };

  const handleReturnLoan = async (loan: BookLoan) => {
    if (!window.confirm(`Confirmer le retour de "${loan.bookTitle}" par ${loan.memberName} ?`)) return;
    try {
      await updateDoc(doc(db, 'church_loans', loan.id!), {
        returnDate: new Date().toISOString().substring(0, 10),
        status: 'retourné'
      });
      setSuccessMsg('Retour enregistré.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch { alert('Erreur lors du retour.'); }
  };

  const todayStr = new Date().toISOString().substring(0, 10);

  const sortedLoans = useMemo(() => {
    return [...loans].sort((a, b) => new Date(b.borrowDate).getTime() - new Date(a.borrowDate).getTime());
  }, [loans]);

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl text-slate-800 dark:text-slate-200 font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Bibliothèque Paroissiale
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Gestion des livres et des prêts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'livres' && !showAddBook && (
            <button onClick={() => setShowAddBook(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.8 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-indigo-500 shadow-xs">
              <Plus className="w-3.5 h-3.5 text-indigo-200" />
              Ajouter un livre
            </button>
          )}
          {activeTab === 'prets' && !showNewLoan && (
            <button onClick={() => setShowNewLoan(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.8 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-indigo-500 shadow-xs">
              <Plus className="w-3.5 h-3.5 text-indigo-200" />
              Nouveau prêt
            </button>
          )}
        </div>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 p-3 rounded-lg flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-600 flex gap-4 text-xs font-bold overflow-x-auto shrink-0 pb-1">
        <button onClick={() => { setActiveTab('livres'); setShowAddBook(false); }}
          className={`pb-2.5 px-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'livres' ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
          <BookOpen className="w-3.5 h-3.5 inline mr-1.5" />
          Livres ({books.length})
        </button>
        <button onClick={() => { setActiveTab('prets'); setShowNewLoan(false); }}
          className={`pb-2.5 px-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'prets' ? 'border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
          <RotateCcw className="w-3.5 h-3.5 inline mr-1.5" />
          Prêts ({activeLoans.length})
        </button>
      </div>

      {/* ========== LIVRES TAB ========== */}
      {activeTab === 'livres' && (
        <div className="space-y-4">
          {/* Add book form */}
          {showAddBook && (
            <form onSubmit={handleAddBook} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">
                <h3 className="font-bold text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Ajouter un livre
                </h3>
                <button type="button" onClick={() => setShowAddBook(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">Fermer</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Titre *</label>
                  <input type="text" required value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                    placeholder="Titre du livre"
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Auteur *</label>
                  <input type="text" required value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                    placeholder="Nom de l'auteur"
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Catégorie</label>
                  <select value={bookForm.category} onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Quantité *</label>
                  <input type="number" min="1" required value={bookForm.quantity} onChange={(e) => setBookForm({ ...bookForm, quantity: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Emplacement</label>
                  <input type="text" value={bookForm.location} onChange={(e) => setBookForm({ ...bookForm, location: e.target.value })}
                    placeholder="Ex: Bibliothèque, étagère 3"
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Notes</label>
                  <input type="text" value={bookForm.notes} onChange={(e) => setBookForm({ ...bookForm, notes: e.target.value })}
                    placeholder="Observations éventuelles"
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setShowAddBook(false)}
                  className="text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer">Annuler</button>
                <button type="submit" disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-bold cursor-pointer border border-indigo-500 shadow-xs">
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          )}

          {/* Search */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs shadow-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input type="text" placeholder="Rechercher par titre ou auteur..." value={bookSearch} onChange={(e) => setBookSearch(e.target.value)}
              className="bg-transparent border-0 focus:ring-0 text-xs text-slate-700 dark:text-slate-300 w-full outline-none" />
          </div>

          {/* Books table */}
          {filteredBooks.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-400 dark:text-slate-500">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">Aucun livre trouvé.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-3">Titre</th>
                      <th className="p-3">Auteur</th>
                      <th className="p-3">Catégorie</th>
                      <th className="p-3 text-center">Qté</th>
                      <th className="p-3 text-center">Disponibles</th>
                      <th className="p-3">Emplacement</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                    {filteredBooks.map(b => {
                      const available = getAvailable(b.id!, b.quantity);
                      return (
                        <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors">
                          <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{b.title}</td>
                          <td className="p-3">{b.author}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-semibold border border-indigo-100 dark:border-indigo-800">
                              {b.category}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono">{b.quantity}</td>
                          <td className="p-3 text-center">
                            <span className={`font-bold ${available > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {available}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">{b.location || '—'}</td>
                          <td className="p-3 text-center">
                            <button onClick={() => handleDeleteBook(b.id!, b.title)}
                              className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
                              title="Supprimer ce livre">
                              <Plus className="w-3.5 h-3.5 rotate-45" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== PRÊTS TAB ========== */}
      {activeTab === 'prets' && (
        <div className="space-y-4">
          {/* New loan form */}
          {showNewLoan && (
            <form onSubmit={handleAddLoan} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">
                <h3 className="font-bold text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Nouveau prêt
                </h3>
                <button type="button" onClick={() => setShowNewLoan(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">Fermer</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Book select */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Livre *</label>
                  <input type="text" placeholder="Rechercher un livre..."
                    value={loanBookSearch} onChange={(e) => setLoanBookSearch(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600 mb-1" />
                  <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700">
                    {filteredLoanBooks.length === 0 ? (
                      <div className="p-2 text-[10px] text-slate-400">Aucun livre trouvé</div>
                    ) : filteredLoanBooks.map(b => {
                      const available = getAvailable(b.id!, b.quantity);
                      return (
                        <button key={b.id} type="button"
                          onClick={() => { setLoanForm({ ...loanForm, bookId: b.id!, bookTitle: b.title }); setLoanBookSearch(''); }}
                          className={`w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex justify-between items-center ${loanForm.bookId === b.id ? 'bg-indigo-50 dark:bg-indigo-900/30 font-semibold' : ''}`}>
                          <span>{b.title} — {b.author}</span>
                          <span className={`text-[10px] font-bold ${available > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{available} disp.</span>
                        </button>
                      );
                    })}
                  </div>
                  {loanForm.bookTitle && (
                    <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">Sélectionné: {loanForm.bookTitle}</div>
                  )}
                </div>

                {/* Member select */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Membre *</label>
                  <input type="text" placeholder="Rechercher un membre..."
                    value={loanMemberSearch} onChange={(e) => setLoanMemberSearch(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600 mb-1" />
                  <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700">
                    {filteredMembers.length === 0 ? (
                      <div className="p-2 text-[10px] text-slate-400">Aucun membre trouvé</div>
                    ) : filteredMembers.map(m => (
                      <button key={m.id} type="button"
                        onClick={() => { setLoanForm({ ...loanForm, memberId: m.id!, memberName: m.name }); setLoanMemberSearch(''); }}
                        className={`w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors ${loanForm.memberId === m.id ? 'bg-indigo-50 dark:bg-indigo-900/30 font-semibold' : ''}`}>
                        {m.name}
                      </button>
                    ))}
                  </div>
                  {loanForm.memberName && (
                    <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">Sélectionné: {loanForm.memberName}</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Date d'emprunt</label>
                  <input type="date" required value={loanForm.borrowDate} onChange={(e) => setLoanForm({ ...loanForm, borrowDate: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Date de retour prévue</label>
                  <input type="date" required value={loanForm.dueDate} onChange={(e) => setLoanForm({ ...loanForm, dueDate: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Notes</label>
                <input type="text" value={loanForm.notes} onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })}
                  placeholder="Notes sur le prêt"
                  className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-indigo-600" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setShowNewLoan(false)}
                  className="text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer">Annuler</button>
                <button type="submit" disabled={saving || !loanForm.bookId || !loanForm.memberId}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-bold cursor-pointer border border-indigo-500 shadow-xs disabled:opacity-50">
                  {saving ? 'Enregistrement...' : 'Enregistrer le prêt'}
                </button>
              </div>
            </form>
          )}

          {/* Loans list */}
          {sortedLoans.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-400 dark:text-slate-500">
              <RotateCcw className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">Aucun prêt enregistré.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-3">Livre</th>
                      <th className="p-3">Membre</th>
                      <th className="p-3">Date emprunt</th>
                      <th className="p-3">Date retour</th>
                      <th className="p-3 text-center">Statut</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                    {sortedLoans.map(l => {
                      const isOverdue = l.status !== 'retourné' && l.dueDate < todayStr;
                      const status = isOverdue ? 'retard' : l.status;
                      return (
                        <tr key={l.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors">
                          <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{l.bookTitle}</td>
                          <td className="p-3">{l.memberName}</td>
                          <td className="p-3 font-mono text-slate-500">{l.borrowDate}</td>
                          <td className="p-3 font-mono text-slate-500">{l.dueDate}{l.returnDate ? ` → ${l.returnDate}` : ''}</td>
                          <td className="p-3 text-center">
                            {status === 'retourné' ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-200 dark:border-emerald-800">
                                Retourné
                              </span>
                            ) : status === 'retard' ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-[10px] font-semibold border border-rose-200 dark:border-rose-800 inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Retard
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-semibold border border-amber-200 dark:border-amber-800">
                                En cours
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {status !== 'retourné' && (
                              <button onClick={() => handleReturnLoan(l)}
                                className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer border border-emerald-200 dark:border-emerald-800">
                                <RotateCcw className="w-3 h-3" />
                                Retourner
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
