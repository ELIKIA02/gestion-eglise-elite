import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc, db, handleFirestoreError, OperationType } from '../firebase';
import { ChurchSettings } from '../types';
import { Settings, Check, RefreshCw, FileText, Sliders, Layout, Eye, HelpCircle, Key, Upload, Trash2, Download, UploadCloud, Sun, Moon, Bell, Cloud, Globe, Smartphone, Bookmark } from 'lucide-react';

interface SettingsModuleProps {
  settings: ChurchSettings | null;
  loading: boolean;
  onRefresh: () => void;
}

export default function SettingsModule({ settings, loading, onRefresh }: SettingsModuleProps) {
  const [appName, setAppName] = useState('');
  const [appLogo, setAppLogo] = useState('');
  const [churchPhone, setChurchPhone] = useState('');
  const [worshipTypes, setWorshipTypes] = useState('');
  const [worshipDays, setWorshipDays] = useState('');
  const [reportHeader, setReportHeader] = useState('');
  const [mistralApiKey, setMistralApiKey] = useState('');
  const [cachetBase64, setCachetBase64] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [liturgicalSeasons, setLiturgicalSeasons] = useState('');
  const [liturgicalTypes, setLiturgicalTypes] = useState('');
  const [notifBirthdayReminder, setNotifBirthdayReminder] = useState(true);
  const [notifEventReminder, setNotifEventReminder] = useState(true);
  const [notifLowBalanceAlert, setNotifLowBalanceAlert] = useState(true);
  const [notifAttendanceAlert, setNotifAttendanceAlert] = useState(true);
  const [notifReminderDays, setNotifReminderDays] = useState(3);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const cachetInputRef = useRef<HTMLInputElement>(null);

  const isImageLogo = appLogo.startsWith('data:image');
  const isImageCachet = cachetBase64.startsWith('data:image');

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAppLogo(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleCachetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setCachetBase64(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCachet = () => {
    setCachetBase64('');
    if (cachetInputRef.current) cachetInputRef.current.value = '';
  };

  const handleRemoveLogo = () => {
    setAppLogo('†');
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  // Sync state with props
  useEffect(() => {
    if (settings) {
      setAppName(settings.appName || "ELIKIA EKLESIA");
      setAppLogo(settings.appLogo || "⛪");
      setChurchPhone(settings.churchPhone || '');
      setWorshipTypes(settings.worshipTypes || "Prédication, École du dimanche, Jeûne, Séminaire, Culte régulier, Autre");
      setWorshipDays(settings.worshipDays || "Dimanche, Mercredi");
      setReportHeader(settings.reportHeader || "ÉGLISE ÉVANGÉLIQUE DE LA GRÂCE\nSecrétariat Général et Trésorerie\nB.P. 2480 - Tel: +242 06 123 4567 • Brazzaville, Congo");
      setMistralApiKey(settings.mistralApiKey || '');
      setCachetBase64(settings.cachetBase64 || '');
      setTheme(settings.theme || 'light');
      setLiturgicalSeasons(settings.liturgicalSeasons || "Avent, Carême, Pâques, Pentecôte, Ordinaire, Noël");
      setLiturgicalTypes(settings.liturgicalTypes || "Dimanche, Mercredi, Spécial, Jeûne, Séminaire");
      setNotifBirthdayReminder(settings.notifications?.birthdayReminder ?? true);
      setNotifEventReminder(settings.notifications?.eventReminder ?? true);
      setNotifLowBalanceAlert(settings.notifications?.lowBalanceAlert ?? true);
      setNotifAttendanceAlert(settings.notifications?.attendanceAlert ?? true);
      setNotifReminderDays(settings.notifications?.reminderDays ?? 3);
    }
  }, [settings]);

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) return;

    setSaving(true);
    setSaveSuccess(false);
    const path = 'church_settings/app_config';

    try {
      await setDoc(doc(db, 'church_settings', 'app_config'), {
        appName: appName.trim(),
        appLogo: appLogo.trim(),
        churchPhone: churchPhone.trim(),
        worshipTypes: worshipTypes
          .split(',')
          .map(t => t.trim())
          .filter(t => t.length > 0)
          .join(', '),
        worshipDays: worshipDays
          .split(',')
          .map(t => t.trim())
          .filter(t => t.length > 0)
          .join(', '),
        reportHeader: reportHeader.trim(),
        mistralApiKey: mistralApiKey.trim(),
        cachetBase64: cachetBase64.trim(),
        theme: theme,
        liturgicalSeasons: liturgicalSeasons.trim(),
        liturgicalTypes: liturgicalTypes.trim(),
        notifications: {
          birthdayReminder: notifBirthdayReminder,
          eventReminder: notifEventReminder,
          lowBalanceAlert: notifLowBalanceAlert,
          attendanceAlert: notifAttendanceAlert,
          reminderDays: notifReminderDays,
        },
        updatedAt: new Date().toISOString()
      });

      setSaveSuccess(true);
      onRefresh();
      
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("Save settings error:", err);
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = () => {
    if (window.confirm("Voulez-vous restaurer les paramètres par défaut ?")) {
      setAppName("ELIKIA EKLESIA");
      setAppLogo("⛪");
      setChurchPhone('');
      setWorshipTypes("Prédication, École du dimanche, Jeûne, Séminaire, Culte régulier, Autre");
      setWorshipDays("Dimanche, Mercredi");
      setReportHeader("ÉGLISE ÉVANGÉLIQUE DE LA GRÂCE\nSecrétariat Général et Trésorerie\nB.P. 2480 - Tel: +242 06 123 4567 • Brazzaville, Congo");
      setMistralApiKey('');
      setCachetBase64('');
      setTheme('light');
      setLiturgicalSeasons("Avent, Carême, Pâques, Pentecôte, Ordinaire, Noël");
      setLiturgicalTypes("Dimanche, Mercredi, Spécial, Jeûne, Séminaire");
      setNotifBirthdayReminder(true);
      setNotifEventReminder(true);
      setNotifLowBalanceAlert(true);
      setNotifAttendanceAlert(true);
      setNotifReminderDays(3);
    }
  };

  const currentWorshipList = worshipTypes
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-xs text-slate-500 font-medium">Chargement des paramètres...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl text-slate-800 font-bold tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            Paramètres & Configuration d'Église
          </h2>
          <p className="text-xs text-slate-500">Personnalisez le nom de votre paroisse, le logo et les en-têtes officiels de vos documents.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-50/50 p-6 rounded-xl border border-slate-200/65 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              Identité de l'Application
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-650 block uppercase tracking-wider">
                  Nom de la Paroisse / Application
                </label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-indigo-600 font-medium bg-white"
                  placeholder="Ex: Église Évangélique de la Grâce"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-650 block uppercase tracking-wider flex items-center gap-1">
                  Logo
                </label>
                <div className="flex gap-2">
                  <input type="file" accept="image/*" ref={logoInputRef} onChange={handleLogoUpload}
                    className="hidden" />
                  <button type="button" onClick={() => logoInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" /> Image
                  </button>
                  {isImageLogo && (
                    <button type="button" onClick={handleRemoveLogo}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 border border-red-200 rounded-lg bg-white hover:bg-red-50 text-red-600 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" /> Enlever
                    </button>
                  )}
                  <input type="text" value={!isImageLogo ? appLogo : ''}
                    onChange={(e) => setAppLogo(e.target.value)}
                    className="flex-1 text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-indigo-600 text-center font-bold bg-white"
                    placeholder="Ex: † ou ⛪" maxLength={5} />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {isImageLogo ? (
                    <img src={appLogo} alt="Logo" className="w-8 h-8 object-contain rounded border border-slate-200" />
                  ) : (
                    <span className="w-8 h-8 bg-indigo-50 rounded text-indigo-800 text-sm font-bold flex items-center justify-center border border-indigo-150">
                      {appLogo || "†"}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">
                    {isImageLogo ? 'Logo image chargée' : 'Symbole ou emoji'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-650 block uppercase tracking-wider">
                  Numéro d'envoi (SMS / WhatsApp)
                </label>
                <input
                  type="tel"
                  value={churchPhone}
                  onChange={(e) => setChurchPhone(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-indigo-600 font-medium bg-white"
                  placeholder="Ex: +242 06 123 4567"
                />
                <span className="text-[9px] text-slate-400 block leading-tight">Ce numéro apparaîtra comme expéditeur dans les messages.</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-650 block uppercase tracking-wider flex items-center gap-1">
                  Cachet numérique
                </label>
                <div className="flex gap-2">
                  <input type="file" accept="image/*" ref={cachetInputRef} onChange={handleCachetUpload}
                    className="hidden" />
                  <button type="button" onClick={() => cachetInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" /> Image
                  </button>
                  {isImageCachet && (
                    <button type="button" onClick={handleRemoveCachet}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 border border-red-200 rounded-lg bg-white hover:bg-red-50 text-red-600 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" /> Enlever
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {isImageCachet ? (
                    <img src={cachetBase64} alt="Cachet" className="w-12 h-12 object-contain rounded border border-slate-200" />
                  ) : (
                    <span className="w-12 h-12 bg-slate-50 rounded text-slate-300 text-[9px] font-medium flex items-center justify-center border border-dashed border-slate-200">
                      Cachet
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">Image carrée recommandée (PNG avec fond transparent)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50/50 p-6 rounded-xl border border-slate-200/65 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layout className="w-4 h-4 text-indigo-600" />
              Configuration des Activités & Cultes
            </h3>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-650 block uppercase tracking-wider">
                Types de cultes autorisés (séparés par des virgules)
              </label>
              <textarea
                value={worshipTypes}
                onChange={(e) => setWorshipTypes(e.target.value)}
                rows={3}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white font-medium"
                placeholder="Ex: Culte du Dimanche, Enseignement, Ministère de Jeunesse, Intercession"
                required
              />
              <span className="text-[10px] text-slate-400 block font-normal leading-normal mt-1">
                La liste ci-dessus alimentera automatiquement le menu déroulant lors de la création d'événements.
              </span>
            </div>

            {/* Visual Tags preview */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Aperçu des catégories :</span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {currentWorshipList.map((tag, idx) => (
                  <span key={idx} className="bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-medium px-2 py-1 rounded border border-slate-200/70 transition-all">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Jours de cultes fixes */}
            <div className="space-y-1.5 pt-3 border-t border-slate-100">
              <label className="text-[11px] font-bold text-slate-650 block uppercase tracking-wider flex items-center justify-between">
                <span>Jours de cultes fixes de la semaine</span>
                <span className="text-[9px] text-indigo-600 lowercase bg-indigo-50 px-2 py-0.5 rounded font-normal">Calcul automatique</span>
              </label>
              <input
                type="text"
                value={worshipDays}
                onChange={(e) => setWorshipDays(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white font-medium"
                placeholder="Ex: Dimanche, Mercredi, Vendredi"
                required
              />
              <span className="text-[10px] text-slate-400 block font-normal leading-normal mt-1">
                Le système prendra automatiquement la date exacte de ce jour programmé lors de la saisie (ex : Dimanche correspondra à la date du dimanche en cours / à venir).
              </span>
            </div>
          </div>

          <div className="bg-slate-50/50 p-6 rounded-xl border border-slate-200/65 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-indigo-600" />
              Configuration des Thèmes Liturgiques
            </h3>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-650 block uppercase tracking-wider">
                Saisons liturgiques (séparées par des virgules)
              </label>
              <input type="text" value={liturgicalSeasons}
                onChange={(e) => setLiturgicalSeasons(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white font-medium"
                placeholder="Ex: Avent, Carême, Pâques, Pentecôte, Ordinaire, Noël" />
              <span className="text-[10px] text-slate-400 block font-normal leading-normal mt-1">
                Ces saisons apparaîtront dans le module Thèmes Liturgiques.
              </span>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-650 block uppercase tracking-wider">
                Types de célébrations (séparés par des virgules)
              </label>
              <input type="text" value={liturgicalTypes}
                onChange={(e) => setLiturgicalTypes(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white font-medium"
                placeholder="Ex: Dimanche, Mercredi, Spécial, Jeûne, Séminaire" />
              <span className="text-[10px] text-slate-400 block font-normal leading-normal mt-1">
                Types de célébrations disponibles pour les thèmes liturgiques.
              </span>
            </div>
          </div>

          <div className="bg-slate-50/50 p-6 rounded-xl border border-slate-200/65 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-700" />
              En-tête Officiel des Documents
            </h3>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-650 block uppercase tracking-wider">
                Texte de l'En-tête (Factures, Devis, Rapports, Certificats)
              </label>
              <textarea
                value={reportHeader}
                onChange={(e) => setReportHeader(e.target.value)}
                rows={5}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg font-mono focus:outline-indigo-600 bg-white leading-relaxed"
                placeholder="Renseignez le nom officiel, numéro de dépôt, adresse, contacts..."
                required
              />
              <span className="text-[10px] text-slate-500 block leading-normal mt-1 font-sans">
                Ce bloc d'en-tête apparaîtra en haut des documents pdf imprimables, reçus de dîmes, décomptes comptables et devis pastoraux.
              </span>
            </div>
          </div>

          {/* Mistral AI Configuration */}
          <div className="bg-slate-50/50 p-6 rounded-xl border border-slate-200/65 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-600" />
              Configuration de l'Assistant IA (Mistral)
            </h3>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-650 block uppercase tracking-wider">
                Clé d'API Mistral
              </label>
              <input
                type="password"
                value={mistralApiKey}
                onChange={(e) => setMistralApiKey(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-indigo-600 font-mono bg-white"
                placeholder="Entrez votre clé API Mistral (ex: sk-...)"
              />
              <span className="text-[10px] text-slate-400 block font-normal leading-normal mt-1">
                La clé est stockée localement et envoyée au serveur à chaque requête.
                Obtenez une clé gratuitement sur <a href="https://console.mistral.ai" target="_blank" className="text-indigo-600 hover:underline" rel="noreferrer">console.mistral.ai</a>
              </span>
            </div>
          </div>

          {/* Theme Configuration */}
          <div className="bg-slate-50/50 p-6 rounded-xl border border-slate-200/65 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-600" /> : <Sun className="w-4 h-4 text-amber-600" />}
              Apparence & Thème
            </h3>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center gap-2 px-5 py-3 rounded-lg text-xs font-semibold cursor-pointer transition-all border-2 ${
                  theme === 'light'
                    ? 'border-amber-500 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <Sun className="w-4 h-4" />
                Mode Clair
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-2 px-5 py-3 rounded-lg text-xs font-semibold cursor-pointer transition-all border-2 ${
                  theme === 'dark'
                    ? 'border-indigo-500 bg-slate-800 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <Moon className="w-4 h-4" />
                Mode Sombre
              </button>
            </div>
            <span className="text-[10px] text-slate-400 block">Le thème sombre réduit la fatigue oculaire et économise la batterie sur les appareils mobiles.</span>
          </div>

          {/* Notification Settings */}
          <div className="bg-slate-50/50 p-6 rounded-xl border border-slate-200/65 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-rose-600" />
              Notifications & Rappels
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                <span className="text-xs font-medium text-slate-700">Rappel d'anniversaire</span>
                <input type="checkbox" checked={notifBirthdayReminder}
                  onChange={(e) => setNotifBirthdayReminder(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
              </label>
              <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                <span className="text-xs font-medium text-slate-700">Rappel d'événement</span>
                <input type="checkbox" checked={notifEventReminder}
                  onChange={(e) => setNotifEventReminder(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
              </label>
              <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                <span className="text-xs font-medium text-slate-700">Alerte solde faible</span>
                <input type="checkbox" checked={notifLowBalanceAlert}
                  onChange={(e) => setNotifLowBalanceAlert(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
              </label>
              <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                <span className="text-xs font-medium text-slate-700">Alerte baisse assistance</span>
                <input type="checkbox" checked={notifAttendanceAlert}
                  onChange={(e) => setNotifAttendanceAlert(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
              </label>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[11px] font-bold text-slate-650 uppercase tracking-wider shrink-0">
                Jrs d'anticipation
              </label>
              <input type="number" min={1} max={30} value={notifReminderDays}
                onChange={(e) => setNotifReminderDays(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-xs p-2 border border-slate-200 rounded-lg focus:outline-indigo-600 bg-white text-center font-bold" />
              <span className="text-[10px] text-slate-400">jours avant l'événement/anniversaire</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-sm border border-indigo-500"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Code de sauvegarde en cours...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Enregistrer les Paramètres
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleResetDefault}
              className="text-xs text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-4 py-2.5 rounded-lg transition-all"
            >
              Rétablir l'original
            </button>

            {saveSuccess && (
              <span className="text-xs text-emerald-700 font-semibold animate-fade-in">
                ✓ Paramètres enregistrés avec succès !
              </span>
            )}
          </div>
        </div>

        {/* Right Column: Visual Letterhead Preview */}
        <div className="lg:col-span-5 space-y-4">
          <span className="text-[10.5px] font-bold text-slate-400 block uppercase tracking-widest flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-slate-400" />
            Aperçu Virtuel de Document Officiel
          </span>

          <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-6 shadow-sm relative overflow-hidden font-serif min-h-[380px] flex flex-col justify-between">
            {/* Stamp/Watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-100/30 text-5xl font-bold select-none pointer-events-none uppercase border-4 border-dashed border-slate-100/30 p-2 transform rotate-12">
              {appName ? appName.substring(0, 15) : "PAROISSE"}
            </div>

            {/* Header Area */}
            <div className="border-b border-double border-slate-300 pb-4 text-center space-y-3 z-10">
              <div className="flex justify-center items-center gap-2 mb-1">
                {appLogo.startsWith('data:image') ? (
                  <img src={appLogo} alt="Logo" className="w-7 h-7 object-contain rounded" />
                ) : (
                  <span className="w-7 h-7 bg-indigo-55 rounded text-indigo-800 text-sm font-bold flex items-center justify-center border border-indigo-150">
                    {appLogo || "†"}
                  </span>
                )}
                <span className="font-sans font-bold text-xs tracking-tight text-slate-900">
                  {appName || "ELIKIA EKLESIA"}
                </span>
              </div>

              {/* Editable Header display */}
              <div className="text-[10px] text-slate-600 font-sans whitespace-pre-wrap leading-relaxed max-w-xs mx-auto">
                {reportHeader || "En-tête officiel de l'église..."}
              </div>
            </div>

            {/* Body Placeholder */}
            <div className="py-6 space-y-3 z-10 flex-1">
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded border border-slate-100">
                <span className="text-[10px] font-sans font-extrabold text-slate-500 uppercase tracking-widest">Document type</span>
                <span className="text-[9px] font-mono text-slate-400 bg-white border px-1.5 py-0.5 rounded">REF: DEC-2026-001</span>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="h-2 w-2/3 bg-slate-100 rounded"></div>
                <div className="h-2 w-full bg-slate-100 rounded"></div>
                <div className="h-2 w-4/5 bg-slate-100 rounded"></div>
              </div>

              <div className="border-t border-slate-100/80 pt-4 mt-4 flex justify-between items-end">
                <div className="space-y-1">
                  <div className="h-1.5 w-16 bg-slate-100 rounded"></div>
                  <div className="h-1.5 w-24 bg-slate-100 rounded"></div>
                </div>
                <div className="text-[9px] text-slate-400 font-sans italic text-right">
                  Visa & Sceau Pastoral
                </div>
              </div>
            </div>

            {/* Bottom Meta */}
            <div className="border-t border-slate-200/60 pt-3 text-[8.5px] text-slate-400 text-center font-sans tracking-tight">
              Généré numériquement le {new Date().toLocaleDateString('fr-FR')} par le système {appName || "Church"}
            </div>
          </div>
        </div>
      </form>

      {/* Export / Import des données */}
      <div className="border-t border-slate-200 pt-6 mt-8">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Download className="w-4 h-4 text-emerald-600" />
          Sauvegarde & Transfert des Données
        </h3>
        <p className="text-[11px] text-slate-500 mb-4">
          Exportez toutes les données pour les transférer sur une autre machine, ou importez une sauvegarde existante.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              const db = localStorage.getItem('church_db_data');
              const ens = localStorage.getItem('church_enseignements');
              if (!db && !ens) { alert('Aucune donnée à exporter.'); return; }
              const payload = JSON.stringify({
                church_db_data: db ? JSON.parse(db) : null,
                church_enseignements: ens ? JSON.parse(ens) : null
              });
              const blob = new Blob([payload], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `eglise-donnees-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-sm border border-emerald-500"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter les données
          </button>

          <label className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-sm border border-indigo-500">
            <UploadCloud className="w-3.5 h-3.5" />
            Importer une sauvegarde
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  try {
                    const imported = JSON.parse(ev.target?.result as string);
                    if (typeof imported !== 'object') throw new Error('Format invalide');
                    const impData = imported.church_db_data || imported;
                    const impEns = imported.church_enseignements;

                    // Merge church_db_data
                    const existingRaw = localStorage.getItem('church_db_data');
                    const existing = existingRaw ? JSON.parse(existingRaw) : {};
                    const merged: any = {};
                    const allKeys = new Set([...Object.keys(existing), ...Object.keys(impData)]);
                    for (const key of allKeys) {
                      const oldVal = existing[key];
                      const newVal = impData[key];
                      if (!oldVal) { merged[key] = newVal; continue; }
                      if (!newVal) { merged[key] = oldVal; continue; }
                      if (Array.isArray(oldVal) && Array.isArray(newVal)) {
                        const oldIds = new Set(oldVal.map((i: any) => i.id));
                        merged[key] = [...oldVal, ...newVal.filter((i: any) => i && i.id && !oldIds.has(i.id))];
                      } else {
                        merged[key] = oldVal;
                      }
                    }
                    localStorage.setItem('church_db_data', JSON.stringify(merged));

                    // Merge enseignements
                    if (impEns) {
                      const oldEnsRaw = localStorage.getItem('church_enseignements');
                      const oldEns = oldEnsRaw ? JSON.parse(oldEnsRaw) : [];
                      const oldIds = new Set(oldEns.map((i: any) => i.id));
                      const mergedEns = [...oldEns, ...impEns.filter((i: any) => i && i.id && !oldIds.has(i.id))];
                      localStorage.setItem('church_enseignements', JSON.stringify(mergedEns));
                    }
                    alert(`Données fusionnées avec succès ! (${merged.church_members?.length || 0} membres, ${merged.church_finances?.length || 0} transactions, etc.)`);
                    window.location.reload();
                  } catch {
                    alert('Fichier invalide. Veuillez sélectionner un fichier JSON exporté depuis cette application.');
                  }
                };
                reader.readAsText(file);
              }}
            />
          </label>
        </div>
      </div>

      {/* Sauvegarde Cloud */}
      <div className="border-t border-slate-200 pt-6 mt-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Cloud className="w-4 h-4 text-sky-600" />
          Synchronisation & Sauvegarde Cloud
        </h3>
        <p className="text-[11px] text-slate-500 mb-4">
          Sauvegardez vos données sur le cloud pour les retrouver sur n'importe quel appareil.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Google Drive */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-200">
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-800 block">Google Drive</span>
                <span className="text-[10px] text-slate-400">Sauvegarde cloud Google</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const db = localStorage.getItem('church_db_data');
                const ens = localStorage.getItem('church_enseignements');
                if (!db && !ens) { alert('Aucune donnée à sauvegarder.'); return; }
                const payload = JSON.stringify({
                  church_db_data: db ? JSON.parse(db) : null,
                  church_enseignements: ens ? JSON.parse(ens) : null
                });
                const blob = new Blob([payload], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `eglise-donnees-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                window.open('https://drive.google.com/drive/my-drive', '_blank');
              }}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-sm border border-blue-500"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Sauvegarder sur Drive
            </button>
            <p className="text-[9px] text-slate-400 leading-relaxed">
              Télécharge le fichier puis déposez-le dans Google Drive ouvert dans un nouvel onglet.
            </p>
          </div>

          {/* OneDrive */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center border border-sky-200">
                <Cloud className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-800 block">Microsoft OneDrive</span>
                <span className="text-[10px] text-slate-400">Sauvegarde cloud Microsoft</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const db = localStorage.getItem('church_db_data');
                const ens = localStorage.getItem('church_enseignements');
                if (!db && !ens) { alert('Aucune donnée à sauvegarder.'); return; }
                const payload = JSON.stringify({
                  church_db_data: db ? JSON.parse(db) : null,
                  church_enseignements: ens ? JSON.parse(ens) : null
                });
                const blob = new Blob([payload], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `eglise-donnees-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                window.open('https://onedrive.live.com', '_blank');
              }}
              className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-sm border border-sky-500"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Sauvegarder sur OneDrive
            </button>
            <p className="text-[9px] text-slate-400 leading-relaxed">
              Télécharge le fichier puis déposez-le dans OneDrive ouvert dans un nouvel onglet.
            </p>
          </div>

          {/* Serveur local */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-200">
                <Smartphone className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-800 block">Sync Serveur</span>
                <span className="text-[10px] text-slate-400">Synchronisation automatique</span>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  const db = localStorage.getItem('church_db_data');
                  const ens = localStorage.getItem('church_enseignements');
                  if (!db && !ens) { alert('Aucune donnée.'); return; }
                  const data: any = {};
                  if (db) Object.assign(data, JSON.parse(db));
                  if (ens) data['church_enseignements'] = JSON.parse(ens);
                  const res = await fetch('/api/data/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                  });
                  if (res.ok) alert('Données synchronisées avec le serveur !');
                  else alert('Erreur de synchronisation.');
                } catch {
                  alert('Impossible de contacter le serveur.');
                }
              }}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-sm border border-emerald-500"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Synchroniser maintenant
            </button>
            <p className="text-[9px] text-slate-400 leading-relaxed">
              Synchronise les données avec le serveur local. Les données sont automatiquement sauvegardées à chaque modification.
            </p>
          </div>
        </div>
      </div>

      {/* Vider les données */}
      <div className="border-t border-red-200 pt-6 mt-4">
        <h3 className="text-sm font-bold text-red-700 flex items-center gap-2 mb-4">
          <Trash2 className="w-4 h-4 text-red-600" />
          Zone de Danger
        </h3>
        <p className="text-[11px] text-slate-500 mb-4">
          Ces actions sont irréversibles. Assurez-vous d'avoir exporté vos données avant.
        </p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Vider toutes les données locales ? Cette action est irréversible.')) {
              localStorage.removeItem('church_db_data');
              localStorage.removeItem('church_enseignements');
              window.location.reload();
            }
          }}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-sm border border-red-500"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Vider toutes les données
        </button>
      </div>
    </div>
  );
}
