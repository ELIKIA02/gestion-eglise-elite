import React, { useState, useRef, useEffect } from 'react';
import { Bell, BellRing, Gift, Calendar, DollarSign, Users, CheckCheck } from 'lucide-react';
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
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.read).length;

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
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer"
        title="Notifications"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-4 h-4 text-indigo-400" />
        ) : (
          <Bell className="w-4 h-4 text-slate-400" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={`absolute right-0 mt-2 w-80 rounded-xl shadow-xl border z-50 ${
          theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          <div className={`flex items-center justify-between px-4 py-3 border-b ${
            theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
          }`}>
            <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="flex items-center gap-1 text-[10px] font-semibold text-indigo-500 hover:text-indigo-400 cursor-pointer"
              >
                <CheckCheck className="w-3 h-3" />
                Tout lu
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className={`text-center py-8 text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Aucune notification
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => { onMarkRead(n.id); }}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer border-b ${
                    theme === 'dark' ? 'border-slate-700/50 hover:bg-slate-700/50' : 'border-slate-100 hover:bg-slate-50'
                  } ${!n.read ? (theme === 'dark' ? 'bg-slate-700/30' : 'bg-indigo-50/40') : ''}`}
                >
                  <span className={`mt-0.5 ${typeColors[n.type] || typeColors.system}`}>
                    {typeIconMap[n.type] || typeIconMap.system}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] leading-tight ${!n.read ? 'font-bold' : ''} ${
                      theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
                    }`}>
                      {n.title}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      {n.message}
                    </p>
                    <p className="text-[9px] mt-1 text-slate-400">{n.date}</p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
