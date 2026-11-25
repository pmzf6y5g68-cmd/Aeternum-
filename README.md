# Slotly — réservation en ligne autonome pour le detailing automobile

Page de réservation pour studios de detailing **fixes et mobiles** : prix par gabarit + options + frais kilométriques,
acomptes anti-lapin encaissés **directement sur le compte Stripe du studio** (Connect Express), rappels automatiques,
et une **boucle commerciale autonome** : Claude prospecte, envoie les emails, lit les réponses, répond dans le bon fil
avec un lien d'onboarding pré-rempli et escalade vers vous tout ce qui est sensible.

```
prospector.py (GitHub Actions) ──► Resend ──► prospect
        │ prospects + email_threads + email_messages (Message-ID)
        ▼                                         │ répond
     Supabase ◄── /api/webhooks/inbound-email ◄── Cloudflare Email Worker (postal-mime)
        ▲            garde-fous → Claude (outil strict) → Resend (In-Reply-To / References)
        │                                   └──► escalade OWNER_ALERT_EMAIL (fil + brouillon)
   /onboarding?prefill=… (HMAC) ──► studio créé ──► prospect « converted »
   /[slug] ──► create_booking_atomic ──► Stripe Checkout (compte Connect) ──► webhook
   crons : cleanup-pending · reminders · risk-check · rebooking · health-digest
```

## Stack

Next.js 16 (App Router, TypeScript strict) · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS, RPC) · Stripe Billing + Connect ·
Resend · Cloudflare Email Workers · API Anthropic (`@anthropic-ai/sdk`, `anthropic` Python) · Vitest · GitHub Actions.

## Développement

```bash
npm install
cp .env.example .env.local   # puis renseignez les valeurs
npm run dev
```

Vérifications (aussi exécutées par `.github/workflows/ci.yml`) :

```bash
npx tsc --noEmit
npm test
npm run build
python3 -m py_compile scripts/prospector.py
```

---

## Mise en production en 7 étapes

### 1. Supabase
1. Créez un projet (région UE).
2. **SQL Editor** → collez et exécutez `supabase/schema.sql` (idempotent : rejouable à chaque mise à jour).
3. **Authentication → URL Configuration** : *Site URL* = `https://votre-domaine.fr`, *Redirect URLs* = `https://votre-domaine.fr/auth/callback`.
4. **Authentication → Emails** : branchez le SMTP de Resend (étape 3) pour que les liens magiques partent de votre domaine.
5. Récupérez `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (*Project Settings → API*).

### 2. Stripe (abonnement Pro + Connect)
1. **Produits** : créez « Slotly Pro », prix récurrent **49 €/mois** → `STRIPE_PRICE_PRO_MONTHLY=price_…`.
2. **Connect** : activez Connect, type de compte **Express**, pays France.
3. **Billing → Customer portal** : activez le portail (résiliation, moyens de paiement, factures).
4. **Developers → Webhooks**, endpoint `https://votre-domaine.fr/api/webhooks/stripe`, créé **deux fois** :
   - *Événements de votre compte* : `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted` → `STRIPE_WEBHOOK_SECRET`.
   - *Événements des comptes connectés* : `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `account.updated` → `STRIPE_CONNECT_WEBHOOK_SECRET`.
5. `STRIPE_SECRET_KEY=sk_live_…`.

### 3. Resend (emails sortants + DNS)
1. Ajoutez votre domaine dans Resend et créez les enregistrements **SPF, DKIM et DMARC** demandés chez votre registrar / Cloudflare DNS.
2. `RESEND_API_KEY`, `EMAIL_FROM="Slotly <bonjour@votre-domaine.fr>"`, `EMAIL_REPLY_TO=bonjour@votre-domaine.fr`.
3. Les Message-ID sont fixés par l'application (`<uuid@APP_DOMAIN>`) et stockés : c'est la clé du threading Gmail / Outlook.

### 4. Cloudflare Email Routing + Worker (emails entrants)
```bash
cd workers/email-inbound
npm install
# APP_DOMAIN (et éventuellement FALLBACK_FORWARD) dans wrangler.toml
npx wrangler secret put INBOUND_SECRET     # même valeur que INBOUND_EMAIL_SECRET côté Next.js
npx wrangler deploy
```
Puis **Cloudflare → Email → Email Routing** : activez le routage (ajoute les MX), et créez une règle
`bonjour@votre-domaine.fr` → *Send to a Worker* → `slotly-email-inbound` (ou un *catch-all* vers le Worker).

> Le domaine d'envoi Resend et le domaine de réception peuvent être identiques : Resend n'utilise que SPF/DKIM
> (sous-domaine `send.`), les MX restent ceux de Cloudflare.

### 5. Vercel
1. Importez le dépôt, framework Next.js.
2. Renseignez **toutes** les variables de `.env.example` (sauf `SERPER_API_KEY`, `DRY_RUN`, `MAX_EMAILS_PER_DAY`, `PROSPECT_CITIES`, propres au robot).
   Générez les secrets longs avec `openssl rand -hex 32` : `INBOUND_EMAIL_SECRET`, `PREFILL_SECRET`, `CRON_SECRET`.
3. `ANTHROPIC_MODEL` vaut `claude-haiku-4-5` par défaut (rapide, économique) et reste configurable.
4. Mettez à jour `src/config/site.ts` (raison sociale, SIREN, adresse, email support) : pages légales et base de connaissances de l'agent en dépendent.

### 6. GitHub Secrets & Variables
*Settings → Secrets and variables → Actions*

| Secrets | Usage |
| --- | --- |
| `APP_URL` (ex. `https://votre-domaine.fr`), `CRON_SECRET` | `crons.yml` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SERPER_API_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY` | `prospector.yml` |

