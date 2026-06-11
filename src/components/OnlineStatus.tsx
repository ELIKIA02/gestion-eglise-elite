import React, { useState, useEffect } from 'react';
import { getOnlineStatus, getPendingSyncCount } from '../firebase';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export default function OnlineStatus({ theme }: { theme: string }) {
  const [online, setOnline] = useState(getOnlineStatus());
  const [pendingCount, setPendingCount] = useState(getPendingSyncCount());

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const interval = setInterval(() => setPendingCount(getPendingSyncCount()), 2000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
      online
        ? theme === 'dark' ? 'bg-green-900/40 text-green-400' : 'bg-green-50 text-green-700'
        : theme === 'dark' ? 'bg-red-900/40 text-red-400' : 'bg-red-50 text-red-700'
    }`}>
      {online
        ? <Wifi className="w-3 h-3 text-green-500" />
        : <WifiOff className="w-3 h-3 text-red-500" />
      }
      <span>{online ? 'Connecté' : 'Hors-ligne'}</span>
      {pendingCount > 0 && (
        <span className={`flex items-center gap-1 ml-auto text-[10px] ${
          theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
        }`}>
          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
          {pendingCount} en attente
        </span>
      )}
    </div>
  );
}
