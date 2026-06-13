import React, { useState } from 'react';
import { LayoutDashboard, Users, Building2, CreditCard, CalendarDays, UserCheck, MessageSquareText, BookOpen, Church, Sparkles, Bookmark, Shield, ClipboardCheck, FileBarChart2, Settings, ChevronDown, ChevronUp } from 'lucide-react';

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

export default function HelpModule() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['comms']));

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl text-slate-800 font-bold tracking-tight">Aide de l'application</h1>
          <p className="text-xs text-slate-500 mt-0.5">Clique sur une section pour voir les détails de chaque module</p>
        </div>
      </div>

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
  );
}
