# Corner Mobile Assistant

## Projet
Application web statique (GitHub Pages) pour **Corner Mobile**, boutique de smartphones d'occasion a Rabat. Deux interfaces IA conversationnelles + dashboard analytics, le tout en vanilla HTML/CSS/JS sans framework.

**Live URL:** https://marouaneoulabass.github.io/corner-mobile-assistant

## Architecture

```
corner-mobile-assistant/
├── index.html            # Interface vendeur — chat IA interne, gestion stock
├── client.html           # Interface client — chatbot public, prise de RDV
├── analyze.html          # Dashboard admin — analyse logs conversations
├── worker.js             # Template Cloudflare Worker (CORS proxy)
├── catalogue.json        # Stock auto-genere toutes les 30min via GitHub Actions + Loyverse API
├── reparations.csv       # Grille tarifaire reparations (separateur ;)
├── prestations.csv       # Services a domicile (separateur ;)
├── cache.csv             # FAQ cache patterns (separateur ;)
├── .github/workflows/
│   └── update-stock.yml  # GitHub Action: sync Loyverse → catalogue.json toutes les 30min
├── RAPPORT.md            # Rapport d'implementation (29 mars 2026)
└── TEST_REPORT.md        # Rapport de tests manuels (10/10 pass)
```

## Stack technique
- **Frontend:** HTML/CSS/JS vanilla, pas de build, pas de npm
- **IA:** Claude API (claude-sonnet-4-20250514) — appels directs depuis le navigateur
- **Donnees stock:** Loyverse API → GitHub Actions → catalogue.json (cron 30min)
- **Donnees statiques:** CSV (separateur `;`) pour reparations, prestations, cache FAQ
- **Calendrier:** Google Calendar API (OAuth implicit flow)
- **Logging:** Google Sheets API (conversations)
- **Hosting:** GitHub Pages (static)
- **CORS proxy:** Cloudflare Worker (template dans worker.js, non deploye)

## Magasins
- **M1:** Centre Commercial Ait Baha, Rabat
- **M2:** Centre Commercial Oued Dahab (9isaria), Rabat
- Store IDs Loyverse: M1=`f8ed77ef-...`, M2=`ed81c93c-...`

## Fichiers de donnees

### catalogue.json (auto-genere)
- Ne PAS modifier manuellement — ecrase toutes les 30min par GitHub Actions
- Structure: `{ updated, stores, appareils: [{ nom, prix, prix_m1, prix_m2, cout, stock_m1, stock_m2, dispo }] }`
- ~99 produits, certains avec `prix: null` (probleme Loyverse)
- Le client.html filtre les items sans prix (`prix > 0`) pour ne pas les proposer

### reparations.csv
- Separateur: `;`
- Colonnes: `type;label;emoji;marque;groupe;type_dalle;prix_min;prix_max;delai;escalade;note`
- Parse cote client en objet structure `{ reparations: { type: { label, marques: { marque: [...] } } } }`
- Flag `escalade=oui` pour reparations complexes (Face ID, degats eau)

### prestations.csv
- Separateur: `;`
- Colonnes: `id;name;price_range;duration;at_home`
- `at_home`: `oui` ou `non`
- Zones couvertes, horaires et frais deplacement sont hardcodes dans le parser

### cache.csv
- Separateur: `;`
- Colonnes: `id;patterns;reponse`
- `patterns`: liste separee par virgules
- `reponse`: supporte `\n` pour les retours a la ligne
- 5 entrees actuellement, extensible facilement

## Conventions de code
- Pas de framework ni bundler — tout en inline dans les fichiers HTML
- Fonction utilitaire `parseCSV(text, sep)` presente dans chaque fichier HTML
- CONFIG objet global en haut de chaque page pour les parametres
- Fonctions async/await pour les appels API
- localStorage pour persister cles API, tokens, logs cote client
- Fonction `esc()` pour echapper le HTML dans les reponses
- CSS variables (--orange, --card, etc.) pour le theming
- Mobile-first, flexbox layouts

## Mot de passe admin
- Hash SHA-256 verifie cote client (pas de mot de passe en clair dans le source)
- Fonction `hashSHA256()` utilise `crypto.subtle`
- Le mot de passe actuel est `corner2026` (hash: `438abe17...`)
- Reste un controle minimal cote client, pas une vraie securite serveur

## Points d'attention pour le developpement

### Securite (restant)
- Cles API Claude stockees en clair dans localStorage — prevoir proxy backend
- Google OAuth en implicit flow (deprecated) — migrer vers PKCE
- Header `anthropic-dangerous-direct-browser-access` utilise pour appels Claude

### Donnees
- Items avec `prix: null` dans le catalogue — probleme Loyverse en amont
- Filtre `prix > 0` applique dans client.html pour ne pas les proposer aux clients
- index.html (vendeur) affiche tous les items y compris sans prix

### UX
- Historique conversation: 16 messages (vendeur), 12 messages (client)
- Pas de Service Worker navigateur (pas de offline)
- Pas de PWA manifest

## Correctifs appliques (2026-04-03)
1. **Migration JSON → CSV** pour reparations, prestations, cache (plus facile a maintenir)
2. **Password hashe** en SHA-256 au lieu de texte clair dans le source
3. **Fix items sans prix** — filtre `prix > 0` dans client.html
4. **Fix date picker RDV** — mise a jour du min date a chaque ouverture du modal
5. **Fix erreur silencieuse catalogue** — status pill affiche "Catalogue indisponible" si echec
6. **Meta SEO** — description + OG tags sur client.html
7. **noindex** sur index.html et analyze.html (pages admin)

## GitHub Actions
Le workflow `update-stock.yml` tourne toutes les 30min:
1. Fetch items Loyverse (pagine, max 20 pages)
2. Fetch inventaire par magasin (M1 + M2)
3. Build catalogue.json via script Python inline
4. Commit + push si changements

**Secret requis:** `LOYVERSE_TOKEN` dans les secrets du repo.

## Commandes utiles
```bash
# Tester localement
npx serve .

# Declencher manuellement la mise a jour stock
gh workflow run update-stock.yml
```
