import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, onSnapshot, query, db, loadFromServer } from './firebase';
import { Member, FinanceTransaction, ChurchEvent, CommunicationLog, ChurchSettings, Department, AppNotification, AppUser, LiturgicalTheme } from './types';

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
import EnseignementModule from './components/EnseignementModule';
import DocumentsModule from './components/DocumentsModule';
import UsersModule from './components/UsersModule';
import LiturgicalThemesModule from './components/LiturgicalThemesModule';
import NotificationBell from './components/NotificationBell';
import OnlineStatus from './components/OnlineStatus';

import { LayoutDashboard, Users, CreditCard, CalendarDays, MessageSquareText, Sparkles, FileBarChart2, MoreHorizontal, Settings, ClipboardCheck, Building2, BookOpen, FileText, Shield, Bookmark } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [presetTarget, setPresetTarget] = useState<string | undefined>();
  const [presetMessageText, setPresetMessageText] = useState<string | undefined>();

  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [comms, setComms] = useState<CommunicationLog[]>([]);
  const [settings, setSettings] = useState<ChurchSettings | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingFinances, setLoadingFinances] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingComms, setLoadingComms] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(true);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const handleNavigate = (tab: string, text?: string) => {
    if (text) setPresetMessageText(text);
    setActiveTab(tab);
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
          appName: "ELIKIA EKLESIA",
          appLogo: "⛪",
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

  // Dark mode
  useEffect(() => {
    if (settings?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings?.theme]);

  // Mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close more menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const theme = settings?.theme || 'light';

  const notifications = useMemo<AppNotification[]>(() => {
    const list: AppNotification[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const reminderDays = settings?.notifications?.reminderDays ?? 3;
    const enableBirthday = settings?.notifications?.birthdayReminder !== false;
    const enableEvent = settings?.notifications?.eventReminder !== false;
    const enableFinance = settings?.notifications?.lowBalanceAlert !== false;
    const enableAttendance = settings?.notifications?.attendanceAlert !== false;

    if (enableBirthday) {
      members.forEach(m => {
        if (m.birthday && m.id) {
          const bd = new Date(m.birthday);
          const thisYearBD = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
          if (thisYearBD < today) thisYearBD.setFullYear(thisYearBD.getFullYear() + 1);
          const diff = Math.ceil((thisYearBD.getTime() - today.getTime()) / 86400000);
          if (diff >= 0 && diff <= reminderDays) {
            const id = `birthday-${m.id}`;
            list.push({
              id, type: 'birthday',
              title: 'Anniversaire',
              message: `${m.name} — ${diff === 0 ? "Aujourd'hui" : `Dans ${diff} jour${diff > 1 ? 's' : ''}`}`,
              date: thisYearBD.toISOString().split('T')[0],
              read: readNotificationIds.includes(id),
              createdAt: new Date().toISOString(),
            });
          }
        }
      });
    }

    if (enableEvent) {
      events.forEach(e => {
        if (e.id && e.date) {
          const eventDate = new Date(e.date + 'T00:00:00');
          const diff = Math.ceil((eventDate.getTime() - today.getTime()) / 86400000);
          if (diff >= 0 && diff <= reminderDays) {
            const id = `event-${e.id}`;
            list.push({
              id, type: 'event',
              title: 'Événement à venir',
              message: `${e.title} — ${diff === 0 ? "Aujourd'hui" : `Dans ${diff} jour${diff > 1 ? 's' : ''}`}`,
              date: e.date,
              read: readNotificationIds.includes(id),
              createdAt: new Date().toISOString(),
            });
          }
        }
      });
    }

    if (enableFinance) {
      const balance = transactions.reduce((sum, t) =>
        t.type === 'Revenu' ? sum + t.amount : sum - t.amount, 0
      );
      if (balance < 150000) {
        const id = 'low-balance';
        list.push({
          id, type: 'finance',
          title: 'Solde faible',
          message: `Solde actuel: ${balance.toLocaleString()} FCFA`,
          date: today.toISOString().split('T')[0],
          read: readNotificationIds.includes(id),
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (enableAttendance) {
      const sorted = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (sorted.length >= 4) {
        const recent = sorted.slice(0, 3);
        const previous = sorted.slice(3, 6);
        const recentAvg = recent.reduce((s, e) => s + e.attendance, 0) / recent.length;
        const prevAvg = previous.reduce((s, e) => s + e.attendance, 0) / previous.length;
        if (prevAvg > 0 && recentAvg < prevAvg * 0.8) {
          const id = 'attendance-decline';
          list.push({
            id, type: 'attendance',
            title: 'Baisse d\'assistance',
            message: `Moyenne récente: ${Math.round(recentAvg)} vs ${Math.round(prevAvg)}`,
            date: today.toISOString().split('T')[0],
            read: readNotificationIds.includes(id),
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [members, events, transactions, settings, readNotificationIds]);

  const markNotificationRead = (id: string) => {
    setReadNotificationIds(prev => prev.includes(id) ? prev : [...prev, id]);
  };

  const markAllNotificationsRead = () => {
    setReadNotificationIds(prev => {
      const allIds = notifications.map(n => n.id);
      const merged = new Set([...prev, ...allIds]);
      return Array.from(merged);
    });
  };

  const handleNavigation = (tabName: string) => {
    setActiveTab(tabName);
    setPresetTarget(undefined);
  };

  const handleClearData = () => {
    if (window.confirm('Vider toutes les données locales ? Cette action est irréversible.')) {
      localStorage.removeItem('church_db_data');
      localStorage.removeItem('church_enseignements');
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
    { id: 'enseignement', label: 'Enseignement', icon: BookOpen },
    { id: 'liturgical', label: 'Thèmes Liturgiques', icon: Bookmark },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'users', label: 'Utilisateurs', icon: Shield },
    { id: 'audit', label: 'Audit Église', icon: ClipboardCheck },
    { id: 'reports', label: 'Rapports & Exports', icon: FileBarChart2 },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  const MAIN_TABS = [
    { id: 'dashboard', label: '', icon: LayoutDashboard },
    { id: 'members', label: 'Membres', icon: Users },
    { id: 'finances', label: 'Finances', icon: CreditCard },
    { id: 'cultes', label: 'Cultes', icon: CalendarDays },
  ];
  const MORE_TABS = NAV_LINKS.filter(l => !['dashboard', 'members', 'finances', 'cultes'].includes(l.id));

  return (
    <div className={`min-h-screen flex flex-col md:flex-row font-sans transition-colors duration-300 ${
      theme === 'dark' ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      <style>{`
        @media (max-width: 767px) {
          button, a, select, input[type="button"], input[type="submit"] {
            touch-action: manipulation;
          }
          input, select, textarea {
            font-size: 16px !important;
          }
        }
      `}</style>

      {/* Mobile top bar */}
      {isMobile && (
        <div className="flex items-center justify-between bg-[#0F172A] px-4 py-3 sticky top-0 z-40 border-b border-slate-800 min-h-[52px]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {settings?.appLogo?.startsWith('data:image') ? (
              <img src={settings.appLogo} alt="Logo" className="w-7 h-7 rounded-md object-contain bg-white border border-slate-600 shrink-0" />
            ) : (
              <span className="w-7 h-7 rounded-md bg-indigo-600 text-indigo-100 font-semibold flex items-center justify-center border border-indigo-500 text-sm shadow-xs shrink-0">
                {settings?.appLogo || "⛪"}
              </span>
            )}
            <span className="font-bold text-xs text-slate-100 truncate">{settings?.appName || "Ma Paroisse"}</span>
          </div>
          <NotificationBell
            notifications={notifications}
            onMarkRead={markNotificationRead}
            onMarkAllRead={markAllNotificationsRead}
            theme={theme}
          />
        </div>
      )}

      {/* Sidebar (desktop only) */}
      <aside className="hidden md:flex md:w-64 bg-[#0F172A] border-r border-slate-800 shrink-0 md:sticky md:top-0 md:h-screen flex flex-col justify-between pt-safe md:pt-0">
        <div className="p-5 space-y-6">
          <div className="flex justify-between items-center bg-slate-800/40 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2">
                {settings?.appLogo?.startsWith('data:image') ? (
                  <img src={settings.appLogo} alt="Logo" className="w-7 h-7 rounded-md object-contain bg-white border border-slate-600" />
                ) : (
                  <span className="w-7 h-7 rounded-md bg-indigo-600 text-indigo-100 font-semibold flex items-center justify-center border border-indigo-500 text-sm shadow-xs">
                    {settings?.appLogo || "⛪"}
                  </span>
                )}
              <div className="min-w-0">
                <span className="font-bold text-xs text-slate-100 block truncate">{settings?.appName || "Ma Paroisse"}</span>
                <span className="text-[9px] uppercase tracking-wider block font-bold text-indigo-400">Application Locale</span>
              </div>
            </div>
            <NotificationBell
              notifications={notifications}
              onMarkRead={markNotificationRead}
              onMarkAllRead={markAllNotificationsRead}
              theme={theme}
            />
          </div>

          <OnlineStatus theme={theme} />

          <nav className="flex-col gap-1 flex">
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

      </aside>

      {/* Main */}
      <main className={`flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full space-y-6 ${isMobile ? 'pb-20' : ''}`}>
        <div className={`p-6 md:p-8 rounded-xl border min-h-[500px] transition-colors duration-300 ${
          theme === 'dark' ? 'bg-slate-800 border-slate-700 shadow-md' : 'bg-white border-slate-200 shadow-md shadow-slate-100/40'
        }`}>
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
              onRefresh={() => {}} onMessage={(deptName) => { setPresetTarget(deptName); setActiveTab('comms'); }} />
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
          {activeTab === 'enseignement' && (
            <EnseignementModule settings={settings} members={members} departments={departments} />
          )}
          {activeTab === 'liturgical' && (
            <LiturgicalThemesModule settings={settings} members={members} />
          )}
          {activeTab === 'documents' && (
            <DocumentsModule settings={settings} members={members} />
          )}
          {activeTab === 'users' && (
            <UsersModule />
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

        <footer className={`text-center text-[10px] font-medium py-3 border-t transition-colors duration-300 ${
          theme === 'dark' ? 'text-slate-500 border-slate-700' : 'text-slate-400 border-slate-200/60'
        }`}>
          © {new Date().getFullYear()} {settings?.appName || "ELIKIA EKLESIA"} • Données stockées localement.
        </footer>
      </main>

      {/* Mobile bottom tab bar */}
      {isMobile && (
        <>
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0F172A] border-t border-slate-800 flex items-center justify-around px-1 pb-safe">
            {MAIN_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setShowMoreMenu(false); }}
                  className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg min-w-[48px] min-h-[44px] transition-all ${
                    isActive ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : ''}`} />
                  {tab.label && <span className="text-[9px] font-semibold mt-0.5">{tab.label}</span>}
                </button>
              );
            })}

            {/* Notifications */}
            <NotificationBell
              notifications={notifications}
              onMarkRead={markNotificationRead}
              onMarkAllRead={markAllNotificationsRead}
              theme={theme}
            />

            {/* Plus button */}
            <div className="relative" ref={moreMenuRef}>
              <button onClick={() => setShowMoreMenu(!showMoreMenu)}
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg min-w-[48px] min-h-[44px] transition-all ${
                  showMoreMenu ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                }`}
                style={{ touchAction: 'manipulation' }}
              >
                <MoreHorizontal className="w-5 h-5" />
                <span className="text-[9px] font-semibold mt-0.5">Plus</span>
              </button>

              {showMoreMenu && (
                <div className="absolute bottom-full mb-2 right-0 bg-[#0F172A] border border-slate-800 rounded-xl p-2 shadow-2xl min-w-[200px]">
                  {MORE_TABS.map(link => {
                    const Icon = link.icon;
                    const a = activeTab === link.id;
                    return (
                      <button key={link.id}
                        onClick={() => { setActiveTab(link.id); setShowMoreMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all min-h-[44px] ${
                          a ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                        style={{ touchAction: 'manipulation' }}
                      >
                        <Icon className={`w-4 h-4 ${a ? 'text-indigo-200' : 'text-slate-400'}`} />
                        <span>{link.label}</span>
                        {link.count !== undefined && (
                          <span className="ml-auto text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-slate-800 text-slate-400">
                            {link.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Overlay */}
          {showMoreMenu && (
            <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowMoreMenu(false)} />
          )}
        </>
      )}
    </div>
  );
}
