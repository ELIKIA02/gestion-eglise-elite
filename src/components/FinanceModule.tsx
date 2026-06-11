import React, { useState, useMemo } from 'react';
import { collection, addDoc, deleteDoc, doc, db, handleFirestoreError, OperationType } from '../firebase';
import { FinanceTransaction, TransactionType, ChurchEvent } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { 
  PlusCircle, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  ListFilter, 
  Trash2, 
  Calendar, 
  FileSpreadsheet, 
  PieChartIcon, 
  Calculator, 
  Sparkles, 
  Download, 
  Info, 
  User, 
  FileText, 
  CheckCircle2, 
  ArrowRightLeft 
} from 'lucide-react';

interface FinanceModuleProps {
  transactions: FinanceTransaction[];
  events: ChurchEvent[];
  loading: boolean;
  onRefresh: () => void;
}

// Highly localized French Congolese Church context categories
const REVENUE_KIND = [
  "Offrande Ordinaire",
  "Dîme (10% de fidélité)",
  "Action de Grâce & Témoignages",
  "Offrande de Construction / Projet",
  "Donation / Libéralité",
  "École du Dimanche (Enfants)",
  "Fête des Moissons / Récolte",
  "Autre recette"
];

const EXPENSE_KIND = [
  "Loyer du local de culte",
  "Soutien Pastoral / Indemnités",
  "Électricité / Carburant Groupe Électrogène",
  "Achat & Entretien Sonorisation / Instruments",
  "Social (Aide paroissiens et démunis)",
  "Évangélisation, Missions & Implantation",
  "Séminaires & Prédicateurs Invités",
  "Secrétariat, Papeterie & Communication",
  "Autre dépense"
];

// formatting utility for Congo Franc (FCFA)
const formatFCFA = (amount: number) => {
  return Math.round(amount).toLocaleString('fr-FR') + ' FCFA';
};

