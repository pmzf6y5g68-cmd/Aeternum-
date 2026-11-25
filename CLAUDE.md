# CLAUDE.md — Slotly (SaaS Autonome Detailing Automobile)

## Vision
Slotly est un SaaS B2B autonome de réservation, tarification dynamique (gabarit + options + frais km) et acomptes anti-lapin pour les studios de **detailing automobile** (fixes et mobiles), conçu en français (`fr`) avec structure i18n prête pour l'anglais (`en`).
Le système est conçu pour tourner en autonomie complète : prospection sortante, réponses automatiques aux emails entrants par Claude, onboarding self-service, facturation Stripe et maintenance par crons.

## Stack & Commandes de Vérification
- **App & Webhooks :** Next.js (App Router, TypeScript strict), Tailwind CSS, Lucide Icons, Zod, Vitest.
- **Data & Auth :** Supabase (PostgreSQL, Auth, RLS stricte, fonctions RPC atomiques).
- **Paiements :** Stripe Subscriptions (Pro 49 €/mois) + Stripe Connect Express (acomptes encaissés directement par le studio).
- **Emails sortants & entrants :** Resend (sortant) + Cloudflare Email Worker (`workers/email-inbound/`) -> `/api/webhooks/inbound-email` (entrant).
- **IA & Prospection :** API Anthropic (`@anthropic-ai/sdk` côté Next.js avec Tool Use / Structured Outputs stricts, `anthropic` côté Python) + GitHub Actions.

Exécute ces 4 vérifications après chaque bloc majeur de modifications :
- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- `python3 -m py_compile scripts/prospector.py`

## Contrats Critiques & Raisons Métier
1. **Isolation multi-tenant (RLS) :** Chaque studio accède uniquement à ses lignes (`auth.uid() = owner_id`). Les endpoints publics exposent uniquement les infos publiques du studio et ses disponibilités, car les coordonnées des clients finaux sont privées.
2. **Acomptes via Stripe Connect Express uniquement :** L'acompte client part sur le compte Connect du detailer afin que la plateforme n'encaisse jamais de fonds pour compte de tiers. L'inscription reste utilisable immédiatement sans Connect (paiement sur place), puis le studio active Connect en 1 clic.
3. **Zéro double réservation :** Toute création de RDV passe par `create_booking_atomic` (`FOR UPDATE` sur le studio) en recalculant prix, durée et frais km exclusivement côté serveur.
4. **Garde-fous absolus de l'agent email autonome :**
   - Filtrer avant tout appel IA les en-têtes automatiques (`Auto-Submitted`, `Precedence: bulk|list|auto_reply`, `X-Autoreply`) et adresses système (`noreply`, `mailer-daemon`, `postmaster`) pour éviter toute boucle infinie entre bots.
   - Traiter immédiatement tout mot-clé d'arrêt (`stop`, `désinscrire`, `unsubscribe`) de façon déterministe en base (`status = 'stopped'`) sans envoyer de réponse.
   - Plafonner les réponses automatiques à `4` échanges par fil (`ai_reply_count >= 4`) et escalader vers `OWNER_ALERT_EMAIL` (avec brouillon proposé, sans envoi automatique) dès qu'il s'agit d'un litige, d'une menace légale, d'un remboursement ou d'un bug technique non résolu.
   - L'agent IA ne doit jamais inventer de remise commerciale, de fonctionnalité inexistante ou de promesse contractuelle hors des faits fournis dans son contexte système.
5. **Géocodage gratuit :** `https://api-adresse.data.gouv.fr/search/` avec fallback Nominatim + Haversine `* 1.25` pour maintenir un coût d'infra nul.
6. **Discipline de périmètre & état persistant :** Code simple, modulaire, sans `// TODO` ni abstraction inutile. Mettre à jour `PROGRESS.md` après chaque phase validée.
