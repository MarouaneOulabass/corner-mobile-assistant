# Corner Mobile Assistant - Rapport Final

## Vue d'ensemble

Projet complet d'assistant IA pour Corner Mobile, boutique de smartphones a Rabat, Maroc.
Deux interfaces distinctes deployees sur GitHub Pages (zero backend).

---

## Fichiers du projet

| Fichier | Role |
|---------|------|
| `index.html` | Assistant Vendeur (protege par mot de passe) |
| `client.html` | Bot Client Public (accessible a tous) |
| `catalogue.json` | Catalogue local (fallback si Loyverse indisponible) |
| `reparations.json` | Grille tarifaire des reparations |
| `prestations.json` | Services a domicile avec prix |
| `cache.json` | Reponses en cache pour questions frequentes |
| `RAPPORT.md` | Ce rapport |

---

## Fonctionnalites implementees

### index.html - Assistant Vendeur

- **Protection par mot de passe** : "corner2026" (session-based via sessionStorage)
- **Stock Loyverse en temps reel** : Appels API paginates, donnees par magasin (M1 Ait Baha / M2 Oued Dahab)
- **IA Claude** (claude-sonnet-4-20250514) : System prompt specialise vendeur avec stock injecte
- **Prix par magasin** : Affiche prix et disponibilite distincts pour M1 et M2
- **Filtre magasin** : Boutons pour filtrer la vue par magasin
- **Entree vocale** : Web Speech API (fr-FR)
- **Reponse vocale** : Web Speech Synthesis (desactivee par defaut)
- **Logging Google Sheets** : Configurable via parametres (Sheet ID)
- **Suggestion chips** : Requetes rapides pre-configurees
- **Fallback catalogue.json** : Si Loyverse API echoue
- **Design** : Dark theme, monospace, grille tech en background
- **Mobile-first** : 100dvh, touch-optimized

### client.html - Bot Client Public

- **Chat IA commercial** : Personnalite chaleureuse, drole, convaincante
- **Multilingue** : Francais / Darija / Arabe (detection automatique)
- **Cache intelligent** : Verifie cache.json avant chaque appel Claude
- **Prix publics uniquement** : Pas de couts, pas de stock par magasin
- **Reparations** : Consulte reparations.json pour les tarifs
- **Services a domicile** : Consulte prestations.json
- **Prise de RDV** :
  - Modal formulaire complet (nom, tel, adresse, service, date/heure)
  - Detection automatique d'intention RDV
  - Verification disponibilite Google Calendar
  - Creation evenement Google Calendar (OAuth2 implicit flow)
  - Confirmation avec recapitulatif
- **Logging local** : Toutes les conversations sauvegardees dans localStorage
- **Design** : Theme clair/chaud, orange/amber, coins arrondis, commercial
- **Mobile-first** : PWA-capable

### Fichiers de donnees

- **prestations.json** : 10 services a domicile avec prix, durees, zones couvertes
- **cache.json** : 11 entrees de cache pour FAQ (horaires, adresse, contact, garantie, etc.)

---

## Architecture technique

```
Client (GitHub Pages)
    |
    |-- CORS Proxy (corsproxy.io ou Cloudflare Worker)
    |       |
    |       |-- Claude API (api.anthropic.com/v1/messages)
    |       |-- Loyverse API (api.loyverse.com/v1.0/items)
    |       |-- Google Sheets API (append rows)
    |
    |-- Google OAuth2 (implicit flow, direct)
    |       |-- Google Calendar API (events CRUD)
    |
    |-- Fichiers locaux (fetch relatif)
            |-- catalogue.json (fallback)
            |-- reparations.json
            |-- prestations.json
            |-- cache.json
```

### Technologies

- HTML5 / CSS3 / Vanilla JavaScript (zero frameworks)
- CSS Custom Properties, Flexbox, Grid
- Web Speech API (reconnaissance + synthese vocale)
- Google OAuth2 Implicit Flow
- Fetch API avec CORS proxy

---

## Limitations connues

1. **CORS Proxy** : Le proxy corsproxy.io est un service gratuit avec des limites de debit. En production, utiliser un Cloudflare Worker dedie.

2. **API Keys en clair** : Les cles API sont dans le code source (CONFIG object). Sur un repo GitHub public, elles sont exposees. Solution : Cloudflare Worker comme proxy authentifie.

3. **Google OAuth** : Le token expire apres 1 heure. L'utilisateur doit re-autoriser. Pas de refresh token possible en implicit flow.

4. **Google Sheets Logging** : Necessite une configuration supplementaire (Sheet ID, permissions). Le logging est optionnel.

5. **Cache client.html** : Le cache est base sur des patterns simples. Les questions complexes passent toujours par Claude.

6. **Loyverse API** : Pas de webhook temps reel. Le stock est charge au demarrage de la page. Rechargement manuel possible.

7. **Mot de passe** : Protection basique (sessionStorage). Un utilisateur technique peut contourner. Pour une vraie securite, utiliser un backend.

8. **Voice API** : Necessite Chrome/Edge. Non supporte sur Firefox/Safari iOS.

---

## Recommandations

### Securite (Priorite haute)

1. **Cloudflare Worker** : Deployer un Worker qui :
   - Stocke les API keys en variables d'environnement
   - Proxifie les appels Claude et Loyverse
   - Ajoute rate limiting
   - Verifie l'origine des requetes

2. **Separateur d'API keys** : Utiliser des cles differentes pour vendeur et client

3. **Proteger index.html** : Envisager GitHub Pages avec acces prive ou un systeme d'authentification

### Performance

1. **Mise en cache Loyverse** : Cacher le stock dans localStorage avec TTL de 5 minutes
2. **Service Worker** : Ajouter pour support PWA offline
3. **Compression** : Minifier les fichiers HTML pour production

### Fonctionnel

1. **WhatsApp** : Remplacer "+212 XXX XXX XXX" par le vrai numero
2. **Google Sheets** : Configurer un Sheet dedie et partager les logs avec l'equipe
3. **Analytics** : Ajouter Google Analytics ou Plausible pour tracker l'usage du bot client
4. **Notifications** : Ajouter des notifications push pour les nouveaux RDV

---

## Configuration Cloudflare Worker (a deployer)

```javascript
// Exemple de Worker Cloudflare pour proxifier les API
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const target = url.searchParams.get('target');

    if (!target) return new Response('Missing target', { status: 400 });

    const headers = new Headers(request.headers);

    // Injecter les API keys cote serveur
    if (target.includes('anthropic.com')) {
      headers.set('x-api-key', env.CLAUDE_API_KEY);
      headers.set('anthropic-version', '2023-06-01');
    }
    if (target.includes('loyverse.com')) {
      headers.set('Authorization', 'Bearer ' + env.LOYVERSE_TOKEN);
    }

    const response = await fetch(target, {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? await request.text() : undefined
    });

    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders
    });
  }
};
```

---

## Deploiement GitHub Pages

1. Push tous les fichiers vers le repo
2. Activer GitHub Pages (Settings > Pages > Source: main branch)
3. URL publique : `https://<username>.github.io/corner-mobile-assistant/`
4. Bot client : `https://<username>.github.io/corner-mobile-assistant/client.html`
5. Assistant vendeur : `https://<username>.github.io/corner-mobile-assistant/index.html`

---

*Rapport genere le 28 mars 2026*
*Projet Corner Mobile Assistant v1.0*
