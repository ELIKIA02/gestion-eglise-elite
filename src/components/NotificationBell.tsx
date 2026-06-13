import React, { useState, useRef, useEffect } from 'react';
import { Bell, BellRing, Gift, Calendar, DollarSign, Users, CheckCheck, X } from 'lucide-react';
import { AppNotification } from '../types';

interface NotificationBellProps {
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  theme: 'light' | 'dark';
}

const typeIconMap: Record<string, React.ReactNode> = {
  birthday: <Gift className="w-4 h-4" />,
  event: <Calendar className="w-4 h-4" />,
  finance: <DollarSign className="w-4 h-4" />,
  attendance: <Users className="w-4 h-4" />,
  system: <Bell className="w-4 h-4" />,
};

const typeColors: Record<string, string> = {
  birthday: 'text-pink-500',
  event: 'text-blue-500',
  finance: 'text-amber-500',
  attendance: 'text-emerald-500',
  system: 'text-slate-500',
};

export default function NotificationBell({ notifications, onMarkRead, onMarkAllRead, theme }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative flex items-center justify-center">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-10 h-10 rounded-xl hover:bg-slate-700/50 transition-colors cursor-pointer touch-manipulation"
        title="Notifications"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5 text-indigo-400" />
        ) : (
          <Bell className="w-5 h-5 text-slate-400" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && !isMobile && (
        <div className="fixed left-72 top-16 w-96 max-w-[calc(100vw-300px)] rounded-xl shadow-xl border z-[100]"
          style={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', borderColor: theme === 'dark' ? '#334155' : '#e2e8f0' }}>
          <div className={`flex items-center justify-between px-4 py-3 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
            <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </span>
            {unreadCount > 0 && (
              <button onClick={onMarkAllRead}
                className="flex items-center gap-1 text-[10px] font-semibold text-indigo-500 hover:text-indigo-400 cursor-pointer">
                <CheckCheck className="w-3 h-3" /> Tout lu
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className={`text-center py-8 text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Aucune notification</div>
            ) : (
              notifications.map(n => (
                <button key={n.id} onClick={() => { onMarkRead(n.id); }}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer border-b ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-700/50' : 'border-slate-100 hover:bg-slate-50'} ${!n.read ? (theme === 'dark' ? 'bg-slate-700/30' : 'bg-indigo-50/40') : ''}`}>
                  <span className={`mt-0.5 ${typeColors[n.type] || typeColors.system}`}>{typeIconMap[n.type] || typeIconMap.system}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] leading-tight ${!n.read ? 'font-bold' : ''} ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{n.title}</p>
                    <p className={`text-[10px] mt-0.5 break-words ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{n.message}</p>
                    <p className="text-[9px] mt-1 text-slate-400">{n.date}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {isOpen && isMobile && (
        <div className="fixed inset-0 z-[200] flex flex-col">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
          <div className={`relative mt-auto max-h-[85vh] rounded-t-2xl shadow-2xl overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <span className={`text-base font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                Notifications {unreadCount > 0 && `(${unreadCount})`}
              </span>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button onClick={onMarkAllRead}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:text-indigo-400 cursor-pointer">
                    <CheckCheck className="w-4 h-4" /> Tout lu
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="p-2 rounded-xl hover:bg-slate-700/50 cursor-pointer" aria-label="Fermer">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[calc(85vh-64px)]">
              {notifications.length === 0 ? (
                <div className={`text-center py-10 text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Aucune notification</div>
              ) : (
                notifications.map(n => (
                  <button key={n.id} onClick={() => { onMarkRead(n.id); }}
                    className={`w-full text-left px-5 py-4 flex items-start gap-3 transition-colors cursor-pointer border-b ${theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-700/50' : 'border-slate-100 hover:bg-slate-50'} ${!n.read ? (theme === 'dark' ? 'bg-slate-700/30' : 'bg-indigo-50/40') : ''}`}>
                    <span className={`mt-0.5 shrink-0 ${typeColors[n.type] || typeColors.system}`}>{typeIconMap[n.type] || typeIconMap.system}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight ${!n.read ? 'font-bold' : ''} ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{n.title}</p>
                      <p className={`text-xs mt-1 break-words leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{n.message}</p>
                      <p className="text-[10px] mt-1.5 text-slate-400">{n.date}</p>
                    </div>
                    {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
