import React, { useState, useMemo } from 'react';
import { collection, addDoc, db } from '../firebase';
import { Member, ChurchSettings } from '../types';
import { Gift, Send, Calendar } from 'lucide-react';

interface AnniversariesModuleProps {
  members: Member[];
  settings: ChurchSettings | null;
}

export default function AnniversariesModule({ members, settings }: AnniversariesModuleProps) {
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingTarget, setSendingTarget] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const churchName = settings?.appName || 'Notre Église';

  const defaultMessage = `🎂 *Joyeux Anniversaire !* 🎂\n\nQue le Seigneur vous bénisse abondamment en ce jour spécial, {name} !\n\n*${churchName}* 🙏`;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  const birthdayMembers = useMemo(() => {
    return members.filter(m => {
      if (!m.birthday) return false;
      const parts = m.birthday.split('-');
      if (parts.length < 2) return false;
      const month = parseInt(parts[1], 10) - 1;
      return month === currentMonth;
    });
  }, [members, currentMonth]);

  const upcoming = useMemo(() => {
    return birthdayMembers
      .filter(m => {
        const day = parseInt(m.birthday!.split('-')[2], 10);
        return day >= currentDay;
      })
      .sort((a, b) => parseInt(a.birthday!.split('-')[2], 10) - parseInt(b.birthday!.split('-')[2], 10));
  }, [birthdayMembers, currentDay]);

  const past = useMemo(() => {
    return birthdayMembers
      .filter(m => {
        const day = parseInt(m.birthday!.split('-')[2], 10);
        return day < currentDay;
      })
      .sort((a, b) => parseInt(a.birthday!.split('-')[2], 10) - parseInt(b.birthday!.split('-')[2], 10));
  }, [birthdayMembers, currentDay]);

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}`;
  };

  const getMessageFor = (name: string) => {
    return (customMessage || defaultMessage).replace(/{name}/g, name);
  };

  const sendToRecipients = async (recipients: { phone: string; name: string }[], label: string) => {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/whatsapp/send-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
          text: customMessage || defaultMessage
        })
      });
      const data = await res.json();
      if (data.success) {
        setResult(`✅ Vœux envoyés à ${data.success}/${data.total} membre(s)`);
        await addDoc(collection(db, 'church_communications'), {
          type: 'WhatsApp',
          title: `Anniversaire - ${label}`,
          template: customMessage || defaultMessage,
          sentToGroup: 'Anniversaires',
          sentAt: new Date().toISOString(),
          recipientCount: recipients.length,
          status: data.failed > 0 ? 'Partiel' : 'Envoyé'
        });
      } else {
        setResult(`❌ Erreur: ${data.error}`);
      }
    } catch (err: any) {
      setResult(`❌ Erreur: ${err.message}`);
    }
    setSending(false);
  };

  const handleSendSingle = async (member: Member) => {
    if (!member.phone) return;
    if (!window.confirm(`Envoyer un message d'anniversaire à ${member.name} ?`)) return;
    setSendingTarget(member.id || null);
    setSending(true);
    setResult(null);
    try {
      const text = getMessageFor(member.name);
      const res = await fetch('/api/whatsapp/send-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: [{ phone: member.phone, name: member.name }],
          text
        })
      });
      const data = await res.json();
      if (data.success) {
        setResult(`✅ Vœux envoyés à ${member.name}`);
        await addDoc(collection(db, 'church_communications'), {
          type: 'WhatsApp',
          title: `Anniversaire - ${member.name}`,
          template: text,
          sentToGroup: member.name,
          sentAt: new Date().toISOString(),
          recipientCount: 1,
          status: 'Envoyé'
        });
      } else {
        setResult(`❌ Erreur: ${data.error}`);
      }
    } catch (err: any) {
      setResult(`❌ Erreur: ${err.message}`);
    }
    setSending(false);
    setSendingTarget(null);
  };

  const handleSendBulk = () => {
    const targets = [...upcoming, ...past].filter(m => m.phone);
    if (targets.length === 0) {
      alert('Aucun membre avec numéro de téléphone ce mois-ci.');
      return;
    }
    if (!window.confirm(`Envoyer les vœux d'anniversaire à ${targets.length} membre(s) ?`)) return;
    sendToRecipients(
      targets.map(m => ({ phone: m.phone!, name: m.name })),
      `Mois ${currentMonth + 1}`
    );
  };

  const allWithPhone = [...upcoming, ...past].filter(m => m.phone);

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl text-slate-800 font-bold tracking-tight">Anniversaires du Mois</h2>
          <p className="text-xs text-slate-500">Souhaitez un joyeux anniversaire aux membres de {churchName}.</p>
        </div>
      </div>

      {result && (
        <div className={`p-3 rounded-xl text-xs ${result.includes('✅') ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : 'bg-red-50 border border-red-200 text-red-900'}`}>
          {result}
        </div>
      )}

      {/* Message customization */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-pink-600" />
          <h3 className="font-semibold text-sm text-slate-800">Personnaliser le message</h3>
        </div>
        <textarea
          value={customMessage}
          onChange={e => setCustomMessage(e.target.value)}
          rows={4}
          placeholder={defaultMessage}
          className="w-full text-xs p-2 border border-slate-200 rounded-md focus:outline-pink-600"
        />
        <p className="text-[10px] text-slate-400">Utilisez {'{name}'} pour le prénom du membre.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="w-3.5 h-3.5 text-pink-600" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">À venir</span>
          </div>
          <span className="text-lg font-bold text-slate-800">{upcoming.length}</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Passés</span>
          </div>
          <span className="text-lg font-bold text-slate-800">{past.length}</span>
        </div>
      </div>

      {/* Bulk send */}
      {allWithPhone.length > 0 && (
        <button
          onClick={handleSendBulk}
          disabled={sending}
          className="w-full flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          {sending && !sendingTarget ? 'Envoi en cours...' : `Envoyer à tous (${allWithPhone.length})`}
        </button>
      )}

      {/* Upcoming birthdays */}
      {upcoming.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-pink-50 px-5 py-3 border-b border-pink-100 flex items-center gap-2">
            <Gift className="w-4 h-4 text-pink-600" />
            <h3 className="font-bold text-sm text-slate-800">Anniversaires à venir</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {upcoming.map(m => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3 text-xs">
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-slate-800 block">{m.name}</span>
                  <span className="text-[10px] text-slate-400">{formatDate(m.birthday!)} • {m.phone || 'Sans téléphone'}</span>
                </div>
                {m.phone && (
                  <button
                    onClick={() => handleSendSingle(m)}
                    disabled={sending && sendingTarget === m.id}
                    className="flex items-center gap-1 bg-pink-600 hover:bg-pink-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 ml-2 disabled:opacity-60 cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    Souhaiter
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past birthdays */}
      {past.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-600" />
            <h3 className="font-bold text-sm text-slate-800">Anniversaires passés</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {past.map(m => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3 text-xs">
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-slate-800 block">{m.name}</span>
                  <span className="text-[10px] text-slate-400">{formatDate(m.birthday!)} • {m.phone || 'Sans téléphone'}</span>
                </div>
                {m.phone && (
                  <button
                    onClick={() => handleSendSingle(m)}
                    disabled={sending && sendingTarget === m.id}
                    className="flex items-center gap-1 bg-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 ml-2 disabled:opacity-60 cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    Souhaiter
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {upcoming.length === 0 && past.length === 0 && (
        <div className="bg-white text-center py-12 rounded-xl border border-slate-200 text-slate-400 text-xs">
          Aucun anniversaire ce mois-ci.
        </div>
      )}
    </div>
  );
}
