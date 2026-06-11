import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, db, loadFromServer } from './firebase';
import { Member, FinanceTransaction, ChurchEvent, CommunicationLog, ChurchSettings, Department } from './types';

import ErrorBoundary from './components/ErrorBoundary';
import DashboardModule from './components/DashboardModule';
import MembersModule from './components/MembersModule';
import FinanceModule from './components/FinanceModule';
import EventsModule from './components/EventsModule';
import CommunicationsModule from './components/CommunicationsModule';
import PastoralAIModule from './components/PastoralAIModule';
import ChurchReportModule from './components/ChurchReportModule';
import DepartmentsModule from './components/DepartmentsModule';
import ReportsModule from './components/ReportsModule';
import SettingsModule from './components/SettingsModule';

import { LayoutDashboard, Users, CreditCard, CalendarDays, MessageSquareText, Sparkles, FileBarChart2, Menu, X, Settings, ClipboardCheck, Building2, Trash2 } from 'lucide-react';

export default function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [presetTarget, setPresetTarget] = useState<string | undefined>();
  const [presetMessageText, setPresetMessageText] = useState<string | undefined>();

  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [comms, setComms] = useState<CommunicationLog[]>([]);
  const [settings, setSettings] = useState<ChurchSettings | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingFinances, setLoadingFinances] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingComms, setLoadingComms] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(true);

  const handleNavigate = (tab: string, text?: string) => {
    if (text) setPresetMessageText(text);
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  // Real-time data sync via localStorage
  useEffect(() => {
    loadFromServer().catch(() => {});
    const qSettings = query(collection(db, 'church_settings'));
    const unsubSettings = onSnapshot(qSettings, (snapshot) => {
      let current: ChurchSettings | null = null;
      snapshot.forEach(doc => { current = { id: doc.id, ...doc.data() } as ChurchSettings; });
      if (!current) {
        setSettings({
          appName: "Gestion d'Église Élite",
          appLogo: "†",
          churchPhone: '',
          worshipTypes: "Prédication, École du dimanche, Jeûne, Séminaire, Culte régulier, Autre",
          worshipDays: "Dimanche, Mercredi",
          reportHeader: "ÉGLISE ÉVANGÉLIQUE DE LA GRÂCE\nSecrétariat Général et Trésorerie\nB.P. 2480 - Tel: +242 06 123 4567 • Brazzaville, Congo",
          updatedAt: new Date().toISOString()
        });
      } else { setSettings(current); }
      setLoadingSettings(false);
    }, () => setLoadingSettings(false));

    const unsubMembers = onSnapshot(query(collection(db, 'church_members')), (snapshot) => {
      const items: Member[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as Member));
      setMembers(items);
      setLoadingMembers(false);
    }, () => setLoadingMembers(false));

    const unsubFinances = onSnapshot(query(collection(db, 'church_finances')), (snapshot) => {
      const items: FinanceTransaction[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as FinanceTransaction));
      setTransactions(items);
      setLoadingFinances(false);
    }, () => setLoadingFinances(false));

    const unsubEvents = onSnapshot(query(collection(db, 'church_events')), (snapshot) => {
      const items: ChurchEvent[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as ChurchEvent));
      setEvents(items);
      setLoadingEvents(false);
    }, () => setLoadingEvents(false));

    const unsubComms = onSnapshot(query(collection(db, 'church_communications')), (snapshot) => {
      const items: CommunicationLog[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as CommunicationLog));
      setComms(items);
      setLoadingComms(false);
    }, () => setLoadingComms(false));

    const unsubDepts = onSnapshot(query(collection(db, 'church_departments')), (snapshot) => {
      const items: Department[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as Department));
      setDepartments(items);
      setLoadingDepartments(false);
    }, () => setLoadingDepartments(false));

    return () => { unsubSettings(); unsubMembers(); unsubFinances(); unsubEvents(); unsubComms(); unsubDepts(); };
  }, []);

  const handleNavigation = (tabName: string) => {
    setActiveTab(tabName);
    setPresetTarget(undefined);
    setIsMobileMenuOpen(false);
  };

  const handleClearData = () => {
    if (window.confirm('Vider toutes les données locales ? Cette action est irréversible.')) {
      localStorage.removeItem('church_db_data');
      window.location.reload();
    }
  };

  const NAV_LINKS = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
    { id: 'members', label: 'Membres', icon: Users, count: members.length },
    { id: 'departments', label: 'Départements', icon: Building2, count: departments.length },
    { id: 'finances', label: 'Trésorerie', icon: CreditCard },
    { id: 'cultes', label: 'Cultes & Activités', icon: CalendarDays },
    { id: 'comms', label: 'Communications', icon: MessageSquareText },
    { id: 'ia', label: 'Assistant IA', icon: Sparkles },
    { id: 'audit', label: 'Audit Église', icon: ClipboardCheck },
    { id: 'reports', label: 'Rapports & Exports', icon: FileBarChart2 },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#0F172A] border-r border-slate-800 shrink-0 md:sticky md:top-0 md:h-screen flex flex-col justify-between pt-safe md:pt-0">
        <div className="p-5 space-y-6">
          <div className="flex justify-between items-center bg-slate-800/40 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2">
                {settings?.appLogo?.startsWith('data:image') ? (
                  <img src={settings.appLogo} alt="Logo" className="w-7 h-7 rounded-md object-contain bg-white border border-slate-600" />
                ) : (
                  <span className="w-7 h-7 rounded-md bg-indigo-600 text-indigo-100 font-semibold flex items-center justify-center border border-indigo-500 text-sm shadow-xs">
                    {settings?.appLogo || "†"}
                  </span>
                )}
              <div className="min-w-0">
                <span className="font-bold text-xs text-slate-100 block truncate">{settings?.appName || "Ma Paroisse"}</span>
                <span className="text-[9px] uppercase tracking-wider block font-bold text-indigo-400">Application Locale</span>
              </div>
            </div>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden text-slate-400 hover:text-white">
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          <nav className={`flex-col gap-1 ${isMobileMenuOpen ? "flex" : "hidden md:flex"}`}>
            {NAV_LINKS.map(link => {
              const Icon = link.icon;
              return (
                <button key={link.id}
                  onClick={() => handleNavigation(link.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    activeTab === link.id ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800/85 hover:text-white'
                  }`}>
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${activeTab === link.id ? "text-indigo-200" : "text-slate-400"}`} />
                    <span>{link.label}</span>
                  </div>
                  {link.count !== undefined && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === link.id ? "bg-indigo-700 text-indigo-105" : "bg-slate-800 text-slate-400"}`}>
                      {link.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className={`p-4 border-t border-slate-800 ${isMobileMenuOpen ? "block" : "hidden md:block"}`}>
          <button onClick={handleClearData}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-white py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all border border-slate-700">
            <Trash2 className="w-3.5 h-3.5" />
            Vider les données
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6 pb-safe md:pb-6">
        <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-md shadow-slate-100/40 min-h-[500px]">
          <ErrorBoundary>
          {activeTab === 'dashboard' && (
            <DashboardModule members={members} transactions={transactions} events={events} comms={comms}
              settings={settings}               loading={loadingMembers || loadingFinances || loadingEvents || loadingComms || loadingSettings}
              onRefreshAll={() => {}} onNavigate={(tab) => setActiveTab(tab)} />
          )}
          {activeTab === 'members' && (
            <MembersModule members={members} departments={departments} loading={loadingMembers} onRefresh={() => {}} />
          )}
          {activeTab === 'departments' && (
            <DepartmentsModule departments={departments} members={members} loading={loadingDepartments}
              onRefresh={() => {}} onMessage={(deptName) => { setPresetTarget(deptName); setActiveTab('comms'); setIsMobileMenuOpen(false); }} />
          )}
          {activeTab === 'finances' && (
            <FinanceModule transactions={transactions} events={events} loading={loadingFinances} onRefresh={() => {}} />
          )}
          {activeTab === 'cultes' && (
            <EventsModule events={events} loading={loadingEvents} onRefresh={() => {}} settings={settings} />
          )}
          {activeTab === 'comms' && (
            <CommunicationsModule comms={comms} members={members} departments={departments}
              settings={settings} loading={loadingComms} onRefresh={() => {}} presetTarget={presetTarget} presetText={presetMessageText} onConsumePresetText={() => setPresetMessageText(undefined)} />
          )}
          {activeTab === 'ia' && (
            <PastoralAIModule settings={settings} members={members} transactions={transactions} events={events} onNavigate={handleNavigate} />
          )}
          {activeTab === 'audit' && (
            <ChurchReportModule settings={settings} members={members} transactions={transactions} events={events} />
          )}
          {activeTab === 'reports' && (
            <ReportsModule transactions={transactions} events={events} members={members} settings={settings} />
          )}
          {activeTab === 'settings' && (
            <SettingsModule settings={settings} loading={loadingSettings} onRefresh={() => {}} />
          )}
          </ErrorBoundary>
        </div>

        <footer className="text-center text-[10px] text-slate-400 font-medium py-3 border-t border-slate-200/60">
          © {new Date().getFullYear()} {settings?.appName || "Gestion d'Église Élite"} • Données stockées localement.
        </footer>
      </main>

    </div>
  );
}
