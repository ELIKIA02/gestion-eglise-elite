import React, { useState, useMemo } from 'react';
import { collection, addDoc, db, handleFirestoreError, OperationType } from '../firebase';
import { Member, FinanceTransaction, ChurchEvent, CommunicationLog } from '../types';
import type { ChurchSettings } from '../types';
import { Users, DollarSign, Calendar, Sparkles, Send, AlertTriangle, ShieldCheck, HeartCrack, ChevronRight, Church, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface DashboardModuleProps {
  members: Member[];
  transactions: FinanceTransaction[];
  events: ChurchEvent[];
  comms: CommunicationLog[];
  settings: ChurchSettings | null;
  loading: boolean;
  onRefreshAll: () => void;
  onNavigate: (tab: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  Actif: '#10B981',
  Inactif: '#EF4444',
  'En observation': '#F59E0B'
};

const CHART_COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#3B82F6", "#EC4899", "#14B8A6", "#8B5CF6", "#F97316"];

export default function DashboardModule({ 
  members, 
  transactions, 
  events, 
  comms, 
  settings,
  loading, 
  onRefreshAll,
  onNavigate 
}: DashboardModuleProps) {

  const [seeding, setSeeding] = useState(false);

  // Financial aggregates
  const financials = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    transactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'Revenu') totalIn += amt;
      else totalOut += amt;
    });
    return {
      balance: totalIn - totalOut,
      totalIn,
      totalOut
    };
  }, [transactions]);

  // Monthly chart data (last 6 months)
  const monthlyChartData = useMemo(() => {
    const now = new Date();
    const monthMap: Record<string, { name: string; Revenus: number; Dépenses: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[key] = {
        name: d.toLocaleString('fr-FR', { month: 'short' }),
        Revenus: 0,
        Dépenses: 0
      };
    }
    transactions.forEach(t => {
      const ym = t.date.substring(0, 7);
      if (monthMap[ym]) {
        const amt = Number(t.amount) || 0;
        if (t.type === 'Revenu') monthMap[ym].Revenus += amt;
        else monthMap[ym].Dépenses += amt;
      }
    });
    return Object.keys(monthMap).sort().map(k => monthMap[k]);
  }, [transactions]);

  // Member status distribution
  const memberStatusData = useMemo(() => {
    const counts: Record<string, number> = { Actif: 0, Inactif: 0, 'En observation': 0 };
    members.forEach(m => {
      if (counts[m.status] !== undefined) counts[m.status]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [members]);

  // Member ministry distribution
  const memberMinistryData = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach(m => {
      const key = m.ministry || 'Non assigné';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [members]);

  // Attendance metrics & decline alarm
  const attendanceDecline = useMemo(() => {
    if (events.length <= 1) return null;
    const sorted = [...events].sort((a,b) => b.date.localeCompare(a.date));
    const latest = sorted[0];
    const prevs = sorted.slice(1);
    const prevSum = prevs.reduce((acc, curr) => acc + (curr.attendance || 0), 0);
    const avgPrior = prevSum / prevs.length;
    if (avgPrior === 0) return null;
    const declinePercent = ((avgPrior - latest.attendance) / avgPrior) * 100;

    if (declinePercent >= 15) {
      return {
        percent: Math.round(declinePercent),
        avg: Math.round(avgPrior),
        latest: latest.attendance,
        title: latest.title
      };
    }
    return null;
  }, [events]);

  // Seed standard church records for demonstration
  const handleSeedDemodatabase = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir générer des données de démonstration dans le registre ? Cela ajoutera des fidèles, cultes passés et comptes.")) return;
    
    setSeeding(true);
    try {
      // 1. Seed Members
      const memberSeed = [
        { name: "Marc-Aurèle Louemba", email: "m.louemba@yahoo.fr", phone: "+33 6 45 88 12 00", status: "Actif", ministry: "Musique & Louange" },
        { name: "Priscille Ngotene", email: "p.ngotene@gmail.com", phone: "+33 7 12 99 54 88", status: "Actif", ministry: "École du dimanche" },
        { name: "Sarah Bakong", email: "s.bakong@outlook.com", phone: "+33 6 32 11 04 29", status: "En observation", ministry: "Aucun" },
        { name: "Jean-Eudes N'Goran", email: "je.ngoran@gmail.com", phone: "+242 05 551 29 11", status: "Actif", ministry: "Accueil (Ushers)" },
        { name: "Félicité Mbemba", email: "f.mbemba@gmail.com", phone: "+33 6 01 22 99 44", status: "Inactif", ministry: "Aucun" }
      ];

      for (const m of memberSeed) {
        await addDoc(collection(db, 'church_members'), {
          ...m,
          createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
        });
      }

      // 2. Seed Finance
      const financeSeed = [
        { type: "Revenu", category: "Dîme (10% de fidélité)", amount: 150000, date: "2026-06-01", contributor: "Marc-Aurèle Louemba", notes: "Dîme mensuelle de fidélité de juin" },
        { type: "Revenu", category: "Offrande Ordinaire", amount: 45000, date: "2026-06-03", contributor: "Culte Mercredi", notes: "Offrandes ordinaires de culte" },
        { type: "Revenu", category: "Action de Grâce & Témoignages", amount: 75000, date: "2026-06-07", contributor: "Sœur Priscille", notes: "Action de grâce pour guérison miraculeuse" },
        { type: "Dépense", category: "Loyer du local de culte", amount: 350000, date: "2026-06-02", contributor: "Bailleur Temple", notes: "Loyer mensuel du temple principal" },
        { type: "Dépense", category: "Électricité / Carburant Groupe Électrogène", amount: 35000, date: "2026-06-05", contributor: "E2C / Carburant", notes: "Facture électricité et carburant pour le groupe de secours" },
        { type: "Dépense", category: "Soutien Pastoral / Indemnités", amount: 100000, date: "2026-06-09", contributor: "Secrétariat", notes: "Indemnités et intendance pastorale" }
      ];

      for (const f of financeSeed) {
        await addDoc(collection(db, 'church_finances'), {
          ...f,
          createdAt: new Date().toISOString()
        });
      }

      // 3. Seed Events (with declining participation sequence 120 -> 130 -> 115 -> 80)
      const eventSeed = [
        { title: "Culte Dominical - Moisson", type: "Culte régulier", date: "2026-05-17", time: "10:00", attendance: 120, preacher: "Pasteur Michel", notes: "Thème: La fidélité de Dieu", observations: "Excellente louange" },
        { title: "Grande Célébration Pentecôte", type: "Culte régulier", date: "2026-05-24", time: "10:00", attendance: 130, preacher: "Évangéliste Koffi", notes: "Thème: Le Saint-Esprit descend", observations: "Chaleur intense dans la nef" },
        { title: "Culte de Dimanche - Prière", type: "Culte régulier", date: "2026-05-31", time: "10:00", attendance: 115, preacher: "Pasteur Michel", notes: "Thème: Prier sans cesse", observations: "Scolarité en grève" },
        { title: "Culte & Partage Fraternel", type: "Culte régulier", date: "2026-06-07", time: "10:00", attendance: 80, preacher: "Ancien Matthieu", notes: "Thème: Aimer son prochain", observations: "Pluie torrentielle ayant découragé les fidèles" }
      ];

      for (const e of eventSeed) {
        await addDoc(collection(db, 'church_events'), {
          ...e,
          createdAt: new Date().toISOString()
        });
      }

      alert(" Base de données d'Église alimentée avec succès !");
      onRefreshAll();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "seeding");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page d'accueil personnalisée */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-800 text-white p-6 md:p-8 rounded-xl shadow-md border border-slate-700">
        <div className="flex flex-col md:flex-row items-center gap-5">
          <div className="flex-shrink-0">
            {settings?.appLogo?.startsWith('data:image') ? (
              <img src={settings.appLogo} alt="Logo" className="w-20 h-20 md:w-24 md:h-24 object-contain rounded-2xl bg-white/10 p-2 border border-white/20" />
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-4xl">
                {settings?.appLogo || '⛪'}
              </div>
            )}
          </div>
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              {settings?.appName || 'ELIKIA EKLESIA'}
            </h1>
            <p className="text-indigo-200/80 text-xs md:text-sm mt-1 leading-relaxed max-w-xl">
              {settings?.reportHeader?.split('\n')[0] || 'Bienvenue dans votre système de gestion paroissiale'}
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3">
              <span className="flex items-center gap-1 text-[10px] bg-white/10 px-3 py-1 rounded-full text-indigo-200">
                <Users className="w-3 h-3" /> {members.length} membres
              </span>
              <span className="flex items-center gap-1 text-[10px] bg-white/10 px-3 py-1 rounded-full text-emerald-200">
                <DollarSign className="w-3 h-3" /> {Math.round(financials.balance).toLocaleString('fr-FR')} FCFA
              </span>
              <span className="flex items-center gap-1 text-[10px] bg-white/10 px-3 py-1 rounded-full text-amber-200">
                <Calendar className="w-3 h-3" /> {events.length} cultes
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {members.length === 0 && (
              <button onClick={handleSeedDemodatabase} disabled={seeding}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-lg text-xs cursor-pointer shadow-md border border-indigo-400 transition-all">
                <Sparkles className="w-3.5 h-3.5" />
                {seeding ? "Création..." : "Alimenter la démo"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onClick={() => onNavigate('members')}
          className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all shadow-xs cursor-pointer">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center"><Users className="w-4 h-4 text-indigo-600" /></div>
          <div className="text-left"><div className="text-xs font-bold text-slate-800 dark:text-slate-200">Membres</div><div className="text-[10px] text-slate-400">Gérer les fidèles</div></div>
        </button>
        <button onClick={() => onNavigate('finances')}
          className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-emerald-300 dark:hover:border-emerald-500 transition-all shadow-xs cursor-pointer">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center"><DollarSign className="w-4 h-4 text-emerald-600" /></div>
          <div className="text-left"><div className="text-xs font-bold text-slate-800 dark:text-slate-200">Finances</div><div className="text-[10px] text-slate-400">Dîmes & offrandes</div></div>
        </button>
        <button onClick={() => onNavigate('cultes')}
          className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-amber-300 dark:hover:border-amber-500 transition-all shadow-xs cursor-pointer">
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center"><Calendar className="w-4 h-4 text-amber-600" /></div>
          <div className="text-left"><div className="text-xs font-bold text-slate-800 dark:text-slate-200">Cultes</div><div className="text-[10px] text-slate-400">Programmer</div></div>
        </button>
        <button onClick={() => onNavigate('ressources')}
          className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-purple-300 dark:hover:border-purple-500 transition-all shadow-xs cursor-pointer">
          <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center"><FileText className="w-4 h-4 text-purple-600" /></div>
          <div className="text-left"><div className="text-xs font-bold text-slate-800 dark:text-slate-200">Documents</div><div className="text-[10px] text-slate-400">Certificats & reçus</div></div>
        </button>
      </div>

      {/* KPI statistics cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/90 dark:border-slate-600 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-700">
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
          </div>
          <div>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 block uppercase font-bold tracking-wider">Registre Fidèles</span>
            <span className="text-lg font-bold text-slate-850 dark:text-slate-200">{members.length} membres</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/90 dark:border-slate-600 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center border border-emerald-100 dark:border-emerald-700">
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
          </div>
          <div>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 block uppercase font-bold tracking-wider">Soldes des comptes</span>
            <span className={`text-lg font-bold ${financials.balance >= 0 ? "text-emerald-750 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
              {Math.round(financials.balance).toLocaleString('fr-FR')} FCFA
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/90 dark:border-slate-600 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center border border-amber-100 dark:border-amber-700">
            <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-300" />
          </div>
          <div>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 block uppercase font-bold tracking-wider">Cultes Célébrés</span>
            <span className="text-lg font-bold text-slate-850 dark:text-slate-200">{events.length} cultes</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/90 dark:border-slate-600 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-full bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center border border-sky-100 dark:border-sky-700">
            <Send className="w-4 h-4 text-sky-600 dark:text-sky-300" />
          </div>
          <div>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 block uppercase font-bold tracking-wider">Campagnes Envois</span>
            <span className="text-lg font-bold text-slate-850 dark:text-slate-200">{comms.length} envoyés</span>
          </div>
        </div>
      </div>

      {/* Chart section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly revenue/expense bar chart */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200/90 dark:border-slate-600 shadow-xs">
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-4">Finances mensuelles (6 derniers mois)</h3>
          {monthlyChartData.some(d => d.Revenus > 0 || d.Dépenses > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: '8px', color: '#F1F5F9', fontSize: '12px' }}
                  formatter={(value: number) => Math.round(value).toLocaleString('fr-FR') + ' FCFA'}
                />
                <Bar dataKey="Revenus" fill="#10B981" name="Revenus" radius={[4,4,0,0]} />
                <Bar dataKey="Dépenses" fill="#EF4444" name="Dépenses" radius={[4,4,0,0]} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-slate-400 dark:text-slate-500 text-xs italic">Aucune donnée financière mensuelle.</div>
          )}
        </div>

        {/* Member status pie chart */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200/90 dark:border-slate-600 shadow-xs">
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-4">Répartition des membres par statut</h3>
          {memberStatusData.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={memberStatusData}
                  cx="50%" cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {memberStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#6B7280'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: '8px', color: '#F1F5F9', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-slate-400 dark:text-slate-500 text-xs italic">Aucun membre enregistré.</div>
          )}
        </div>
      </div>

      {/* Member ministry distribution bar chart */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200/90 dark:border-slate-600 shadow-xs">
        <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-4">Membres par ministère</h3>
        {memberMinistryData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={memberMinistryData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} width={140} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569', borderRadius: '8px', color: '#F1F5F9', fontSize: '12px' }}
                formatter={(value: number) => `${value} membre${value > 1 ? 's' : ''}`}
              />
              <Bar dataKey="value" fill="#4F46E5" name="Membres" radius={[0,4,4,0]}>
                {memberMinistryData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
              <Legend wrapperStyle={{ fontSize: '11px' }} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[250px] text-slate-400 dark:text-slate-500 text-xs italic">Aucune donnée de ministère.</div>
        )}
      </div>

      {/* Realtime Anomalies Advisory & Alarm system */}
      <div id="general-alarms" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Attendance anomaly alarm */}
        {attendanceDecline ? (
          <div className="bg-amber-50/70 dark:bg-amber-900/30 border border-amber-200/80 dark:border-amber-700/60 p-4 rounded-xl space-y-2 flex flex-col justify-between shadow-xs">
            <div className="flex items-start gap-2">
              <HeartCrack className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-amber-800 dark:text-amber-200 uppercase block tracking-wider">Chute d'affluence dominicale</span>
                <p className="text-xs text-amber-950 dark:text-amber-100">
                  Le dernier culte <strong>"{attendanceDecline.title}"</strong> a enregistré seulement {attendanceDecline.latest} fidèles, soit une diminution significative de <strong className="text-red-700 dark:text-red-400 text-sm font-semibold">-{attendanceDecline.percent}%</strong> par rapport à votre moyenne habituelle de {attendanceDecline.avg} participants.
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => onNavigate('ia')} 
              className="text-xs font-semibold text-amber-900 dark:text-amber-100 bg-amber-100/80 dark:bg-amber-800/50 hover:bg-amber-150 dark:hover:bg-amber-700/50 p-2 rounded-lg flex items-center justify-between transition-all pt-2 mt-2 cursor-pointer"
            >
              <span>Consulter l'IA pour remédiation pastorale</span>
              <ChevronRight className="w-4 h-4 text-amber-700 dark:text-amber-300" />
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50/60 dark:bg-emerald-900/30 border border-emerald-150 dark:border-emerald-700/60 p-4 rounded-xl flex items-start gap-2 text-emerald-950 dark:text-emerald-100 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-300 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-200 uppercase block tracking-wider">Affluence & Tendances Stables</span>
              <p>Tous les indicateurs d'assistance paroissiale sont au vert. La participation est stable et en progression.</p>
            </div>
          </div>
        )}

        {/* Treasury warning level */}
        {financials.balance < 150000 ? (
          <div className="bg-rose-50/70 dark:bg-rose-900/30 border border-rose-220 dark:border-rose-700/60 p-4 rounded-xl space-y-2 flex flex-col justify-between shadow-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-700 dark:text-rose-300 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1 text-xs">
                <span className="text-[10px] font-bold text-rose-800 dark:text-rose-200 uppercase block tracking-wider">Trésorerie d'Église Vulnérable</span>
                <p className="text-rose-950 dark:text-rose-100">
                  Le solde global disponible sur vos comptes paroissiaux est critique ({Math.round(financials.balance).toLocaleString('fr-FR')} FCFA). Le seuil recommandé de secours de 300 000 FCFA n'est plus couvert.
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => onNavigate('finances')}
              className="text-xs font-semibold text-rose-900 dark:text-rose-100 bg-rose-100/80 dark:bg-rose-800/50 hover:bg-rose-150 dark:hover:bg-rose-700/50 p-2 rounded-lg flex items-center justify-between transition-all pt-2 mt-2 cursor-pointer"
            >
              <span>Vérifier le livre d'offrandes / dîmes</span>
              <ChevronRight className="w-4 h-4 text-rose-700 dark:text-rose-300" />
            </button>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 p-4 rounded-xl flex items-start gap-2 text-slate-700 dark:text-slate-300 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase block tracking-wider">Comptes paroissiaux sains</span>
              <p>Le solde de trésorerie disponible de {Math.round(financials.balance).toLocaleString('fr-FR')} FCFA couvre largement les prévisions budgétaires normales d'église.</p>
            </div>
          </div>
        )}
      </div>

      {/* Main dashboard body with list overviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Recent Events List */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200/90 dark:border-slate-600 space-y-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">Dernières célébrations et cultes</h3>
            <button onClick={() => onNavigate('cultes')} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline text-[11px] font-semibold cursor-pointer">Voir tout ({events.length})</button>
          </div>
          
          <div className="space-y-3">
            {events.slice(0, 3).map(evt => (
              <div key={evt.id} className="flex justify-between items-center text-xs p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-all">
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block text-xs">{evt.title}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Date: {evt.date} • Prédicateur : {evt.preacher || "—"}</span>
                </div>
                <span className="font-mono bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 font-semibold px-2 py-0.5 rounded text-xs">{evt.attendance} présents</span>
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-center py-6 text-slate-450 dark:text-slate-400 text-xs italic">Aucune célébration au dossier.</p>
            )}
          </div>
        </div>

        {/* Recent Financial movements */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200/90 dark:border-slate-600 space-y-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">Écritures comptables récentes</h3>
            <button onClick={() => onNavigate('finances')} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline text-[11px] font-semibold cursor-pointer font-sans">Voir tout ({transactions.length})</button>
          </div>
          
          <div className="space-y-3">
            {transactions.slice(0, 4).map(t => (
              <div key={t.id} className="flex justify-between items-center text-xs p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-all">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">{t.category}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Date: {t.date} {t.contributor && ` • Par: ${t.contributor}`}</span>
                </div>
                <span className={`font-mono font-bold text-xs ${t.type === 'Revenu' ? 'text-emerald-750 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {t.type === 'Revenu' ? '+' : '-'}{Math.round(t.amount).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            ))}
            {transactions.length === 0 && (
              <p className="text-center py-6 text-slate-450 dark:text-slate-400 text-xs italic">Aucune écriture financière.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
