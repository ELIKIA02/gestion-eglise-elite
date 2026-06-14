import React, { useState } from 'react';
import { LayoutDashboard, Users, Building2, CreditCard, CalendarDays, UserCheck, MessageSquareText, BookOpen, Church, Sparkles, Bookmark, Shield, ClipboardCheck, FileBarChart2, Settings, ChevronDown, ChevronUp, Globe, Smartphone } from 'lucide-react';

const TABS = [
  {
    id: 'dashboard',
    label: 'Tableau de Bord',
    icon: LayoutDashboard,
    color: 'bg-indigo-100 text-indigo-700',
    description: 'Vue d\'ensemble de l\'église : nombre de membres, finances (entrées/sorties), événements à venir, communications récentes, graphiques d\'évolution.',
    details: [
      'Cartes de statistiques (membres actifs/inactifs, trésorerie, événements du mois)',
      'Graphique linéaire des finances sur 12 mois',
      'Graphique en secteurs (dîmes, offrandes, dépenses)',
      'Boutons d\'accès rapide vers chaque module',
      'Barre de recherche et indicateur de connexion'
    ]
  },
  {
    id: 'members',
    label: 'Membres',
    icon: Users,
    color: 'bg-emerald-100 text-emerald-700',
    description: 'Gestion complète des membres : ajout, modification, suppression, statuts (Actif/Inactif/En observation), groupes et ministères.',
    details: [
      'Ajouter un membre avec photo, contact, adresse, date naissance',
      'Filtrer par statut, groupe (Jeunesse/Femmes/Hommes/Enfants), ministère',
      'Vue carte ou liste avec recherche rapide',
      'Sous-module Anniversaires (calendrier des anniversaires)',
      'Sous-module Visites pastorales (suivi des visites)',
      'Attribuer des rôles et groupes'
    ]
  },
  {
    id: 'departments',
    label: 'Départements',
    icon: Building2,
    color: 'bg-amber-100 text-amber-700',
    description: 'CRUD des départements/ministères de l\'église avec code couleur, membres associés et envoi de messages ciblés.',
    details: [
      'Créer un département (nom, description, couleur)',
      'Voir les membres affectés à chaque département',
      'Envoyer un message WhatsApp/SMS à tout un département',
      'Modifier ou supprimer un département'
    ]
  },
  {
    id: 'finances',
    label: 'Finances',
    icon: CreditCard,
    color: 'bg-green-100 text-green-700',
    description: 'Comptabilité des entrées et sorties (offrandes, dîmes, dons, factures) avec filtres, graphiques et export.',
    details: [
      'Enregistrer une transaction (type, montant, date, catégorie)',
      'Filtrer par période, type, catégorie',
      'Graphiques d\'évolution (barres) et répartition (secteurs)',
      'Sous-module Dîmes : enregistrement des dîmes par membre',
      'Export CSV/Excel des données'
    ]
  },
  {
    id: 'cultes',
    label: 'Cultes',
    icon: CalendarDays,
    color: 'bg-sky-100 text-sky-700',
    description: 'Planification des cultes et événements avec suivi des présences, prédicateurs et lien calendrier.',
    details: [
      'Ajouter un culte/événement (titre, date, lieu, prédicateur)',
      'Vue calendrier ou liste',
      'Marquer les présences des participants',
      'Générer un lien Google Calendar / Outlook',
      'Sous-module Service Planning : planifier les équipes de louange, technique, accueil'
    ]
  },
  {
    id: 'presence',
    label: 'Présence',
    icon: UserCheck,
    color: 'bg-teal-100 text-teal-700',
    description: 'Suivi des présences aux différents cultes avec statistiques mensuelles et graphiques.',
    details: [
      'Enregistrer la présence d\'un membre à un culte',
      'Vue mensuelle avec totaux',
      'Recherche par membre',
      'Graphiques d\'évolution des présences dans le temps'
    ]
  },
  {
    id: 'comms',
    label: 'Communications',
    icon: MessageSquareText,
    color: 'bg-blue-100 text-blue-700',
    description: 'Envoi de messages WhatsApp/SMS, publication Facebook, sondages et historique des communications.',
    details: [
      'Section Messagerie : envoyer des messages individuels ou de groupe via WhatsApp',
      'Section Facebook : publier du texte ou des articles structurés (Titre + Sous-titre + Corps), avec images',
      'Programmer des publications Facebook et des messages WhatsApp',
      'Section Sondages : créer et diffuser des sondages',
      'Historique complet des communications envoyées',
      'Connexion WhatsApp via QR Code'
    ]
  },
  {
    id: 'ressources',
    label: 'Ressources',
    icon: BookOpen,
    color: 'bg-violet-100 text-violet-700',
    description: 'Centre de ressources : enseignements bibliques, bibliothèque et documents.',
    details: [
      'Enseignement : publier des séries d\'enseignement vers Facebook',
      'Bibliothèque : gérer une collection de livres/références',
      'Documents : importer, stocker et organiser des fichiers (certificats, reçus, PV)',
      'Recherche dans les ressources'
    ]
  },
  {
    id: 'sacraments',
    label: 'Registre',
    icon: Church,
    color: 'bg-rose-100 text-rose-700',
    description: 'Registre des sacrements : Baptême, Mariage, Profession de foi, Dédicace avec génération de certificats.',
    details: [
      'Enregistrer un acte (type, date, officiant, membre concerné)',
      'Générer automatiquement un numéro de certificat',
      'Filtrer par type de sacrement',
      'Imprimer un certificat individuel'
    ]
  },
  {
    id: 'ia',
    label: 'Assistant IA',
    icon: Sparkles,
    color: 'bg-purple-100 text-purple-700',
    description: 'Assistant pastoral basé sur l\'IA (Mistral AI) pour générer des prédications, messages, conseils et études bibliques.',
    details: [
      'Mode Prédication : générer un plan de prédication',
      'Mode Texte : rédiger des messages WhatsApp/SMS',
      'Mode Conseil : conseils pastoraux',
      'Mode Description : descriptions d\'événements',
      'Mode Étude : études bibliques approfondies',
      'Mode Exhortation : séries d\'exhortations sur plusieurs jours',
      'Mode Référence : rechercher des versets bibliques (via bible-api.com)',
      'Historique des réponses avec copie et export'
    ]
  },
  {
    id: 'liturgical',
    label: 'Thèmes Liturgiques',
    icon: Bookmark,
    color: 'bg-pink-100 text-pink-700',
    description: 'Calendrier liturgique avec thèmes, couleurs et versets pour chaque saison (Avent, Carême, Pâques, etc.).',
    details: [
      'Assigner un thème à une date avec couleur et verset',
      'Navigation par mois',
      'Basculer entre les saisons liturgiques',
      'Transférer un thème vers les Communications pour annonce'
    ]
  },
  {
    id: 'users',
    label: 'Utilisateurs',
    icon: Shield,
    color: 'bg-slate-100 text-slate-700',
    description: 'Gestion des comptes utilisateurs avec rôles et permissions.',
    details: [
      'Ajouter/modifier/supprimer un utilisateur',
      'Rôles disponibles : Admin, Secrétaire, Trésorier, Pasteur, Lecture seule',
      'Connexion/déconnexion',
      'Suivi des sessions actives'
    ]
  },
  {
    id: 'audit',
    label: 'Audit Église',
    icon: ClipboardCheck,
    color: 'bg-orange-100 text-orange-700',
    description: 'Génération d\'un rapport d\'audit complet par IA, analysant les membres, finances et événements.',
    details: [
      'Choisir un focus : Complet, Finances, Croissance, Membres',
      'Génération automatique du rapport en Markdown',
      'Export du rapport',
      'Basé sur les données réelles de l\'application'
    ]
  },
  {
    id: 'reports',
    label: 'Rapports',
    icon: FileBarChart2,
    color: 'bg-cyan-100 text-cyan-700',
    description: 'Rapports annuels détaillés avec graphiques, tableaux et export PDF/Excel.',
    details: [
      'Rapports financiers (entrées/sorties/dîmes/offrandes par année)',
      'Statistiques démographiques des membres',
      'Tendances de présence',
      'Export PDF et Excel',
      'Graphiques interactifs'
    ]
  },
  {
    id: 'settings',
    label: 'Paramètres',
    icon: Settings,
    color: 'bg-gray-100 text-gray-700',
    description: 'Configuration centrale de l\'église : nom, logo, thème, API, notifications et sauvegarde.',
    details: [
      'Informations générales : nom, logo, téléphone, types de cultes',
      'Thème : clair/sombre',
      'API Facebook : configurer et vérifier le token',
      'API Mistral AI : clé pour l\'assistant IA',
      'Saisons liturgiques',
      'Notifications : rappels anniversaires, événements',
      'Exporter/Importer les données (sauvegarde JSON)',
      'Synchronisation Cloud (Google/Microsoft)'
    ]
  }
];

