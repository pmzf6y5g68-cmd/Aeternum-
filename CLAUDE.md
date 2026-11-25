# CLAUDE.md — Rendez-vous (plateforme universelle de prise de rendez-vous)

## Vision
Rendez-vous est la plateforme unique de prise de rendez-vous pour **tous les métiers qui reçoivent sur rendez-vous, hors santé/médical** (beauté, bien-être, sport, auto, maison, animaux, cours, conseil & juridique, loisirs & restaurants, services du quotidien). Côté usager : recherche « Quoi / Où », filtres (disponibilité, lieu, prix, distance, note), tri, carte, fiche établissement et réservation en quelques clics, compte « Mes rendez-vous ». Côté pro : page publique, agenda d'équipe, prestations à variantes, places, congés, acomptes, avis vérifiés.
Conçu en français (`fr`) avec structure i18n prête pour l'anglais (`en`). Le catalogue des métiers vit dans `src/config/categories.ts` (source unique, synchronisée avec `scripts/prospector.py` par un test).
Le système tourne en autonomie : prospection sortante tous métiers, réponses automatiques aux emails entrants par Claude, onboarding self-service, facturation Stripe et maintenance par crons.

## Stack & Commandes de Vérification
- **App & Webhooks :** Next.js (App Router, TypeScript strict), Tailwind CSS, Lucide Icons, Zod, Vitest.
- **Data & Auth :** Supabase (PostgreSQL, Auth, RLS stricte, fonctions RPC atomiques).
- **Paiements :** Stripe Subscriptions (Pro 39 € le 1er agenda + 15 € par agenda supplémentaire) + Stripe Connect Express (acomptes encaissés directement par l'établissement).
- **Emails sortants & entrants :** Resend (sortant) + Cloudflare Email Worker (`workers/email-inbound/`) -> `/api/webhooks/inbound-email` (entrant).
- **IA & Prospection :** API Anthropic (`@anthropic-ai/sdk` côté Next.js avec Tool Use / Structured Outputs stricts, `anthropic` côté Python) + GitHub Actions.

Exécute ces 4 vérifications après chaque bloc majeur de modifications :
- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- `python3 -m py_compile scripts/prospector.py`
- (si un Postgres est disponible) `scripts/test-sql.sh` — schéma rejoué deux fois + tests comportementaux SQL

## Contrats Critiques & Raisons Métier
1. **Isolation multi-tenant (RLS) :** Chaque établissement accède uniquement à ses lignes (`auth.uid() = owner_id`) ; chaque usager uniquement à ses RDV, favoris et profil. Les endpoints publics exposent uniquement `PUBLIC_BUSINESS_COLUMNS` et les disponibilités, car les coordonnées des clients finaux sont privées.
2. **Acomptes via Stripe Connect Express uniquement :** L'acompte client part sur le compte Connect du professionnel afin que la plateforme n'encaisse jamais de fonds pour compte de tiers. L'inscription reste utilisable immédiatement sans Connect (paiement sur place), puis l'établissement active Connect en 1 clic.
3. **Zéro double réservation :** Toute création de RDV passe par `create_booking_atomic` (`FOR UPDATE` sur l'établissement : quota, membre d'équipe, capacité, congés) après recalcul serveur du prix, de la variante, de la durée, des frais km et du créneau exact.
4. **Garde-fous absolus de l'agent email autonome :**
   - Filtrer avant tout appel IA les en-têtes automatiques (`Auto-Submitted`, `Precedence: bulk|list|auto_reply`, `X-Autoreply`) et adresses système (`noreply`, `mailer-daemon`, `postmaster`) pour éviter toute boucle infinie entre bots.
   - Traiter immédiatement tout mot-clé d'arrêt (`stop`, `désinscrire`, `unsubscribe`) de façon déterministe en base (`status = 'stopped'`) sans envoyer de réponse.
   - Plafonner les réponses automatiques à `4` échanges par fil (`ai_reply_count >= 4`) et escalader vers `OWNER_ALERT_EMAIL` (avec brouillon proposé, sans envoi automatique) dès qu'il s'agit d'un litige, d'une menace légale, d'un remboursement ou d'un bug technique non résolu.
   - L'agent IA ne doit jamais inventer de remise commerciale, de fonctionnalité inexistante ou de promesse contractuelle hors des faits fournis dans son contexte système.
5. **Géocodage gratuit :** `https://api-adresse.data.gouv.fr/search/` avec fallback Nominatim + Haversine `* 1.25` pour maintenir un coût d'infra nul.
6. **Prospection délivrable et conforme :** débit piloté par `compute_daily_cap` (warm-up progressif jusqu'à `MAX_EMAILS_PER_DAY`, freinage si rebonds ≥ 3 % ou plaintes ≥ 0,08 %, pause à 0,2 %), un seul domaine d'envoi authentifié (SPF/DKIM/DMARC), aucune rotation de domaines ni d'adresses pour contourner les filtres, désinscription en 1 clic RFC 8058 + `STOP`, liste `email_suppressions` toujours consultée avant envoi, vérification MX, aucun pixel de suivi (CNIL), uniquement des adresses professionnelles publiées par les établissements.
7. **Monétisation transparente :** prix public par agenda (`proPriceCents` : 39 € le 1er + 15 € par agenda supplémentaire, annuel = 2 mois offerts), quantité Stripe = membres actifs (`syncSeats`), catalogue Stripe auto-provisionné (`ensureProPrice`), gratuit pour les clients, 0 % de commission par défaut (`newClientCommissionPercent = 0` ; si réactivée : 1er RDV honoré d'un nouveau client marketplace uniquement, jamais via `?via=pro`, facturée par le cron `billing`). Le bonus Pro n'agit que sur le tri « Pertinence » et porte toujours la mention « Mis en avant » (CGU § 6).
8. **Assistant IA usager :** il agit via des outils en lecture (recherche, disponibilités, mes RDV) et des liens ; il ne paie, ne réserve et n'annule jamais à la place de l'usager ; relais humain (`handoff_to_human`) pour litiges, remboursements, bugs.
9. **Mise en service automatique :** la prospection en `DRY_RUN=auto` reste en simulation tant que `/api/health/readiness` n'est pas entièrement vert.
10. **Discipline de périmètre & état persistant :** Code simple, modulaire, sans `// TODO` ni abstraction inutile. Mettre à jour `PROGRESS.md` après chaque phase validée.