export default function FinanceModule({ transactions, events, loading, onRefresh }: FinanceModuleProps) {
  const [activeTab, setActiveTab] = useState<'transactions' | 'analytics' | 'basketAssistant' | 'budget' | 'bilan' | 'journal' | 'grandlivre'>('transactions');
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'Revenu' | 'Dépense'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCulteFilter, setSelectedCulteFilter] = useState('all');

  // Journal General state
  const [journalPage, setJournalPage] = useState(1);
  const [journalSearch, setJournalSearch] = useState('');

  // Grand Livre state
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const ITEMS_PER_PAGE = 20;

  // Standard Form State
  const [formData, setFormData] = useState({
    type: 'Revenu' as TransactionType,
    category: 'Offrande Ordinaire',
    amount: '',
    date: new Date().toISOString().substring(0, 10),
    contributor: '',
    notes: '',
    linkedEventId: ''
  });

  // Basket Assistant Form State (Calculateur de Corbeilles de Culte)
  const [basketEventId, setBasketEventId] = useState('');
  const [basketNotes, setBasketNotes] = useState('');
  const [baskets, setBaskets] = useState({
    offrandeOrdinaire: '',
    dime: '',
    actionDeGrace: '',
    construction: '',
    socialEnfants: ''
  });

  // Filter out recent cultes for options
  const sortedWorshipEvents = useMemo(() => {
    return [...events]
      .filter(e => e.type === 'Culte régulier' || e.type === 'Séminaire' || e.type === 'École du dimanche' || e.type === 'Autre')
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [events]);

  // Calculate aggregates
  const stats = useMemo(() => {
    let totalRevenues = 0;
    let totalExpenses = 0;
    
    transactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'Revenu') {
        totalRevenues += amt;
      } else {
        totalExpenses += amt;
      }
    });

    return {
      totalRevenues,
      totalExpenses,
      balance: totalRevenues - totalExpenses
    };
  }, [transactions]);

  // Handle standard registration
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(formData.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Veuillez saisir un montant supérieur à 0 FCFA.");
      return;
    }

    setSaving(true);
    const path = 'church_finances';
    
    // Auto-fill or adjust date and notes if linked to a worship event
    let finalNotes = formData.notes;
    let finalDate = formData.date;
    
    if (formData.linkedEventId) {
      const matchedEvent = events.find(ev => ev.id === formData.linkedEventId);
      if (matchedEvent) {
        finalDate = matchedEvent.date;
        const worshipContext = `[Lien Culte: ${matchedEvent.title} du ${matchedEvent.date}]`;
        finalNotes = finalNotes ? `${worshipContext} ${finalNotes}` : worshipContext;
      }
    }

    try {
      await addDoc(collection(db, path), {
        type: formData.type,
        category: formData.category,
        amount: parsedAmount,
        date: finalDate,
        ...(formData.contributor ? { contributor: formData.contributor } : {}),
        ...(finalNotes ? { notes: finalNotes } : {}),
        createdAt: new Date().toISOString()
      });
      
      setSuccessMsg("L'écriture comptable a été enregistrée avec succès.");
      setTimeout(() => setSuccessMsg(null), 4000);

      setIsAdding(false);
      setFormData({
        type: 'Revenu',
        category: 'Offrande Ordinaire',
        amount: '',
        date: new Date().toISOString().substring(0, 10),
        contributor: '',
        notes: '',
        linkedEventId: ''
      });
      onRefresh();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setSaving(false);
    }
  };

  // Handle worship multi-basket pack registration
  const handleBasketAssistantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!basketEventId) {
      alert("Veuillez d'abord sélectionner le Culte ou l'Activité paroissiale concerné.");
      return;
    }

    const matchedEvent = events.find(ev => ev.id === basketEventId);
    if (!matchedEvent) {
      alert("Culte sélectionné introuvable.");
      return;
    }

    const oOrd = parseFloat(baskets.offrandeOrdinaire) || 0;
    const oDime = parseFloat(baskets.dime) || 0;
    const oGrace = parseFloat(baskets.actionDeGrace) || 0;
    const oConst = parseFloat(baskets.construction) || 0;
    const oKids = parseFloat(baskets.socialEnfants) || 0;

    const grandTotal = oOrd + oDime + oGrace + oConst + oKids;
    if (grandTotal <= 0) {
      alert("Veuillez saisir au moins un montant dans l'une des corbeilles ou enveloppes.");
      return;
    }

    setSaving(true);
    const path = 'church_finances';
    
    try {
      const recordsToInsert = [
        { amt: oOrd, cat: "Offrande Ordinaire", desc: "Corbeille d'Offrande Ordinaire" },
        { amt: oDime, cat: "Dîme (10% de fidélité)", desc: "Enveloppes des Dîmes du Culte" },
        { amt: oGrace, cat: "Action de Grâce & Témoignages", desc: "Corbeille Actions de Grâce" },
        { amt: oConst, cat: "Offrande de Construction / Projet", desc: "Corbeille Fonds Travaux" },
        { amt: oKids, cat: "École du Dimanche (Enfants)", desc: "Offrandes des Enfants / Social" }
      ];

      for (const record of recordsToInsert) {
        if (record.amt > 0) {
          const notesContext = `[Collecte Culte: ${matchedEvent.title} du ${matchedEvent.date}] ${record.desc}.${basketNotes ? ' ' + basketNotes : ''}`;
          await addDoc(collection(db, path), {
            type: 'Revenu',
            category: record.cat,
            amount: record.amt,
            date: matchedEvent.date,
            contributor: "Assemblée des fidèles",
            notes: notesContext,
            createdAt: new Date().toISOString()
          });
        }
      }

      setSuccessMsg(`Succès! Les enregistrements de corbeilles pour un montant total de ${formatFCFA(grandTotal)} ont été validés.`);
      setTimeout(() => setSuccessMsg(null), 5000);

      // Reset
      setBaskets({
        offrandeOrdinaire: '',
        dime: '',
        actionDeGrace: '',
        construction: '',
        socialEnfants: ''
      });
      setBasketNotes('');
      setBasketEventId('');
      setActiveTab('transactions');
      onRefresh();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer cette opération financière définitivement ?")) return;
    const path = `church_finances/${id}`;
    try {
      await deleteDoc(doc(db, 'church_finances', id));
      setSuccessMsg("L'opération a été supprimée du journal.");
      setTimeout(() => setSuccessMsg(null), 3000);
      onRefresh();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Switch type and set corresponding categories
  const handleTypeChange = (type: TransactionType) => {
    setFormData(prev => ({
      ...prev,
      type,
      category: type === 'Revenu' ? 'Offrande Ordinaire' : 'Loyer du local de culte'
    }));
  };

  // Format charts data (for 6 months)
  const monthlyChartData = useMemo(() => {
    const monthlyMap: { [key: string]: { name: string; Recettes: number; Dépenses: number } } = {};
    
    // Fill last 6 months dynamically
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('fr', { month: 'short', year: '2-digit' });
      monthlyMap[key] = { name: label, Recettes: 0, Dépenses: 0 };
    }

    transactions.forEach(t => {
      const yearMonth = t.date.substring(0, 7); // YYYY-MM
      if (monthlyMap[yearMonth]) {
        const amt = Number(t.amount) || 0;
        if (t.type === 'Revenu') {
          monthlyMap[yearMonth].Recettes += amt;
        } else {
          monthlyMap[yearMonth].Dépenses += amt;
        }
      }
    });

    return Object.values(monthlyMap);
  }, [transactions]);

  const categoryDistribution = useMemo(() => {
    const revenueMap: { [key: string]: number } = {};
    const expenseMap: { [key: string]: number } = {};

    transactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'Revenu') {
        revenueMap[t.category] = (revenueMap[t.category] || 0) + amt;
      } else {
        expenseMap[t.category] = (expenseMap[t.category] || 0) + amt;
      }
    });

    const colors = ["#4F46E5", "#6366F1", "#10B981", "#F59E0B", "#14B8A6", "#3B82F6", "#8B5CF6", "#EC4899", "#06B6D4"];
    
    const revenues = Object.keys(revenueMap).map((cat, idx) => ({
      name: cat,
      value: revenueMap[cat],
      color: colors[idx % colors.length]
    }));

    const expenses = Object.keys(expenseMap).map((cat, idx) => ({
      name: cat,
      value: expenseMap[cat],
      color: colors[idx % colors.length]
    }));

    return { revenues, expenses };
  }, [transactions]);

  // Export current list to CSV
  const handleExportCSV = () => {
    const header = "Date,Type,Categorie,Contributeur,Montant,Notes\n";
    const rows = filteredTransactions.map(t => {
      const date = t.date;
      const type = t.type;
      const cat = `"${t.category.replace(/"/g, '""')}"`;
      const contrib = `"${(t.contributor || 'Assemblée').replace(/"/g, '""')}"`;
      const amount = t.amount;
      const notes = `"${(t.notes || '').replace(/"/g, '""')}"`;
      return `${date},${type},${cat},${contrib},${amount},${notes}`;
    }).join("\n");

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `comptabilite_paroisse_congo-${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Multi-fields Filtering logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      
      let matchesCulte = true;
      if (selectedCulteFilter !== 'all') {
        const matchedEv = events.find(e => e.id === selectedCulteFilter);
        if (matchedEv) {
          // Check if transaction notes or category references this culte or date matches
          const matchDate = t.date === matchedEv.date;
          const matchText = (t.notes || '').toLowerCase().includes(matchedEv.title.toLowerCase());
          matchesCulte = matchDate || matchText;
        }
      }

      const query = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === '' || 
        t.category.toLowerCase().includes(query) || 
        (t.contributor || '').toLowerCase().includes(query) || 
        (t.notes || '').toLowerCase().includes(query) ||
        t.date.includes(query);

      return matchesType && matchesCategory && matchesCulte && matchesSearch;
    }).sort((a, b) => b.date.localeCompare(a.date)); // Sort by date desc
  }, [transactions, typeFilter, categoryFilter, selectedCulteFilter, searchQuery, events]);

  // Data for Bilan Comptable
  const bilanData = useMemo(() => {
    const revenueByCategory: { [cat: string]: number } = {};
    const expenseByCategory: { [cat: string]: number } = {};

    REVENUE_KIND.forEach(cat => { revenueByCategory[cat] = 0; });
    EXPENSE_KIND.forEach(cat => { expenseByCategory[cat] = 0; });

    transactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'Revenu' && revenueByCategory[t.category] !== undefined) {
        revenueByCategory[t.category] += amt;
      } else if (t.type === 'Dépense' && expenseByCategory[t.category] !== undefined) {
        expenseByCategory[t.category] += amt;
      }
    });

    const totalRevenues = Object.values(revenueByCategory).reduce((a, b) => a + b, 0);
    const totalExpenses = Object.values(expenseByCategory).reduce((a, b) => a + b, 0);

    return {
      revenueByCategory,
      expenseByCategory,
      totalRevenues,
      totalExpenses,
      netPosition: totalRevenues - totalExpenses
    };
  }, [transactions]);

  // Data for Grand Livre
  const grandLivreData = useMemo(() => {
    const allCategories = [...REVENUE_KIND, ...EXPENSE_KIND];
    const grouped: { [cat: string]: { transactions: FinanceTransaction[]; total: number; type: 'Revenu' | 'Dépense' } } = {};

    allCategories.forEach(cat => {
      const catTransactions = transactions
        .filter(t => t.category === cat)
        .sort((a, b) => b.date.localeCompare(a.date));
      const total = catTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const type = REVENUE_KIND.includes(cat) ? 'Revenu' : 'Dépense';
      grouped[cat] = { transactions: catTransactions, total, type };
    });

    return grouped;
  }, [transactions]);

  // Journal General data with search and pagination
  const journalFiltered = useMemo(() => {
    const query = journalSearch.toLowerCase();
    return transactions
      .filter(t => {
        if (journalSearch === '') return true;
        return (
          t.category.toLowerCase().includes(query) ||
          (t.contributor || '').toLowerCase().includes(query) ||
          (t.notes || '').toLowerCase().includes(query) ||
          t.date.includes(query) ||
          t.type.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, journalSearch]);

  const journalPaginated = useMemo(() => {
    return journalFiltered.slice(0, journalPage * ITEMS_PER_PAGE);
  }, [journalFiltered, journalPage]);

  const hasMore = journalPaginated.length < journalFiltered.length;

  // Toggle grand livre category
  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl text-slate-800 dark:text-slate-200 font-bold tracking-tight flex items-center gap-2">
            <Coins className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Trésorerie & Comptabilité de la Paroisse
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Suivi des collectes, dîmes, offrandes de culte et dépenses administratives en République du Congo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            type="button"
            onClick={() => {
              setActiveTab('basketAssistant');
              setIsAdding(false);
            }}
            className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3.5 py-1.8 rounded-lg text-xs font-bold transition-all cursor-pointer border border-indigo-200 dark:border-indigo-700 shadow-3xs"
          >
            <Calculator className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Saisie de Culte (Multi-Corbeilles)
          </button>

          {!isAdding && (
            <button 
              id="btn-add-finance"
              onClick={() => {
                setIsAdding(true);
                setActiveTab('transactions');
              }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.8 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer border border-indigo-500"
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-200" />
              Saisir Écriture Unique
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-250 dark:border-emerald-800 p-3 rounded-lg flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300 animate-fade-in shadow-3xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Localized Kpis Cards styled in FCFA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-tr from-slate-900 to-slate-850 p-5 rounded-xl border border-slate-800 text-white flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">Solde de Caisse Actuel</span>
            <span className={`text-2xl font-bold tracking-tight block mt-1 ${stats.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatFCFA(stats.balance)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Fonds disponibles en banque et caisse.</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
            <Coins className="w-4 h-4 text-indigo-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest block font-bold">Cumul des Entrées / Recettes</span>
            <span className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400 block mt-1">
              +{formatFCFA(stats.totalRevenues)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">Collectes ordinaires, dîmes, actions de grâces.</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center border border-emerald-100 dark:border-emerald-800">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest block font-bold">Total des Dépenses / Sorties</span>
            <span className="text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-400 block mt-1">
              -{formatFCFA(stats.totalExpenses)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">Charges, soutiens pastoraux, évangélisations.</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center border border-amber-100 dark:border-amber-800">
            <TrendingDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
      </div>

      {/* Form: Standard Writing Entry */}
      {isAdding && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-md space-y-4 animate-fade-in">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">
            <h3 className="font-bold text-sm text-indigo-650 dark:text-indigo-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              Saisie d'une écriture comptable unique
            </h3>
            <button 
              type="button" 
              onClick={() => setIsAdding(false)} 
              className="text-[11px] text-slate-550 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Fermer la boîte
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Type d'Écriture *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleTypeChange('Revenu')}
                  className={`flex-1 text-xs py-2 px-3 rounded-lg font-semibold border transition-all cursor-pointer ${
                    formData.type === 'Revenu' 
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 shadow-3xs' 
                      : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  Recette (+)
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('Dépense')}
                  className={`flex-1 text-xs py-2 px-3 rounded-lg font-semibold border transition-all cursor-pointer ${
                    formData.type === 'Dépense' 
                      ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-250 dark:border-amber-700 shadow-3xs' 
                      : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  Dépense (—)
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Catégorie d'Église *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-indigo-600 dark:focus:outline-indigo-400 font-medium text-slate-800 dark:text-slate-200"
              >
                {formData.type === 'Revenu' 
                  ? REVENUE_KIND.map(c => <option key={c} value={c}>{c}</option>)
                  : EXPENSE_KIND.map(c => <option key={c} value={c}>{c}</option>)
                }
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Montant (en FCFA) *</label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Ex: 50000"
                  className="w-full text-xs p-2.5 pr-14 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-indigo-600 dark:focus:outline-indigo-400 font-semibold bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
                <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">FCFA</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Date d'opération</label>
              <input
                type="date"
                required
                value={formData.date}
                disabled={!!formData.linkedEventId}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-slate-50/50 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block flex items-center gap-1">
                Associer à un Culte de la paroisse
                <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-normal px-1 py-0.2 rounded-full">Automatique</span>
              </label>
              <select
                value={formData.linkedEventId}
                onChange={(e) => {
                  const evId = e.target.value;
                  const matchedEv = events.find(ev => ev.id === evId);
                  setFormData({ 
                    ...formData, 
                    linkedEventId: evId,
                    date: matchedEv ? matchedEv.date : new Date().toISOString().substring(0, 10)
                  });
                }}
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-indigo-600 dark:focus:outline-indigo-400 text-slate-800 dark:text-slate-200"
              >
                <option value="">-- Culte libre sans rattachement --</option>
                {sortedWorshipEvents.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.date} - {event.title} ({event.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Contributeur / Nom de famille</label>
              <input
                type="text"
                value={formData.contributor}
                onChange={(e) => setFormData({ ...formData, contributor: e.target.value })}
                placeholder="Ex: Frère Jean-Pierre M."
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Notes administratives / Justificatif de dépenses</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Ex: enveloppes reçues au premier service d'Adoration"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-indigo-600 dark:focus:outline-indigo-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
            <button 
              type="button" 
              onClick={() => setIsAdding(false)}
              className="text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              Annuler
            </button>
            <button 
              type="submit" 
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border border-indigo-500 shadow-xs"
            >
              {saving ? "Sauvegarde..." : "Enregistrer l'élaboration"}
            </button>
          </div>
        </form>
      )}

      {/* Internal Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-600 flex gap-4 text-xs font-bold overflow-x-auto shrink-0 pb-1">
        <button
          onClick={() => {
            setActiveTab('transactions');
            setIsAdding(false);
          }}
          className={`pb-2.5 px-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'transactions' && !isAdding
              ? 'border-b-2 border-indigo-650 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400 font-bold' 
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          Opérations Journalières
        </button>

        <button
          onClick={() => {
            setActiveTab('basketAssistant');
            setIsAdding(false);
          }}
          className={`pb-2.5 px-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'basketAssistant' 
              ? 'border-b-2 border-indigo-650 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400 font-bold' 
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <Calculator className="w-3.5 h-3.5 text-slate-450 dark:text-slate-500" />
          Renseigner Corbeilles de Culte
          <span className="bg-amber-150 dark:bg-amber-900/50 text-amber-900 dark:text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1">Exclusivité</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('analytics');
            setIsAdding(false);
          }}
          className={`pb-2.5 px-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'analytics' 
              ? 'border-b-2 border-indigo-650 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400 font-bold' 
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          Statistiques & Graphiques (Congo)
        </button>

        <button
          onClick={() => {
            setActiveTab('budget');
            setIsAdding(false);
          }}
          className={`pb-2.5 px-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'budget' 
              ? 'border-b-2 border-indigo-650 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400 font-bold' 
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          Projections Budgétaires
        </button>

        <button
          onClick={() => {
            setActiveTab('bilan');
            setIsAdding(false);
          }}
          className={`pb-2.5 px-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'bilan' 
              ? 'border-b-2 border-indigo-650 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400 font-bold' 
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-slate-450 dark:text-slate-500" />
          Bilan Comptable
        </button>

        <button
          onClick={() => {
            setActiveTab('journal');
            setIsAdding(false);
          }}
          className={`pb-2.5 px-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'journal' 
              ? 'border-b-2 border-indigo-650 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400 font-bold' 
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5 text-slate-450 dark:text-slate-500" />
          Journal Général
        </button>

        <button
          onClick={() => {
            setActiveTab('grandlivre');
            setIsAdding(false);
          }}
          className={`pb-2.5 px-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'grandlivre' 
              ? 'border-b-2 border-indigo-650 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400 font-bold' 
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <ListFilter className="w-3.5 h-3.5 text-slate-450 dark:text-slate-500" />
          Grand Livre
        </button>
      </div>

      {/* Tab CONTENT: Transactions Ledger */}
      {activeTab === 'transactions' && !isAdding && (
        <div className="space-y-4 animate-fade-in">
          
          {/* Advanced Multi-Filters Header */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/90 dark:border-slate-600 flex flex-col gap-3">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <ListFilter className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              Panneau de tri par Culte & Catégorie
            </span>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Type selector */}
              <div className="flex items-center gap-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 text-xs">
                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-450 dark:text-slate-500" />
                <select 
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="bg-transparent border-0 focus:ring-0 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 w-full"
                >
                  <option value="all">Tous les flux</option>
                  <option value="Revenu">Recettes seulement</option>
                  <option value="Dépense">Dépenses seulement</option>
                </select>
              </div>

              {/* Category selector */}
              <div className="flex items-center gap-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 text-xs">
                <FileText className="w-3.5 h-3.5 text-slate-450 dark:text-slate-500" />
                <select 
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-transparent border-0 focus:ring-0 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 w-full"
                >
                  <option value="all">Toutes les catégories</option>
                  <optgroup label="REVENUS">
                    {REVENUE_KIND.map(k => <option key={k} value={k}>{k}</option>)}
                  </optgroup>
                  <optgroup label="SORTS / DÉPENSES">
                    {EXPENSE_KIND.map(k => <option key={k} value={k}>{k}</option>)}
                  </optgroup>
                </select>
              </div>

              {/* Rattaché à quel culte */}
              <div className="flex items-center gap-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 text-xs">
                <Calendar className="w-3.5 h-3.5 text-slate-450 dark:text-slate-500" />
                <select 
                  value={selectedCulteFilter}
                  onChange={(e) => setSelectedCulteFilter(e.target.value)}
                  className="bg-transparent border-0 focus:ring-0 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 w-full"
                >
                  <option value="all">Tous les Cultes</option>
                  {sortedWorshipEvents.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.date} - {event.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search input field */}
              <div className="flex items-center gap-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 text-xs">
                <Search className="w-3.5 h-3.5 text-slate-450 dark:text-slate-500 whitespace-nowrap" />
                <input 
                  type="text"
                  placeholder="Rechercher (ex: Jean)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-0 focus:ring-0 py-1 text-xs text-slate-705 dark:text-slate-300 w-full outline-hidden"
                />
              </div>
            </div>

            {/* Quick action buttons row */}
            <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 font-semibold pt-1">
              <span>Résultats filtrés: {filteredTransactions.length} écriture(s)</span>
              <button 
                type="button" 
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 text-indigo-650 dark:text-indigo-400 hover:text-indigo-850 dark:hover:text-indigo-300 cursor-pointer bg-white dark:bg-slate-700 px-2 py-0.8 rounded border border-slate-200 dark:border-slate-600 shadow-3xs"
              >
                <Download className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                Exporter en format Excel / CSV
              </button>
            </div>
          </div>

          {/* Transactions Data Table */}
          {loading ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 font-semibold animate-pulse">
              Chargement des flux financiers en direct de Firestore...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl space-y-2 text-slate-450 dark:text-slate-500">
              <Coins className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm">Aucun flux ne correspond aux filtres de tri d'Église.</p>
              <button 
                type="button" 
                onClick={() => { setCategoryFilter('all'); setTypeFilter('all'); setSelectedCulteFilter('all'); setSearchQuery(''); }}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Annuler les filtres
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden shadow-3xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200/90 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-3">Date d'effet</th>
                      <th className="p-3">Désignation / Rubrique</th>
                      <th className="p-3">Notes & Culte liés</th>
                      <th className="p-3">Contributeur / Donneur</th>
                      <th className="p-3">Catégorisation</th>
                      <th className="p-3 text-right">Montant</th>
                      <th className="p-3 text-center">Nettoyer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                    {filteredTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors">
                        <td className="p-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{t.date}</td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{t.category}</div>
                        </td>
                        <td className="p-3 max-w-[280px]">
                          <div className="text-slate-650 dark:text-slate-400 leading-relaxed text-xs break-words">{t.notes || "—"}</div>
                        </td>
                        <td className="p-3 font-medium text-slate-805 dark:text-slate-300">
                          {t.contributor ? (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                              {t.contributor}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic">Autre collecte d'assemblée</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] tracking-wide inline-block ${
                            t.type === 'Revenu' 
                              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-800' 
                              : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-150 dark:border-amber-800'
                          }`}>
                            {t.type === 'Revenu' ? 'RECETTE (Entrée)' : 'SORTIE / CHARGE'}
                          </span>
                        </td>
                        <td className={`p-3 text-right font-bold text-[13px] whitespace-nowrap tracking-tight ${
                          t.type === 'Revenu' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'
                        }`}>
                          {t.type === 'Revenu' ? '+' : '-'}{formatFCFA(t.amount)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => t.id && handleDelete(t.id)}
                            className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
                            title="Supprimer la transaction comptable"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab CONTENT: Advanced Multi-Basket Assistant (Saisie Rapide Panoramique de Culte) */}
      {activeTab === 'basketAssistant' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm space-y-6 animate-fade-in font-sans">
          <div className="border-b border-indigo-100 dark:border-indigo-900/50 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Calculateur Multi-Corbeilles de Culte (Rapport Trésorier Express)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Utilisez ce panneau pour dactylographier globalement les différentes corbeilles et enveloppes collectées à la fin d'un culte paroissial répertorié. L'assistant scindera automatiquement les flux en autant de fiches d'écritures correspondantes dans la base en un seul clic !
            </p>
          </div>

          <form onSubmit={handleBasketAssistantSubmit} className="space-y-6">
            
            {/* Step 1: Link Culte event */}
            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-indigo-750 dark:text-indigo-400 block uppercase tracking-wide">
                  1. Choisir le Culte ou Activité concerné *
                </label>
                <select
                  required
                  value={basketEventId}
                  onChange={(e) => {
                    setBasketEventId(e.target.value);
                    // auto-fill notes context if they want
                    const ev = events.find(ex => ex.id === e.target.value);
                    if (ev) {
                      setBasketNotes(`Collecte comptée le ${ev.date} sous le ministère de orateur: ${ev.preacher || "Pasteur"}`);
                    }
                  }}
                  className="w-full text-xs p-3 border border-slate-250 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-indigo-600 dark:focus:outline-indigo-400 font-bold text-slate-800 dark:text-slate-200"
                >
                  <option value="">-- Sélectionnez un culte de la liste --</option>
                  {sortedWorshipEvents.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.date} - {ev.title} (Orateur: {ev.preacher || "N/A"})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-450 dark:text-slate-500 italic">
                  Note : Si le culte n'apparait pas, veuillez le créer d'abord sous l'onglet "Cultes & Activités".
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-655 dark:text-slate-400 block uppercase tracking-wide">
                  Notes de synthèse / observations pour les relevés
                </label>
                <textarea
                  rows={2}
                  value={basketNotes}
                  onChange={(e) => setBasketNotes(e.target.value)}
                  placeholder="Ex: Comptage effectué par les membres du département d'accueil et d'administration."
                  className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-indigo-600 dark:focus:outline-indigo-400 font-medium bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            {/* Step 2: Input cash for each basket */}
            <div className="space-y-2">
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-widest block">
                2. Saisir les Totaux des Corbeilles (Baskets de collecte en FCFA)
              </span>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                
                {/* Corbeille Offrande Ordinaire */}
                <div className="bg-slate-50/70 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-600 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                    <span>Offrande Ordinaire</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      value={baskets.offrandeOrdinaire}
                      onChange={(e) => setBaskets({ ...baskets, offrandeOrdinaire: e.target.value })}
                      placeholder="Indisponible"
                      className="w-full text-xs p-2.5 pr-12 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg focus:outline-indigo-600 dark:focus:outline-indigo-400 font-extrabold text-indigo-700 dark:text-indigo-400"
                    />
                    <span className="absolute right-3 top-3 text-[9px] text-slate-400 dark:text-slate-500 font-bold font-mono">FCFA</span>
                  </div>
                  <span className="text-[10px] text-slate-450 dark:text-slate-500 block font-medium">Panier classique assemblée</span>
                </div>

                {/* Enveloppes des Dîmes */}
                <div className="bg-slate-50/70 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-600 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                    <span>Dîmes (10%)</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      value={baskets.dime}
                      onChange={(e) => setBaskets({ ...baskets, dime: e.target.value })}
                      placeholder="Indisponible"
                      className="w-full text-xs p-2.5 pr-12 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg focus:outline-emerald-605 dark:focus:outline-emerald-400 font-extrabold text-emerald-700 dark:text-emerald-400"
                    />
                    <span className="absolute right-3 top-3 text-[9px] text-slate-400 dark:text-slate-500 font-bold font-mono">FCFA</span>
                  </div>
                  <span className="text-[10px] text-slate-450 dark:text-slate-500 block font-medium">Fidélité dîmes individuelles</span>
                </div>

                {/* Corbeille Action de Grâce */}
                <div className="bg-slate-50/70 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-600 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                    <span>Action de Grâce</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      value={baskets.actionDeGrace}
                      onChange={(e) => setBaskets({ ...baskets, actionDeGrace: e.target.value })}
                      placeholder="Indisponible"
                      className="w-full text-xs p-2.5 pr-12 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg focus:outline-amber-600 dark:focus:outline-amber-400 font-extrabold text-amber-700 dark:text-amber-400"
                    />
                    <span className="absolute right-3 top-3 text-[9px] text-slate-400 dark:text-slate-500 font-bold font-mono">FCFA</span>
                  </div>
                  <span className="text-[10px] text-slate-450 dark:text-slate-500 block font-medium">Témoignages & reconnaissance</span>
                </div>

                {/* Corbeille Fonds Travaux */}
                <div className="bg-slate-50/70 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-600 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <span>Fonds Construction</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      value={baskets.construction}
                      onChange={(e) => setBaskets({ ...baskets, construction: e.target.value })}
                      placeholder="Indisponible"
                      className="w-full text-xs p-2.5 pr-12 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg focus:outline-rose-500 dark:focus:outline-rose-400 font-extrabold text-rose-700 dark:text-rose-400"
                    />
                    <span className="absolute right-3 top-3 text-[9px] text-slate-400 dark:text-slate-500 font-bold font-mono">FCFA</span>
                  </div>
                  <span className="text-[10px] text-slate-450 dark:text-slate-500 block font-medium">Fonds d'investissement / Loyer</span>
                </div>

                {/* Corbeille Enfants / Social */}
                <div className="bg-slate-50/70 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-600 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-600"></span>
                    <span>École Dimanche</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      value={baskets.socialEnfants}
                      onChange={(e) => setBaskets({ ...baskets, socialEnfants: e.target.value })}
                      placeholder="Indisponible"
                      className="w-full text-xs p-2.5 pr-12 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg focus:outline-cyan-600 dark:focus:outline-cyan-400 font-extrabold text-cyan-700 dark:text-cyan-400"
                    />
                    <span className="absolute right-3 top-3 text-[9px] text-slate-400 dark:text-slate-500 font-bold font-mono">FCFA</span>
                  </div>
                  <span className="text-[10px] text-slate-450 dark:text-slate-500 block font-medium">Collectes moniteurs EcoDim</span>
                </div>

              </div>
            </div>

            {/* Live total display */}
            <div className="bg-slate-900 p-5 rounded-xl text-white flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">Total Général Enregistré pour le Culte</span>
                <span className="text-xl font-bold tracking-tight text-emerald-400 block mt-0.5">
                  {formatFCFA(
                    (parseFloat(baskets.offrandeOrdinaire) || 0) +
                    (parseFloat(baskets.dime) || 0) +
                    (parseFloat(baskets.actionDeGrace) || 0) +
                    (parseFloat(baskets.construction) || 0) +
                    (parseFloat(baskets.socialEnfants) || 0)
                  )}
                </span>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.8 rounded-lg border border-indigo-500 transition-all cursor-pointer shadow-sm"
              >
                {saving ? "Sauvegarde globale groupée..." : "Enregistrer toutes les corbeilles de Culte"}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Tab CONTENT: Financial Statistics Displays */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-sans animate-fade-in">
          
          {/* Trends diagram in FCFA */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-650 dark:text-indigo-400" />
              Évolution Financière Paroissiale (Frs CFA — 6 derniers mois)
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={(val) => `${val.toLocaleString('fr-FR')}`} />
                  <Tooltip formatter={(value) => `${Number(value).toLocaleString('fr-FR')} FCFA`} />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                  <Bar dataKey="Recettes" fill="#4F46E5" name="Recettes (Offrandes, etc.)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Dépenses" fill="#F59E0B" name="Achat, groupe, missions" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Categories distribute */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 space-y-6 shadow-xs">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              Répartition Analytique des Fonds (CFA)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Recettes breakdown */}
              <div className="space-y-2 text-center border-r border-slate-100 dark:border-slate-700 pr-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block tracking-wide">Ventilation des Recettes</span>
                {categoryDistribution.revenues.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 py-12">Aucune recette répertoriée</p>
                ) : (
                  <div className="h-44 flex flex-col justify-between items-center">
                    <div className="h-32 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryDistribution.revenues}
                            cx="50%"
                            cy="50%"
                            innerRadius={28}
                            outerRadius={45}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {categoryDistribution.revenues.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `${Number(value).toLocaleString('fr-FR')} FCFA`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-1 justify-center max-h-16 overflow-y-auto text-[9px] mt-1 pr-1">
                      {categoryDistribution.revenues.map(r => (
                        <span key={r.name} className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: r.color }}></span>
                          <span className="text-slate-600 dark:text-slate-400">{r.name} ({Math.round(r.value / (stats.totalRevenues || 1) * 100)}%)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Dépenses breakdown */}
              <div className="space-y-2 text-center pl-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block tracking-wide">Ventilation des Dépenses</span>
                {categoryDistribution.expenses.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 py-12">Aucune dépense enregistrée</p>
                ) : (
                  <div className="h-44 flex flex-col justify-between items-center">
                    <div className="h-32 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryDistribution.expenses}
                            cx="50%"
                            cy="50%"
                            innerRadius={28}
                            outerRadius={45}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {categoryDistribution.expenses.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `${Number(value).toLocaleString('fr-FR')} FCFA`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-1 justify-center max-h-16 overflow-y-auto text-[9px] mt-1 pr-1">
                      {categoryDistribution.expenses.map(e => (
                        <span key={e.name} className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: e.color }}></span>
                          <span className="text-slate-600 dark:text-slate-400">{e.name} ({Math.round(e.value / (stats.totalExpenses || 1) * 100)}%)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Tab CONTENT: Budget Objectives and Forecast in FCFA */}
      {activeTab === 'budget' && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-600 shadow-3xs space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Table de Correspondance & Projections Budgétaires Annuelles / Mensuelles
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Comparatif en direct entre les prévisions arrêtées par le comité des finances d'église et la réalité.
              </p>
            </div>
            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 text-indigo-750 dark:text-indigo-400 font-bold px-2.5 py-0.8 rounded-full uppercase tracking-wider">
              En Francs CFA (république congo)
            </span>
          </div>

          <div className="space-y-5 text-xs font-sans">
            
            {/* KPI 1 : Objective Dîmes/Offrandes */}
            <div>
              <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                <span className="flex items-center gap-1">
                  1. Dîmes & Offrandes (Objectif Budget Mensuel Général)
                </span>
                <span className="text-slate-800 dark:text-slate-200">
                  {formatFCFA(stats.totalRevenues)} réalisés / 4 500 000 FCFA projeté
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden flex">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-550" 
                  style={{ width: `${Math.min(100, (stats.totalRevenues / 4500000) * 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-450 dark:text-slate-500 mt-1 font-semibold">
                <span>Rendement: {Math.round((stats.totalRevenues / 4500000) * 100)}%</span>
                <span>Cible: 4,5M FCFA</span>
              </div>
            </div>

            {/* KPI 2 : Charges d'exploitation */}
            <div>
              <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                <span className="flex items-center gap-1">
                  2. Charges d'Exploitation Paroisse (Loyer, Groupe Électrogène, Soutiens)
                </span>
                <span className="text-slate-850 dark:text-slate-200">
                  {formatFCFA(stats.totalExpenses)} dépensés / 2 000 000 FCFA autorisé max
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-550 ${stats.totalExpenses > 2000000 ? 'bg-rose-600' : 'bg-amber-500'}`} 
                  style={{ width: `${Math.min(100, (stats.totalExpenses / 2000000) * 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-450 dark:text-slate-500 mt-1 font-semibold">
                <span>Consommation de l'enveloppe: {Math.round((stats.totalExpenses / 2000000) * 100)}%</span>
                <span>Seuil d'alerte: 2,0M FCFA</span>
              </div>
            </div>

            {/* KPI 3 : Autonomie locale sociale */}
            <div>
              <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                <span>3. Réserve Solidarité / Fonds Social local d'Entre-Aide</span>
                <span>
                  {formatFCFA(stats.totalRevenues * 0.15)} provisionnés (Objectif: 15% recommandé des contributions)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full transition-all duration-550" 
                  style={{ width: '100%' }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-450 dark:text-slate-500 italic mt-1 leading-relaxed">
                Recommandation synodale : Conservez au moins 15% de vos recettes pour soutenir les orphelins, veuves et urgences sanitaires locales (Social).
              </p>
            </div>

          </div>
        </div>
      )}

      {/* Tab CONTENT: Bilan Comptable (Balance Sheet) */}
      {activeTab === 'bilan' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Actif (Assets) */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Actif (Total Recettes)
              </h3>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mb-4">
                {formatFCFA(bilanData.totalRevenues)}
              </div>
              <div className="space-y-2">
                {REVENUE_KIND.map(cat => (
                  <div key={cat} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <span className="text-xs text-slate-600 dark:text-slate-400">{cat}</span>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      {formatFCFA(bilanData.revenueByCategory[cat])}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Passif (Liabilities) */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                Passif (Total Dépenses)
              </h3>
              <div className="text-2xl font-bold text-rose-700 dark:text-rose-400 mb-4">
                {formatFCFA(bilanData.totalExpenses)}
              </div>
              <div className="space-y-2">
                {EXPENSE_KIND.map(cat => (
                  <div key={cat} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <span className="text-xs text-slate-600 dark:text-slate-400">{cat}</span>
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
                      {formatFCFA(bilanData.expenseByCategory[cat])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Situation Nette (Net Position) */}
          <div className={`p-6 rounded-xl border-2 shadow-sm ${
            bilanData.netPosition >= 0
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
              : 'bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700'
          }`}>
            <div className="text-center">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                Situation Nette (Trésorerie)
              </span>
              <span className={`text-3xl font-bold block mt-2 ${
                bilanData.netPosition >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}>
                {bilanData.netPosition >= 0 ? '+' : ''}{formatFCFA(bilanData.netPosition)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 block mt-1">
                {bilanData.netPosition >= 0
                  ? 'La paroisse est en situation excédentaire — bonne gestion.'
                  : 'La paroisse est en situation déficitaire — attention au risque de trésorerie.'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab CONTENT: Journal Général (General Journal) */}
      {activeTab === 'journal' && (
        <div className="space-y-4 animate-fade-in">
          {/* Search bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600 shadow-xs">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder="Rechercher dans le journal (date, catégorie, contributeur...)"
                value={journalSearch}
                onChange={(e) => {
                  setJournalSearch(e.target.value);
                  setJournalPage(1);
                }}
                className="w-full text-xs p-2 border-0 focus:ring-0 bg-transparent text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-hidden"
              />
            </div>
          </div>

          {/* Journal table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Catégorie</th>
                    <th className="p-3 text-right">Montant</th>
                    <th className="p-3">Contributeur</th>
                    <th className="p-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {journalPaginated.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 dark:text-slate-500">
                        Aucune écriture trouvée dans le journal.
                      </td>
                    </tr>
                  ) : (
                    journalPaginated.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors">
                        <td className="p-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{t.date}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            t.type === 'Revenu'
                              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                              : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          }`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-700 dark:text-slate-300">{t.category}</td>
                        <td className={`p-3 text-right font-bold ${
                          t.type === 'Revenu' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                        }`}>
                          {t.type === 'Revenu' ? '+' : '-'}{formatFCFA(t.amount)}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          {t.contributor || <span className="italic text-slate-400 dark:text-slate-500">Assemblée</span>}
                        </td>
                        <td className="p-3 max-w-[200px] truncate text-slate-500 dark:text-slate-400" title={t.notes}>
                          {t.notes || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
            <span>{journalPaginated.length} / {journalFiltered.length} écritures affichées</span>
            {hasMore && (
              <button
                onClick={() => setJournalPage(prev => prev + 1)}
                className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-4 py-2 rounded-lg font-bold transition-all cursor-pointer border border-indigo-200 dark:border-indigo-700"
              >
                Voir plus ({journalFiltered.length - journalPaginated.length} restantes)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab CONTENT: Grand Livre (General Ledger) */}
      {activeTab === 'grandlivre' && (
        <div className="space-y-3 animate-fade-in">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Transactions groupées par catégorie comptable. Cliquez sur une catégorie pour développer les écritures.
          </p>
          {[...REVENUE_KIND, ...EXPENSE_KIND].map(cat => {
            const data = grandLivreData[cat];
            if (!data || data.transactions.length === 0) return null;
            const isExpanded = expandedCategories[cat] || false;
            const isRevenue = data.type === 'Revenu';
            let runningBalance = 0;

            return (
              <div key={cat} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden shadow-xs">
                {/* Category header (accordion trigger) */}
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-all cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isRevenue ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                    <div>
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{cat}</span>
                      <span className={`text-[10px] ml-2 font-semibold ${isRevenue ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        ({data.transactions.length} écriture{data.transactions.length > 1 ? 's' : ''})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-bold text-sm ${isRevenue ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                      {isRevenue ? '+' : '-'}{formatFCFA(data.total)}
                    </span>
                    <svg
                      className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-700 overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                          <th className="p-2.5 pl-4">Date</th>
                          <th className="p-2.5 text-right">Montant</th>
                          <th className="p-2.5">Contributeur</th>
                          <th className="p-2.5 pr-4 text-right">Solde cumulé</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {data.transactions.map(t => {
                          runningBalance += Number(t.amount) || 0;
                          return (
                            <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors">
                              <td className="p-2.5 pl-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{t.date}</td>
                              <td className={`p-2.5 text-right font-bold ${
                                isRevenue ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                              }`}>
                                {isRevenue ? '+' : '-'}{formatFCFA(t.amount)}
                              </td>
                              <td className="p-2.5 text-slate-600 dark:text-slate-400">
                                {t.contributor || <span className="italic text-slate-400 dark:text-slate-500">Assemblée</span>}
                              </td>
                              <td className={`p-2.5 pr-4 text-right font-bold ${
                                isRevenue ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                              }`}>
                                {formatFCFA(runningBalance)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          {[...REVENUE_KIND, ...EXPENSE_KIND].every(cat => !grandLivreData[cat] || grandLivreData[cat].transactions.length === 0) && (
            <div className="text-center py-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-400 dark:text-slate-500">
              <ListFilter className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm">Aucune transaction enregistrée dans le Grand Livre.</p>
            </div>
          )}
        </div>
      )}

      {/* Small informative advice tooltip in Congo context */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 p-3.5 rounded-xl flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 mt-2">
        <Info className="w-4 h-4 text-indigo-505 dark:text-indigo-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] block">Ratios d'évaluation monétaire & Trésorerie d'Église :</span>
          <p className="leading-relaxed text-[10.5px]">
            Toutes les valeurs affichées ci-haut respectent scrupuleusement la monnaie locale (Franc CFA - CEMAC) en République du Congo. Assurez-vous d'entrer des montants ronds lors de la saisie (sans virgule) car le Franc CFA n'utilise plus de fractions centimales en comptabilité physique.
          </p>
        </div>
      </div>

    </div>
  );
}