function CollapsibleSection({ tab, isOpen, onToggle }: { tab: typeof TABS[0]; isOpen: boolean; onToggle: () => void }) {
  const Icon = tab.icon;
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg ${tab.color} flex items-center justify-center`}>
            <Icon className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm text-slate-800">{tab.label}</h3>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100">
          <p className="text-xs text-slate-600 leading-relaxed mb-3">{tab.description}</p>
          <ul className="space-y-1">
            {tab.details.map((d, i) => (
              <li key={i} className="text-xs text-slate-500 flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ConfigStep({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">{number}</span>
        <h3 className="text-sm font-bold text-slate-700">{title}</h3>
      </div>
      <div className="ml-9 text-xs text-slate-600 leading-relaxed">{children}</div>
    </div>
  );
}

export default function HelpModule() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['comms']));
  const [showFbGuide, setShowFbGuide] = useState(true);
  const [showWaGuide, setShowWaGuide] = useState(true);

  const toggle = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-5 font-sans max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl text-slate-800 font-bold tracking-tight">Aide de l'application</h1>
        <p className="text-xs text-slate-500 mt-0.5">Guides pas à pas et description de chaque module</p>
      </div>

      {/* Facebook Configuration Guide */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <button onClick={() => setShowFbGuide(!showFbGuide)}
          className="w-full flex items-center justify-between bg-blue-600 px-5 py-3.5 cursor-pointer hover:bg-blue-700 transition-colors">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-white" />
            <h2 className="text-sm font-bold text-white">Jumelage Facebook — guide complet</h2>
          </div>
          {showFbGuide ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
        </button>
        {showFbGuide && (
          <div className="p-5 space-y-6">
            <ConfigStep number={1} title="Créer / ouvrir une application Meta">
              <p>Va sur <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">developers.facebook.com/apps/</a></p>
              <ul className="list-disc ml-4 mt-1.5 space-y-0.5">
                <li>Crée une application <strong>Business</strong> (ou utilise celle qui existe déjà)</li>
                <li>Note l'<strong>App ID</strong> (ex: 992155633265316) — utile pour les assets</li>
              </ul>
            </ConfigStep>

            <ConfigStep number={2} title="Ajouter les permissions au token utilisateur">
              <ul className="list-disc ml-4 space-y-0.5">
                <li>Va sur <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">Graph API Explorer</a></li>
                <li>Sélectionne ton application et la version <strong>v25.0</strong> de préférence</li>
                <li>Clique <strong>"Obtenir le jeton d'accès"</strong> et coche <strong>pages_manage_posts</strong> + <strong>pages_read_engagement</strong></li>
                <li><span className="text-amber-600 font-semibold">Important :</span> utilise le champ de recherche pour trouver <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">pages_read_engagement</code> si elle n'apparaît pas dans la liste</li>
                <li>Clique <strong>"Continuer"</strong> et autorise</li>
              </ul>
            </ConfigStep>

            <ConfigStep number={3} title="Générer le token Page">
              <ul className="list-disc ml-4 space-y-0.5">
                <li>Sans fermer l'Explorateur, tape <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">me/accounts</code> dans la barre de requête</li>
                <li>Clique <strong>"Soumettre"</strong></li>
                <li>Dans la réponse, repère ta page (ex: "Centre Missionnaire EDEN") et <strong>copie son access_token</strong></li>
                <li><span className="text-red-600 font-semibold">⚠️ Critique :</span> le token Page doit être généré immédiatement après avoir obtenu le token utilisateur avec les bonnes permissions, sinon il n'hérite pas de <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">pages_read_engagement</code></li>
              </ul>
            </ConfigStep>

            <ConfigStep number={4} title="Lier la page à l'application (App Assets)">
              <ul className="list-disc ml-4 space-y-0.5">
                <li>Va sur <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">developers.facebook.com/apps/</a></li>
                <li>Ouvre ton application → <strong>App Assets</strong> (ou Roles → Assets)</li>
                <li>Clique <strong>"Add Assets"</strong> → sélectionne <strong>"Pages"</strong></li>
                <li>Cherche ta page ou colle son ID (<code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">1125493457313592</code>)</li>
                <li>Confirme l'ajout</li>
                <li><span className="text-amber-600 font-semibold">Alternative :</span> Use Cases → "Page Public Content Access" → "Add Page"</li>
              </ul>
            </ConfigStep>

            <ConfigStep number={5} title="Configurer le token dans l'application">
              <ul className="list-disc ml-4 space-y-0.5">
                <li>Va dans <strong>Paramètres → Facebook</strong></li>
                <li>Colle le token Page dans le champ "Jeton d'accès Facebook"</li>
                <li>Clique <strong>"Vérifier"</strong> pour confirmer que le token est valide</li>
                <li>Vérifie que les permissions affichées sont en <span className="text-emerald-600 font-semibold">vert</span></li>
                <li>Clique <strong>"Enregistrer"</strong></li>
              </ul>
            </ConfigStep>

            <ConfigStep number={6} title="Tester et publier">
              <ul className="list-disc ml-4 space-y-0.5">
                <li>Va dans <strong>Communications → Facebook</strong></li>
                <li>Sélectionne ta page dans le menu déroulant</li>
                <li>Clique <strong>"Tester la publication"</strong> pour vérifier les permissions</li>
                <li>Rédige ton message (texte simple ou article structuré avec images)</li>
                <li>Ajoute des images via le <strong>glisser-déposer</strong> ou en cliquant sur la zone d'upload</li>
                <li>Ordonne les images (glisser pour réorganiser, ✕ pour supprimer)</li>
                <li>Optionnel : coche <strong>"Programmer"</strong> et choisis une date/heure</li>
                <li>Clique <strong>"Publier maintenant"</strong> ou <strong>"Programmer l'article"</strong></li>
              </ul>
            </ConfigStep>

            {/* Résultat attendu */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
              <p className="font-semibold mb-1">✅ Résultat attendu après configuration réussie :</p>
              <ul className="list-disc ml-4 space-y-0.5 text-emerald-700">
                <li>🟢 Type : Token Page</li>
                <li>🟢 Pages_read_engagement : OUI</li>
                <li>🟢 Pages_manage_posts : OUI</li>
                <li>Le post apparaît sur la page Facebook</li>
                <li>Les images sont attachées au post (pas de publication séparée)</li>
              </ul>
            </div>

            {/* Erreurs fréquentes */}
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
              <p className="font-semibold mb-1">❌ Erreurs fréquentes et solutions :</p>
              <table className="w-full mt-1 text-left border-collapse">
                <thead>
                  <tr className="border-b border-red-200 text-[10px] uppercase tracking-wider text-red-600">
                    <th className="py-1 pr-2">Erreur</th>
                    <th className="py-1">Cause</th>
                    <th className="py-1 pl-2">Solution</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-red-100">
                    <td className="py-1.5 pr-2 font-mono text-[10px]">(#200) requires both permissions</td>
                    <td className="py-1.5 text-[10px]">Token Page sans héritage</td>
                    <td className="py-1.5 pl-2 text-[10px]">Regénère le token Page sans fermer l'Explorateur (étape 3)</td>
                  </tr>
                  <tr className="border-b border-red-100">
                    <td className="py-1.5 pr-2 font-mono text-[10px]">(#10) requires pages_read_engagement</td>
                    <td className="py-1.5 text-[10px]">Page non liée à l'app</td>
                    <td className="py-1.5 pl-2 text-[10px]">Ajoute la page dans App Assets (étape 4)</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-2 font-mono text-[10px]">Invalid parameter</td>
                    <td className="py-1.5 text-[10px]">Image ou attached_media invalide</td>
                    <td className="py-1.5 pl-2 text-[10px]">Vérifie que les images font &lt; 10 MB</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp Configuration Guide */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <button onClick={() => setShowWaGuide(!showWaGuide)}
          className="w-full flex items-center justify-between bg-emerald-600 px-5 py-3.5 cursor-pointer hover:bg-emerald-700 transition-colors">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-white" />
            <h2 className="text-sm font-bold text-white">Jumelage WhatsApp — guide complet</h2>
          </div>
          {showWaGuide ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
        </button>
        {showWaGuide && (
          <div className="p-5 space-y-6">
            <ConfigStep number={1} title="Connecter WhatsApp à l'application">
              <ul className="list-disc ml-4 space-y-0.5">
                <li>Va dans <strong>Communications → Messagerie</strong></li>
                <li>Si un <strong>QR Code</strong> s'affiche, ouvre WhatsApp sur ton téléphone</li>
                <li>Menu → Appareils liés → <strong>Lier un appareil</strong></li>
                <li>Scanne le QR code affiché dans l'application</li>
                <li>La connexion est automatique : le bandeau passe en <span className="text-emerald-600 font-semibold">vert "WhatsApp connecté"</span></li>
              </ul>
              <div className="mt-2 text-xs text-slate-500">
                💡 Le QR n'apparaît pas ? Clique sur <strong>"QR pas visible ?"</strong> pour voir les logs du serveur.
              </div>
            </ConfigStep>

            <ConfigStep number={2} title="Envoyer des messages individuels">
              <ul className="list-disc ml-4 space-y-0.5">
                <li>Sélectionne un ou plusieurs membres dans la liste</li>
                <li>Rédige ton message dans l'éditeur (texte simple ou formaté)</li>
                <li>Utilise les boutons de formatage : <strong>Gras</strong>, <em>Italique</em>, <del>Barré</del></li>
                <li>Ajoute une image si nécessaire</li>
                <li>Clique <strong>"Envoyer"</strong> pour envoyer immédiatement</li>
                <li><span className="text-amber-600 font-semibold">Conseil :</span> utilise le formatage WhatsApp (*texte* pour gras, _texte_ pour italique) pour un rendu correct sur mobile</li>
              </ul>
            </ConfigStep>

            <ConfigStep number={3} title="Envoyer à un groupe">
              <ul className="list-disc ml-4 space-y-0.5">
                <li>Passe en mode <strong>"Groupe"</strong></li>
                <li>Sélectionne un groupe WhatsApp dans la liste</li>
                <li>Rédige ton message et envoie</li>
                <li>Utilise le bouton <strong>"Rafraîchir"</strong> si un nouveau groupe n'apparaît pas</li>
              </ul>
            </ConfigStep>

            <ConfigStep number={4} title="Programmer des messages">
              <ul className="list-disc ml-4 space-y-0.5">
                <li>Coche <strong>"Programmer"</strong></li>
                <li>Choisis la date et l'heure d'envoi</li>
                <li>Clique <strong>"Programmer"</strong></li>
                <li>Le message sera envoyé automatiquement à la date choisie</li>
                <li>Les messages programmés apparaissent dans la section "Messages programmés" en bas</li>
              </ul>
            </ConfigStep>

            <ConfigStep number={5} title="Mode déconnecté (liens wa.me)">
              <ul className="list-disc ml-4 space-y-0.5">
                <li>Si WhatsApp n'est pas connecté, les messages sont envoyés sous forme de <strong>liens wa.me</strong></li>
                <li>Chaque destinataire reçoit un lien cliquable qui ouvre WhatsApp avec le message pré-rempli</li>
                <li>Les images ne peuvent pas être envoyées en mode déconnecté</li>
                <li>Pour utiliser l'envoi automatique, connecte-toi via le QR Code</li>
              </ul>
            </ConfigStep>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <p className="font-semibold mb-1">⚠️ Point important :</p>
              <p>La session WhatsApp peut expirer après quelques jours. Si le bandeau devient rouge, reconnecte-toi en scannant un nouveau QR Code depuis <strong>Communications → Messagerie</strong>. Tu peux exporter la session (<strong>"Exporter session WhatsApp"</strong>) pour sauvegarder l'authentification.</p>
            </div>
          </div>
        )}
      </div>

      <hr className="border-slate-200" />

      {/* Tous les modules */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-3">Tous les modules</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {TABS.map(tab => (
            <CollapsibleSection
              key={tab.id}
              tab={tab}
              isOpen={openSections.has(tab.id)}
              onToggle={() => toggle(tab.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
