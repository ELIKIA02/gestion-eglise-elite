# Gestion d'Église Élite

Application de gestion paroissiale (membres, trésorerie, cultes, communications, assistant IA).

## Déploiement sur Render

1. **Créer un compte** sur [render.com](https://render.com) (via GitHub)
2. **Connecter ton dépôt** (GitHub, GitLab ou Bitbucket)
3. **Créer un Web Service** →
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Plan:** Gratuit (ou payant)

4. **Variables d'environnement** (Render Dashboard → Environment) :

   | Variable | Description |
   |----------|-------------|
   | `MISTRAL_API_KEY` | Clé API Mistral pour l'assistant IA |
   | `NODE_ENV` | `production` |

   *Les variables Firebase sont déjà intégrées dans le code via `firebase-applet-config.json`.*

## Développement local

```bash
npm install
cp .env.example .env.local
# Modifier MISTRAL_API_KEY dans .env.local
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)
