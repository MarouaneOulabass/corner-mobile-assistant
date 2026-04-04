# Questions & Décisions prises

## Décisions techniques

1. **Auth**: JWT custom au lieu de Supabase Auth, car le spec demande des rôles custom (superadmin/manager/seller) avec contrôle fin par magasin. Supabase Auth ne gère pas nativement ce modèle multi-tenant.

2. **Passwords**: SHA-256 via Web Crypto API (compatible Edge Runtime du middleware Next.js). Pour la production, migrer vers bcrypt côté serveur serait préférable.

3. **IMEI Scanner**: Implémenté en mode recherche texte pour v1. Le scan caméra avec @zxing/library peut être ajouté comme amélioration.

4. **Impression étiquettes**: Utilisation de `window.print()` avec CSS `@media print` et bwip-js pour les barcodes. Le SDK Brother QL natif nécessite un driver desktop séparé.

5. **Offline POS**: Les ventes hors ligne sont stockées dans localStorage et synchronisées au retour de la connexion. Pas de Service Worker complet pour v1.

6. **WhatsApp**: Utilisation de liens `wa.me` (fallback) au lieu de l'API WhatsApp Business qui nécessite une approbation Meta.

## Ambiguïtés restantes

- Le format exact des reçus thermiques n'est pas spécifié — implémenté en format écran partageable.
- Le seuil de "low stock alert" n'est pas défini — à configurer par le manager.
- La gestion des retours produits n'est pas détaillée — le statut `returned` existe mais le flux n'est pas implémenté.
