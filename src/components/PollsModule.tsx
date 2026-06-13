import React, { useState, useMemo, useEffect } from 'react';
import { Member, Poll, PollOption } from '../types';
import { Vote, Plus, Send, X, Trash2 } from 'lucide-react';

interface PollsModuleProps {
  members: Member[];
}

const STORAGE_KEY = 'church_polls';

function loadPolls(): Poll[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const polls: Poll[] = data ? JSON.parse(data) : [];
    return polls.map(p => ({
      ...p,
      options: p.options || [],
      recipients: p.recipients || [],
    }));
  } catch {
    return [];
  }
}

function savePolls(polls: Poll[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(polls));
}

function genId(): string {
  return (crypto.randomUUID && crypto.randomUUID()) || Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export default function PollsModule({ members }: PollsModuleProps) {
  const [polls, setPolls] = useState<Poll[]>(loadPolls);
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<PollOption[]>([
    { id: genId(), label: '', votes: 0 },
    { id: genId(), label: '', votes: 0 },
  ]);
  const [recipientMode, setRecipientMode] = useState<'group' | 'manual'>('group');
  const [targetGroup, setTargetGroup] = useState('Tous');
  const [manualPhones, setManualPhones] = useState('');
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => { savePolls(polls); }, [polls]);

  const ministries = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => { if (m.ministry) set.add(m.ministry); });
    return Array.from(set).sort();
  }, [members]);

  const recipients = useMemo(() => {
    return members.filter(m => {
      if (targetGroup === 'Tous') return true;
      if (targetGroup === 'Actif' && m.status === 'Actif') return true;
      if (targetGroup === 'Inactif' && m.status === 'Inactif') return true;
      if (ministries.includes(targetGroup) && m.ministry === targetGroup) return true;
      return false;
    });
  }, [members, targetGroup, ministries]);

  const handleAddOption = () => {
    setOptions([...options, { id: genId(), label: '', votes: 0 }]);
  };

  const handleRemoveOption = (id: string) => {
    if (options.length <= 2) return;
    setOptions(options.filter(o => o.id !== id));
  };

  const handleOptionChange = (id: string, label: string) => {
    setOptions(options.map(o => o.id === id ? { ...o, label } : o));
  };

  const handleSaveDraft = () => {
    if (!question.trim()) { alert('Veuillez entrer une question.'); return; }
    const validOptions = options.filter(o => o.label.trim());
    if (validOptions.length < 2) { alert('Ajoutez au moins 2 options.'); return; }

    const phoneList = recipientMode === 'group'
      ? recipients.map(m => m.phone).filter(Boolean) as string[]
      : manualPhones.split(/[\n,]+/).map(p => p.trim()).filter(Boolean);

    const newPoll: Poll = {
      id: genId(),
      question: question.trim(),
      options: validOptions,
      status: 'draft',
      recipients: phoneList,
      createdAt: new Date().toISOString(),
    };

    setPolls([newPoll, ...polls]);
    setQuestion('');
    setOptions([
      { id: genId(), label: '', votes: 0 },
      { id: genId(), label: '', votes: 0 },
    ]);
    setTargetGroup('Tous');
    setManualPhones('');
    setActiveTab('list');
  };

  const handleSendWhatsApp = async () => {
    if (!question.trim()) { alert('Veuillez entrer une question.'); return; }
    const validOptions = options.filter(o => o.label.trim());
    if (validOptions.length < 2) { alert('Ajoutez au moins 2 options.'); return; }

    const phoneList = recipientMode === 'group'
      ? recipients.map(m => ({ name: m.name, phone: m.phone })).filter(m => m.phone)
      : manualPhones.split(/[\n,]+/).map(p => ({ name: p.trim(), phone: p.trim() })).filter(p => p.phone);

    if (phoneList.length === 0) { alert('Aucun destinataire.'); return; }

    const optionsText = validOptions.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
    const message = `📊 *SONDAGE*\n\n${question.trim()}\n\n${optionsText}\n\nRépondez avec le numéro de votre choix.`;

    setSending(true);
    try {
      const res = await fetch('/api/whatsapp/send-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: phoneList, text: message }),
      });
      const data = await res.json();
      if (data.success) {
        const newPoll: Poll = {
          id: genId(),
          question: question.trim(),
          options: validOptions,
          status: 'sent',
          recipients: phoneList.map(p => p.phone),
          createdAt: new Date().toISOString(),
          sentAt: new Date().toISOString(),
        };
        setPolls([newPoll, ...polls]);
        setQuestion('');
        setOptions([
          { id: genId(), label: '', votes: 0 },
          { id: genId(), label: '', votes: 0 },
        ]);
        setTargetGroup('Tous');
        setManualPhones('');
        setActiveTab('list');
        alert(`✅ Sondage envoyé à ${data.success || phoneList.length} destinataire(s).`);
      } else {
        alert(`❌ ${data.error || 'Erreur lors de l\'envoi'}`);
      }
    } catch (err: any) {
      alert(`❌ Erreur: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleClosePoll = (id: string) => {
    setPolls(polls.map(p => p.id === id ? { ...p, status: 'closed' } : p));
    if (selectedPoll?.id === id) setSelectedPoll({ ...selectedPoll, status: 'closed' });
  };

  const handleDeletePoll = (id: string) => {
    if (!window.confirm('Supprimer ce sondage définitivement ?')) return;
    setPolls(polls.filter(p => p.id !== id));
    if (selectedPoll?.id === id) setSelectedPoll(null);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">Brouillon</span>;
      case 'sent': return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">Envoyé</span>;
      case 'closed': return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700">Clôturé</span>;
      default: return null;
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('fr');
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl text-slate-800 font-bold tracking-tight">Sondages WhatsApp</h2>
          <p className="text-xs text-slate-500 font-light">Créez et envoyez des sondages par WhatsApp.</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200 text-sm font-medium">
        <button onClick={() => setActiveTab('create')}
          className={`pb-2 px-1 cursor-pointer ${activeTab === 'create' ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold' : 'text-slate-400 hover:text-slate-600'}`}>
          <Vote className="w-4 h-4 inline mr-1.5" />Nouveau sondage
        </button>
        <button onClick={() => setActiveTab('list')}
          className={`pb-2 px-1 cursor-pointer ${activeTab === 'list' ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold' : 'text-slate-400 hover:text-slate-600'}`}>
          Mes sondages ({polls.length})
        </button>
      </div>

      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">Créer un sondage</h3>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 block">Question *</label>
              <input type="text" value={question} onChange={e => setQuestion(e.target.value)}
                placeholder="Ex: Quel jour préférez-vous pour le culte ?"
                className="w-full text-xs p-2 border border-slate-200 rounded-md focus:outline-indigo-600" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 block">Options *</label>
              {options.map((opt, i) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono w-5 text-right">{i + 1}.</span>
                  <input type="text" value={opt.label} onChange={e => handleOptionChange(opt.id, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 text-xs p-2 border border-slate-200 rounded-md focus:outline-indigo-600" />
                  {options.length > 2 && (
                    <button type="button" onClick={() => handleRemoveOption(opt.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer" aria-label="Fermer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={handleAddOption}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold pt-1 cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Ajouter une option
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 block">Destinataires</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setRecipientMode('group')}
                  className={`flex-1 text-xs py-1.5 px-3 border rounded-md font-semibold ${recipientMode === 'group' ? 'bg-indigo-50 text-indigo-800 border-indigo-300' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}>
                  Par groupe/ministère
                </button>
                <button type="button" onClick={() => setRecipientMode('manual')}
                  className={`flex-1 text-xs py-1.5 px-3 border rounded-md font-semibold ${recipientMode === 'manual' ? 'bg-indigo-50 text-indigo-800 border-indigo-300' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}>
                  Saisie manuelle
                </button>
              </div>
              {recipientMode === 'group' ? (
                <select value={targetGroup} onChange={e => setTargetGroup(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-md bg-white focus:outline-indigo-600">
                  <option value="Tous">Tous les membres ({members.length})</option>
                  <option value="Actif">Actifs ({members.filter(m => m.status === 'Actif').length})</option>
                  <option value="Inactif">Inactifs ({members.filter(m => m.status === 'Inactif').length})</option>
                  {ministries.map(m => (
                    <option key={m} value={m}>{m} ({members.filter(mem => mem.ministry === m).length})</option>
                  ))}
                </select>
              ) : (
                <textarea value={manualPhones} onChange={e => setManualPhones(e.target.value)}
                  placeholder="+242 XX XXX XXXX, +242 YY YYY YYYY&#10;Un numéro par ligne ou séparé par une virgule"
                  rows={3}
                  className="w-full text-xs p-2 border border-slate-200 rounded-md focus:outline-indigo-600" />
              )}
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-600">
              <div className="flex items-center gap-2">
                <Vote className="w-4 h-4 text-indigo-600" />
                <strong>{recipientMode === 'group' ? recipients.length : manualPhones.split(/[\n,]+/).filter(Boolean).length}</strong> destinataire(s)
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={handleSaveDraft}
                className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-sm font-semibold cursor-pointer">
                Enregistrer comme brouillon
              </button>
              <button onClick={handleSendWhatsApp} disabled={sending}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-60 cursor-pointer">
                {sending ? 'Envoi...' : <><Send className="w-4 h-4" /> Envoyer via WhatsApp</>}
              </button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs space-y-2 h-fit">
            <h4 className="font-bold text-amber-800">Aperçu du message</h4>
            <div className="bg-white p-3 rounded-lg border border-amber-100 text-[11px] whitespace-pre-wrap font-sans">
              {question.trim() || 'Votre question ici'}
              {options.filter(o => o.label.trim()).length > 0 && (
                <>
                  {'\n\n'}{options.filter(o => o.label.trim()).map((o, i) => `${i + 1}. ${o.label}`).join('\n')}
                </>
              )}
              {'\n\nRépondez avec le numéro de votre choix.'}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {polls.length === 0 ? (
              <div className="bg-white text-center py-12 rounded-xl border border-slate-200 text-slate-400 text-xs">Aucun sondage pour le moment.</div>
            ) : (
              polls.map(poll => (
                <div key={poll.id} onClick={() => setSelectedPoll(poll)}
                  className={`bg-white p-4 rounded-xl border text-xs space-y-2 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${selectedPoll?.id === poll.id ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-slate-900 block truncate">{poll.question}</span>
                      <span className="text-[10px] text-slate-400">{formatDate(poll.createdAt)}{poll.sentAt ? ` • Envoyé le ${formatDate(poll.sentAt)}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {statusBadge(poll.status)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span>{(poll.options || []).length} option(s)</span>
                    <span>{(poll.recipients || []).length} destinataire(s)</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            {selectedPoll ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-sm text-slate-800 leading-tight flex-1">{selectedPoll.question}</h4>
                  {statusBadge(selectedPoll.status)}
                </div>
                <div className="text-[10px] text-slate-400">
                  Créé le {formatDate(selectedPoll.createdAt)}
                  {selectedPoll.sentAt && <> • Envoyé le {formatDate(selectedPoll.sentAt)}</>}
                </div>
                <div className="space-y-1.5">
                  {selectedPoll.options.map((opt, i) => (
                    <div key={opt.id} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100 text-xs">
                      <span className="font-medium text-slate-700">{i + 1}. {opt.label}</span>
                      <span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100">{opt.votes} voix</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-slate-500">
                  <strong>{(selectedPoll.recipients || []).length}</strong> destinataire(s)
                </div>
                {(selectedPoll.recipients || []).length > 0 && (
                  <details className="text-[10px] text-slate-400">
                    <summary className="cursor-pointer hover:text-slate-600">Voir les destinataires</summary>
                    <div className="mt-1 max-h-32 overflow-y-auto space-y-0.5">
                      {(selectedPoll.recipients || []).map((r, i) => (
                        <div key={r} className="text-[10px] text-slate-500">{r}</div>
                      ))}
                    </div>
                  </details>
                )}
                <div className="flex gap-2 pt-1">
                  {selectedPoll.status === 'sent' && (
                    <button onClick={() => handleClosePoll(selectedPoll.id!)}
                      className="flex-1 text-xs py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg font-semibold cursor-pointer">
                      Clôturer le sondage
                    </button>
                  )}
                  <button onClick={() => handleDeletePoll(selectedPoll.id!)}
                    className="flex items-center justify-center gap-1 text-xs py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg font-semibold cursor-pointer px-3">
                    <Trash2 className="w-3 h-3" /> Supprimer
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs text-slate-400 text-center">
                Sélectionnez un sondage pour voir les détails
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
