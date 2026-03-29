# RAPPORT FINAL — Corner Mobile Assistant

**Date :** 29 Mars 2026
**Repo :** github.com/MarouaneOulabass/corner-mobile-assistant
**Live :** marouaneoulabass.github.io/corner-mobile-assistant

---

## Fonctionnalités implémentées

### Interface Vendeur — `index.html`
- [x] Protection par mot de passe ("corner2026") avec session
- [x] Chat IA (Claude Sonnet) avec stock injecté dans le prompt
- [x] Stock temps réel via `catalogue.json` (MAJ auto 30min par GitHub Actions)
- [x] Prix + stock détaillé par magasin (M1 Aït Baha / M2 Oued Dahab)
- [x] Coût d'achat et marge affichés pour le vendeur
- [x] Filtre par magasin (All / M1 / M2)
- [x] Input vocal (Web Speech API)
- [x] Réponse vocale toggle (désactivé par défaut)
- [x] Logging conversations dans Google Sheets (si configuré)
- [x] Panneau Settings avec saisie des clés API
- [x] Badge compteur stock dans le header
- [x] Dark theme, mobile first

### Interface Client — `client.html`
- [x] Chat IA avec personnalité commerciale marocaine
- [x] Multilingue automatique : Français / Darija / Arabe classique / Anglais
- [x] Termine toujours par invitation boutique ou WhatsApp (+212 694432235)
- [x] Prix publics depuis catalogue.json (pas de prix de revient)
- [x] Réparations avec prix depuis reparations.json
- [x] Services à domicile depuis prestations.json
- [x] Flow réparation guidé : demande modèle → prix → propose domicile
- [x] Prise de RDV : modal formulaire + collecte dans le chat
- [x] Google Calendar : vérification disponibilité + création événement + rappel 1h
- [x] Bouton FAB flottant pour RDV rapide
- [x] Cache FAQ (horaires, adresse, WhatsApp, garantie, paiement)
- [x] Compteur cache hits vs API calls
- [x] Logging conversations localStorage + Google Sheets
- [x] Panneau admin caché (triple-tap logo)
- [x] Input vocal
- [x] Light theme chaleureux, mobile first

### Analyseur — `analyze.html`
- [x] Dashboard stats (total conversations, cache rate, fails)
- [x] Détection conversations échouées
- [x] Regroupement questions par sujet
- [x] Suggestions : nouveaux cache entries, ajustements prompt, produits manquants
- [x] Export CSV des logs
- [x] Bouton vider les logs

### Fichiers de données
- [x] `catalogue.json` — 43 produits uniques, stock M1/M2, prix, coût (MAJ auto)
- [x] `reparations.json` — Tarifs réparation par marque/modèle
- [x] `prestations.json` — 10 services à domicile avec prix marché marocain
- [x] `cache.json` — 5 réponses FAQ instantanées

### Infrastructure
- [x] GitHub Pages (hébergement gratuit)
- [x] GitHub Actions : workflow `update-stock.yml` (MAJ Loyverse toutes les 30min)
- [x] Secret `LOYVERSE_TOKEN` configuré dans le repo

---

## Architecture technique

```
GitHub Pages              GitHub Actions (cron 30min)         Loyverse API
 index.html  ◄────────── update-stock.yml ──────────────────► (stock POS)
 client.html                    │
 analyze.html                   ▼
 *.json              catalogue.json (43 produits)
     │
     │ Appels directs navigateur
     ▼
 Claude API                    Google APIs
 (anthropic.com)               Calendar + Sheets
 header: dangerous-            OAuth2 implicit flow
 direct-browser-access
```

**Loyverse CORS** : L'API Loyverse ne supporte pas CORS navigateur → résolu par GitHub Actions qui appelle l'API côté serveur et commit `catalogue.json`.

**Claude CORS** : Supporté nativement via le header `anthropic-dangerous-direct-browser-access: true`.

---

## Résultats des tests

### Tests Interface Puppeteer (site live GitHub Pages)
| Test | Résultat |
|------|:--------:|
| Catalogue chargé (43 produits) | ✅ |
| Prix iPhone 14 (3600 MAD) | ✅ |
| Écran cassé → demande modèle | ✅ |
| iPhone 13 → prix réparation (600-750 MAD) | ✅ |
| Proposition service à domicile | ✅ |
| Cache horaires (réponse instantanée) | ✅ |
| Password screen vendeur | ✅ |
| Mauvais mot de passe → erreur | ✅ |
| Bon mot de passe → accès | ✅ |
| Admin panel triple-tap | ✅ |
| Chips suggestions visibles | ✅ |
| Responsive mobile 390px | ✅ |
| Darija "khouya" | ✅ |
| Mémoire conversation (5 échanges) | ✅ |

---

## Points à review

1. **Clés API dans localStorage** : Stockées en clair dans le navigateur. Acceptable pour usage interne.
2. **Google OAuth** : Configurer le redirect URI dans Google Cloud Console pour activer Calendar.
3. **Email de confirmation RDV** : Impossible sans backend. Le rappel 1h est géré par Google Calendar.
4. **Recherche prix marché** : Non implémentée (nécessiterait un scraper côté serveur).

---

## Recommandations

### Court terme
- [ ] Configurer Google OAuth dans Cloud Console (ajouter redirect URI)
- [ ] Créer un Google Sheet pour les logs et noter l'ID dans les settings
- [ ] Tester le flow RDV complet avec Google Calendar

### Moyen terme
- [ ] Photos produits dans Loyverse → afficher dans le chat
- [ ] PWA : manifest.json + service worker pour installation mobile
- [ ] Mode comparateur dans le bot client

### Long terme
- [ ] Cloudflare Worker pour sécuriser les clés API
- [ ] Bot WhatsApp Business direct (Twilio / WhatsApp Cloud API)
- [ ] Dashboard analytics (Plausible)

---

## Bugs connus / Limitations

1. **Stock 30min de latence** : GitHub Actions met à jour toutes les 30min, pas temps réel
2. **Voix iOS Safari** : Web Speech API limitée, reconnaissance peut couper après 10s
3. **Google Calendar token** : Expire après 1h, l'utilisateur doit ré-autoriser
4. **Anthropic rate limits** : En forte utilisation, possible throttling. Le cache réduit ~30% des appels
