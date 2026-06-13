import { HelpCircle, Facebook, Smartphone, Globe, CheckCircle2, XCircle, ArrowRight, ExternalLink, Lock, Image, Calendar, Settings, MessageSquare, QrCode, Clock, Link, Users } from 'lucide-react';

export default function HelpModule() {
  return (
    <div className="space-y-6 font-sans max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl text-slate-800 font-bold tracking-tight">Aide & Configuration</h1>
        <p className="text-xs text-slate-500 font-light mt-0.5">Guides pas à pas pour configurer Facebook et WhatsApp</p>
      </div>

      {/* Facebook Guide */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-blue-600 px-5 py-3.5 flex items-center gap-2.5">
          <Globe className="w-5 h-5 text-white" />
          <h2 className="text-sm font-bold text-white">Configuration Facebook</h2>
        </div>
        <div className="p-5 space-y-6">

          <Step number={1} title="Créer / ouvrir une application Meta" icon={<Settings className="w-4 h-4" />}>
            Va sur <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">developers.facebook.com/apps/</a>
            <ul className="list-disc ml-4 mt-1.5 space-y-0.5">
              <li>Crée une application Business (ou utilise celle qui existe déjà)</li>
              <li>Note l'<strong>App ID</strong> (ex: 992155633265316) — utile pour les assets</li>
            </ul>
          </Step>

          <Step number={2} title="Ajouter les permissions au token utilisateur" icon={<Lock className="w-4 h-4" />}>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>Va sur <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">Graph API Explorer</a></li>
              <li>Sélectionne ton application et la version (v25.0 de préférence)</li>
              <li>Clique <strong>"Obtenir le jeton d'accès"</strong> et coche <strong>pages_manage_posts</strong> + <strong>pages_read_engagement</strong></li>
              <li><span className="text-amber-600 font-semibold">Important :</span> utilise le champ de recherche pour trouver pages_read_engagement si elle n'apparaît pas dans la liste</li>
              <li>Clique <strong>"Continuer"</strong> et autorise</li>
            </ul>
          </Step>

          <Step number={3} title="Générer le token Page" icon={<ArrowRight className="w-4 h-4" />}>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>Sans fermer l'Explorateur, tape <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">me/accounts</code> dans la barre de requête</li>
              <li>Clique <strong>"Soumettre"</strong></li>
              <li>Dans la réponse, repère ta page (ex: "Centre Missionnaire EDEN") et <strong>copie son access_token</strong></li>
              <li><span className="text-red-600 font-semibold">⚠️ Critique :</span> le token Page doit être généré immédiatement après avoir obtenu le token utilisateur avec les bonnes permissions, sinon il n'hérite pas de pages_read_engagement</li>
            </ul>
          </Step>

          <Step number={4} title="Lier la page à l'application (App Assets)" icon={<Link className="w-4 h-4" />}>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>Va sur <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">developers.facebook.com/apps/</a></li>
              <li>Ouvre ton application → <strong>App Assets</strong> (ou Roles → Assets)</li>
              <li>Clique <strong>"Add Assets"</strong> → sélectionne <strong>"Pages"</strong></li>
              <li>Cherche ta page ou colle son ID (<code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">1125493457313592</code>)</li>
              <li>Confirme l'ajout</li>
              <li><span className="text-amber-600 font-semibold">Option alternative :</span> Use Cases → "Page Public Content Access" → "Add Page"</li>
            </ul>
          </Step>

          <Step number={5} title="Configurer le token dans l'application" icon={<Settings className="w-4 h-4" />}>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>Va dans <strong>Paramètres → Facebook</strong></li>
              <li>Colle le token Page dans le champ "Jeton d'accès Facebook"</li>
              <li>Clique <strong>"Vérifier"</strong> pour confirmer que le token est valide</li>
              <li>Vérifie que les permissions affichées sont vertes</li>
              <li>Clique <strong>"Enregistrer"</strong></li>
            </ul>
          </Step>

          <Step number={6} title="Tester et publier" icon={<Globe className="w-4 h-4" />}>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>Va dans <strong>Communications → Facebook</strong></li>
              <li>Sélectionne ta page dans le menu déroulant</li>
              <li>Clique <strong>"Tester la publication"</strong> pour vérifier les permissions</li>
              <li>Rédige ton message (texte simple ou article avec images)</li>
              <li>Ajoute des images via le <strong>glisser-déposer</strong> ou en cliquant sur la zone d'upload</li>
              <li>Ordonne les images (glisser pour réorganiser, ✕ pour supprimer)</li>
              <li>Optionnel : coche <strong>"Programmer"</strong> et choisis une date/heure</li>
              <li>Clique <strong>"Publier maintenant"</strong> ou <strong>"Programmer l'article"</strong></li>
            </ul>

            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
              <p className="font-semibold mb-1">✅ Résultat attendu après configuration réussie :</p>
              <ul className="list-disc ml-4 space-y-0.5 text-emerald-700">
                <li>🟢 Type : Token Page</li>
                <li>🟢 Pages_read_engagement : OUI</li>
                <li>🟢 Pages_manage_posts : OUI</li>
                <li>Le post apparaît sur la page Facebook</li>
                <li>Les images sont attachées au post (pas de publication séparée)</li>
              </ul>
            </div>

            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
              <p className="font-semibold mb-1">❌ Erreurs fréquentes et solutions :</p>
              <ul className="list-disc ml-4 space-y-1">
                <li><strong>"(#200) requires both pages_read_engagement and pages_manage_posts"</strong> → Le token Page n'a pas hérité des permissions. Regénère-le en suivant l'étape 3 sans fermer l'Explorateur entre l'obtention du token et me/accounts</li>
                <li><strong>"(#10) This endpoint requires the 'pages_read_engagement' permission"</strong> → La page n'est pas liée à l'app. Suis l'étape 4 (App Assets)</li>
                <li><strong>"Invalid parameter"</strong> → Problème de format des images ou de attached_media (vérifie que les images font moins de 10 MB)</li>
                <li><strong>"fetch failed"</strong> → Le serveur n'est pas lancé. Démarre-le avec <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">npm run dev</code></li>
              </ul>
            </div>
          </Step>
        </div>
      </div>

      {/* WhatsApp Guide */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="bg-emerald-600 px-5 py-3.5 flex items-center gap-2.5">
          <Smartphone className="w-5 h-5 text-white" />
          <h2 className="text-sm font-bold text-white">Configuration WhatsApp</h2>
        </div>
        <div className="p-5 space-y-6">

          <Step number={1} title="Connecter WhatsApp à l'application" icon={<QrCode className="w-4 h-4" />}>
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
          </Step>

          <Step number={2} title="Envoyer des messages individuels" icon={<MessageSquare className="w-4 h-4" />}>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>Sélectionne un ou plusieurs membres dans la liste</li>
              <li>Rédige ton message dans l'éditeur (texte simple ou formaté)</li>
              <li>Utilise les boutons de formatage : <strong>Gras</strong>, <em>Italique</em>, <del>Barré</del></li>
              <li>Ajoute une image si nécessaire</li>
              <li>Clique <strong>"Envoyer"</strong> pour envoyer immédiatement</li>
              <li><span className="text-amber-600 font-semibold">Conseil :</span> utilise le formatage WhatsApp (*texte* pour gras, _texte_ pour italique) pour un rendu correct sur mobile</li>
            </ul>
          </Step>

          <Step number={3} title="Envoyer à un groupe" icon={<Users className="w-4 h-4" />}>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>Passe en mode <strong>"Groupe"</strong></li>
              <li>Sélectionne un groupe WhatsApp dans la liste</li>
              <li>Rédige ton message et envoie</li>
              <li>Utilise le bouton <strong>"Rafraîchir"</strong> si un nouveau groupe n'apparaît pas</li>
            </ul>
          </Step>

          <Step number={4} title="Programmer des messages" icon={<Clock className="w-4 h-4" />}>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>Coche <strong>"Programmer"</strong></li>
              <li>Choisis la date et l'heure d'envoi</li>
              <li>Clique <strong>"Programmer"</strong></li>
              <li>Le message sera envoyé automatiquement à la date choisie</li>
              <li>Les messages programmés apparaissent dans la section "Messages programmés" en bas</li>
            </ul>
          </Step>

          <Step number={5} title="Mode déconnecté (liens wa.me)" icon={<Link className="w-4 h-4" />}>
            <ul className="list-disc ml-4 space-y-0.5">
              <li>Si WhatsApp n'est pas connecté, les messages sont envoyés sous forme de <strong>liens wa.me</strong></li>
              <li>Chaque destinataire reçoit un lien cliquable qui ouvre WhatsApp avec le message pré-rempli</li>
              <li>Les images ne peuvent pas être envoyées en mode déconnecté</li>
              <li>Pour utiliser l'envoi automatique, connecte-toi via le QR Code</li>
            </ul>
          </Step>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            <p className="font-semibold mb-1">⚠️ Point important :</p>
            <p>La session WhatsApp peut expirer après quelques jours. Si le bandeau devient rouge, reconnecte-toi en scannant un nouveau QR Code depuis <strong>Communications → Messagerie</strong>. Tu peux exporter la session (<strong>"Exporter session WhatsApp"</strong>) pour sauvegarder l'authentification.</p>
          </div>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-2">Raccourcis utiles</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
            <span className="font-semibold text-indigo-600">Paramètres → Facebook</span> : Configurer et vérifier le token
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
            <span className="font-semibold text-emerald-600">Communications → Facebook</span> : Publier et programmer
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
            <span className="font-semibold text-indigo-600">Communications → Messagerie</span> : WhatsApp individuel et groupe
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
            <span className="font-semibold text-emerald-600">Enseignement → Facebook</span> : Publier une série d'enseignement
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ number, title, icon, children }: { number: number; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">{number}</span>
        {icon}
        <h3 className="text-sm font-bold text-slate-700">{title}</h3>
      </div>
      <div className="ml-9 text-xs text-slate-600 leading-relaxed">{children}</div>
    </div>
  );
}