| Variables (optionnelles) | Défaut |
| --- | --- |
| `DRY_RUN` | `true` |
| `MAX_EMAILS_PER_DAY` | `25` |
| `PROSPECT_COUNTRY` (`FR`, `UK`, `US`) | `FR` |
| `PROSPECT_CITIES` | 20 grandes villes du pays |
| `ANTHROPIC_MODEL`, `APP_DOMAIN`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | voir `.env.example` |

Testez chaque cron via *Actions → Slotly crons → Run workflow* (le lancement manuel ajoute `?force=1`).

### 7. Passage `DRY_RUN=false`
1. Lancez *Actions → Slotly prospector → Run workflow* avec `dry_run = true` et relisez les emails générés dans les logs.
2. Envoyez-vous un email de test sur `bonjour@votre-domaine.fr` et vérifiez la réponse automatique dans le même fil.
3. Répondez « STOP » : le fil passe `stopped` sans réponse. Répondez « je veux un remboursement » : vous recevez l'escalade.
4. Créez la variable de dépôt **`DRY_RUN=false`**. Le robot tourne du lundi au vendredi (≤ 25 emails/jour, relance unique J+4).

---

## Contrats critiques (voir `CLAUDE.md`)

- **RLS multi-tenant** : un studio ne lit et ne modifie que ses lignes ; `plan` et colonnes Stripe ne sont modifiables
  que côté serveur (grants par colonne) ; prospects / fils email / journal sont réservés au `service_role`.
- **Acomptes** : charge directe sur le compte Connect du studio ; la plateforme n'encaisse jamais de fonds pour compte de tiers.
- **Zéro double réservation** : `create_booking_atomic` (`FOR UPDATE` sur le studio, quota gratuit 15 RDV/mois civil,
  chevauchement strict hors `pending_deposit` expirés > 20 min) après recalcul serveur du prix, de la durée et des frais km.
  Paiement arrivé après expiration : réactivation atomique si le créneau est libre, sinon remboursement automatique.
- **Agent email** : filtres déterministes avant toute IA (bounces, `Auto-Submitted`, `Precedence`, `X-Autoreply`, `List-Id`,
  adresses système), STOP traité en base sans réponse, plafond de 4 réponses par fil, escalade avec brouillon
  (jamais d'envoi au contact), sortie Claude validée par Zod puis post-traitée (≤ 110 mots, aucun lien inventé).
- **Géocodage gratuit** : Base Adresse Nationale puis Nominatim, distance Haversine × 1,25.

## Arborescence

```
src/app/                 pages (/, /login, /onboarding, /dashboard/*, /[slug], /confirm, /cancel, légal) + API
src/app/api/             distance · availability · bookings · stripe/* · webhooks/{stripe,inbound-email} · cron/*
src/lib/domain/          pricing · availability · time · geocode (purs, testés)
src/lib/ai/              email-guardrails · email-agent · knowledge · inbound-pipeline
src/lib/email/           send (Resend) · booking-emails · ics
src/i18n/                fr.ts (référence) · en.ts (même forme typée)
supabase/schema.sql      schéma, RLS, RPC
workers/email-inbound/   Cloudflare Email Worker
scripts/prospector.py    robot de prospection
__tests__/               Vitest (pricing, availability, guardrails + HMAC, agent)
```
