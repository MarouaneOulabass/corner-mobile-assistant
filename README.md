# Corner Mobile — POS & Business Management

Application mobile-first de gestion de point de vente pour **Corner Mobile**, un réseau de magasins de réparation et revente de smartphones à Rabat, Maroc.

## Stack technique

- **Frontend**: Next.js 14 (App Router) — PWA installable
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: JWT custom avec rôles (superadmin, manager, seller)
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514)
- **Styling**: Tailwind CSS — mobile-first, dark mode POS
- **Tests**: Vitest
- **Labels**: PDF via pdf-lib + bwip-js barcodes

## Installation locale

```bash
# 1. Cloner le repo
git clone https://github.com/marouaneoulabass/corner-mobile-assistant.git
cd corner-mobile-assistant

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env.local
# Remplir les clés dans .env.local

# 4. Lancer le serveur de développement
npm run dev
```

## Configuration Supabase

### 1. Créer les tables

Allez dans **Supabase Dashboard > SQL Editor** et exécutez le contenu de :
- `supabase/migrations/001_initial_schema.sql`

### 2. Initialiser les données

Démarrez l'app en local (`npm run dev`) puis appelez :
```bash
curl -X POST http://localhost:3000/api/auth/setup
```

Cela crée les magasins et utilisateurs initiaux :

| Email | Rôle | Mot de passe |
|-------|------|-------------|
| admin@cornermobile.ma | superadmin | corner2024 |
| manager.m1@cornermobile.ma | manager M1 | corner2024 |
| manager.m2@cornermobile.ma | manager M2 | corner2024 |
| seller.m1@cornermobile.ma | seller M1 | corner2024 |
| seller.m2@cornermobile.ma | seller M2 | corner2024 |

## Variables d'environnement

```
NEXT_PUBLIC_SUPABASE_URL=         # URL du projet Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Clé publique Supabase
SUPABASE_SERVICE_ROLE_KEY=        # Clé secrète Supabase
ANTHROPIC_API_KEY=                # Clé API Anthropic Claude
NEXTAUTH_SECRET=                  # Secret JWT (chaîne aléatoire)
NEXT_PUBLIC_APP_URL=              # URL de l'app (http://localhost:3000)
```

## Déploiement Vercel

1. Connectez le repo GitHub à Vercel
2. Ajoutez les variables d'environnement ci-dessus
3. Déployez — `vercel.json` est déjà configuré

## Modules

| Module | Route | Description |
|--------|-------|-------------|
| Dashboard | `/` | Résumé quotidien, KPIs |
| POS | `/pos` | Point de vente (dark theme) |
| Stock | `/stock` | Inventaire, IMEI, transferts |
| Réparations | `/repairs` | Tickets de réparation |
| Clients | `/customers` | CRM, historique achats |
| Rapports | `/reports` | Analytics, IA insights |
| Menu | `/menu` | Navigation, profil, déconnexion |

## Tests

```bash
npm run test        # Tests unitaires
npm run build       # Vérification build
npm run lint        # ESLint
```

## PWA

L'application est installable sur smartphone via le navigateur (Ajouter à l'écran d'accueil). Le POS fonctionne hors ligne avec synchronisation automatique.

---

Corner Mobile &copy; 2024-2026
