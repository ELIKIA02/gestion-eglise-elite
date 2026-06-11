import React, { useState, useMemo } from 'react';
import { collection, addDoc, db, handleFirestoreError, OperationType } from '../firebase';
import { Member, FinanceTransaction, ChurchEvent, CommunicationLog } from '../types';
import type { ChurchSettings } from '../types';
import { Users, DollarSign, Calendar, Sparkles, Send, AlertTriangle, ShieldCheck, HeartCrack, ChevronRight } from 'lucide-react';

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
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-slate-100 p-6 rounded-xl gap-4 shadow-md border border-slate-800">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-300">{settings?.appName || "Tableau de Bord"}</span>
        </div>
        {members.length === 0 && (
          <button
            onClick={handleSeedDemodatabase}
            disabled={seeding}
            className="flex items-center gap-1.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition-with-duration cursor-pointer shadow-md shrink-0 border border-indigo-500"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
            {seeding ? "Création des données..." : "Alimenter la démo (Simulation)"}
          </button>
        )}
      </div>

      {/* KPI statistics cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Registre Fidèles</span>
            <span className="text-lg font-bold text-slate-850">{members.length} membres</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Soldes des comptes</span>
            <span className={`text-lg font-bold ${financials.balance >= 0 ? "text-emerald-750" : "text-rose-700"}`}>
              {Math.round(financials.balance).toLocaleString('fr-FR')} FCFA
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100">
            <Calendar className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Cultes Célébrés</span>
            <span className="text-lg font-bold text-slate-850">{events.length} cultes</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-full bg-sky-50 flex items-center justify-center border border-sky-100">
            <Send className="w-4 h-4 text-sky-600" />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Campagnes Envois</span>
            <span className="text-lg font-bold text-slate-850">{comms.length} envoyés</span>
          </div>
        </div>
      </div>

      {/* Realtime Anomalies Advisory & Alarm system */}
      <div id="general-alarms" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Attendance anomaly alarm */}
        {attendanceDecline ? (
          <div className="bg-amber-50/70 border border-amber-200/80 p-4 rounded-xl space-y-2 flex flex-col justify-between shadow-xs">
            <div className="flex items-start gap-2">
              <HeartCrack className="w-5 h-5 text-amber-700 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-amber-800 uppercase block tracking-wider">Chute d'affluence dominicale</span>
                <p className="text-xs text-amber-950">
                  Le dernier culte <strong>"{attendanceDecline.title}"</strong> a enregistré seulement {attendanceDecline.latest} fidèles, soit une diminution significative de <strong className="text-red-700 text-sm font-semibold">-{attendanceDecline.percent}%</strong> par rapport à votre moyenne habituelle de {attendanceDecline.avg} participants.
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => onNavigate('ia')} 
              className="text-xs font-semibold text-amber-900 bg-amber-100/80 hover:bg-amber-150 p-2 rounded-lg flex items-center justify-between transition-all pt-2 mt-2 cursor-pointer"
            >
              <span>Consulter l'IA pour remédiation pastorale</span>
              <ChevronRight className="w-4 h-4 text-amber-700" />
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50/60 border border-emerald-150 p-4 rounded-xl flex items-start gap-2 text-emerald-950 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block tracking-wider">Affluence & Tendances Stables</span>
              <p>Tous les indicateurs d'assistance paroissiale sont au vert. La participation est stable et en progression.</p>
            </div>
          </div>
        )}

        {/* Treasury warning level */}
        {financials.balance < 150000 ? (
          <div className="bg-rose-50/70 border border-rose-220 p-4 rounded-xl space-y-2 flex flex-col justify-between shadow-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1 text-xs">
                <span className="text-[10px] font-bold text-rose-800 uppercase block tracking-wider">Trésorerie d'Église Vulnérable</span>
                <p className="text-rose-950">
                  Le solde global disponible sur vos comptes paroissiaux est critique ({Math.round(financials.balance).toLocaleString('fr-FR')} FCFA). Le seuil recommandé de secours de 300 000 FCFA n'est plus couvert.
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => onNavigate('finances')}
              className="text-xs font-semibold text-rose-900 bg-rose-100/80 hover:bg-rose-150 p-2 rounded-lg flex items-center justify-between transition-all pt-2 mt-2 cursor-pointer"
            >
              <span>Vérifier le livre d'offrandes / dîmes</span>
              <ChevronRight className="w-4 h-4 text-rose-700" />
            </button>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start gap-2 text-slate-700 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="text-[10px] font-semibold text-slate-500 uppercase block tracking-wider">Comptes paroissiaux sains</span>
              <p>Le solde de trésorerie disponible de {Math.round(financials.balance).toLocaleString('fr-FR')} FCFA couvre largement les prévisions budgétaires normales d'église.</p>
            </div>
          </div>
        )}
      </div>

      {/* Main dashboard body with list overviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Recent Events List */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 space-y-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="font-semibold text-sm text-slate-800">Dernières célébrations et cultes</h3>
            <button onClick={() => onNavigate('cultes')} className="text-indigo-600 hover:text-indigo-700 hover:underline text-[11px] font-semibold cursor-pointer">Voir tout ({events.length})</button>
          </div>
          
          <div className="space-y-3">
            {events.slice(0, 3).map(evt => (
              <div key={evt.id} className="flex justify-between items-center text-xs p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50/80 transition-all">
                <div>
                  <span className="font-bold text-slate-700 block text-xs">{evt.title}</span>
                  <span className="text-[10px] text-slate-400">Date: {evt.date} • Prédicateur : {evt.preacher || "—"}</span>
                </div>
                <span className="font-mono bg-slate-50 text-slate-700 font-semibold px-2 py-0.5 rounded text-xs">{evt.attendance} présents</span>
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-center py-6 text-slate-450 text-xs italic">Aucune célébration au dossier.</p>
            )}
          </div>
        </div>

        {/* Recent Financial movements */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 space-y-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="font-semibold text-sm text-slate-800">Écritures comptables récentes</h3>
            <button onClick={() => onNavigate('finances')} className="text-indigo-600 hover:text-indigo-700 hover:underline text-[11px] font-semibold cursor-pointer font-sans">Voir tout ({transactions.length})</button>
          </div>
          
          <div className="space-y-3">
            {transactions.slice(0, 4).map(t => (
              <div key={t.id} className="flex justify-between items-center text-xs p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50/80 transition-all">
                <div>
                  <span className="font-bold text-slate-800 block">{t.category}</span>
                  <span className="text-[10px] text-slate-400">Date: {t.date} {t.contributor && ` • Par: ${t.contributor}`}</span>
                </div>
                <span className={`font-mono font-bold text-xs ${t.type === 'Revenu' ? 'text-emerald-750' : 'text-slate-700'}`}>
                  {t.type === 'Revenu' ? '+' : '-'}{Math.round(t.amount).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            ))}
            {transactions.length === 0 && (
              <p className="text-center py-6 text-slate-450 text-xs italic">Aucune écriture financière.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
