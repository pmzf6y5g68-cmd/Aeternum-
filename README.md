# Rendez-vous — tous vos rendez-vous, au même endroit

Plateforme universelle de prise de rendez-vous en ligne pour **tous les métiers hors médical** : coiffeurs, barbiers,
instituts, masseurs, coachs, studios de yoga, garages, auto-écoles, plombiers, serruriers, toiletteurs, profs
particuliers, avocats, notaires, agences immobilières, restaurants, escape games, photographes… (43 métiers, 10 univers).

**Pour l'usager** : une seule app. Il tape un nom, une prestation ou un métier + un lieu (ou « Autour de moi »),
filtre par disponibilité, lieu (sur place / à domicile / visio), prix, distance et note, trie, voit les prochains
créneaux directement dans les résultats et sur la carte, puis réserve en quelques clics. « Mes rendez-vous » :
annulation, calendrier, reprise de RDV, favoris, avis vérifiés.

**Pour le professionnel** : page publique créée en 60 secondes avec le catalogue de son métier, agenda d'équipe sans
double réservation, prix par variante, options, cours collectifs/tables, déplacements facturés au km, congés,
acomptes anti-absence versés sur **son propre** compte Stripe, rappels, avis, fidélisation.

**En autonomie** : Claude prospecte les professionnels sans outil de réservation, lit leurs réponses, répond dans le
bon fil avec un lien d'inscription pré-rempli et escalade vers vous ce qui est sensible ; les crons font le reste.

```
Usager ─► /  /recherche  /{métier}/{ville}  ─► /{métier}/{ville}/{établissement} ─► /api/bookings ─► create_booking_atomic
                                                                                     └► Stripe Checkout (compte Connect du pro)
Pro ─► /pro/inscription ─► /pro/agenda · prestations · équipe · horaires · ma-page · partager · avis · abonnement
prospector.py ─► Resend ─► pro ─► Cloudflare Email Worker ─► /api/webhooks/inbound-email ─► garde-fous ─► Claude ─► réponse / escalade
crons : cleanup-pending · reminders · risk-check · rebooking (avis + fidélisation) · health-digest
```

## Stack

Next.js 16 (App Router, TypeScript strict) · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS, RPC, FTS + trigrammes) ·
Stripe Billing + Connect · Resend · Cloudflare Email Workers · Leaflet + OpenStreetMap · API Anthropic · Vitest · GitHub Actions.

## Développement

```bash
npm install
cp .env.example .env.local   # renseignez les valeurs
npm run dev
```

Vérifications (exécutées aussi par `.github/workflows/ci.yml`) :

```bash
npx tsc --noEmit
npm test
npm run build
python3 -m py_compile scripts/prospector.py
PGHOST=localhost PGUSER=postgres scripts/test-sql.sh   # schéma ×2 + tests SQL (Postgres 16)
```

Ajouter un métier : une entrée dans `src/config/categories.ts` (+ la ligne correspondante dans
`PROSPECT_CATEGORIES` de `scripts/prospector.py`, vérifiée par un test).

---

## Mise en production en 7 étapes

### 1. Supabase
1. Créez un projet (région UE). **SQL Editor** → exécutez `supabase/schema.sql` (idempotent, rejouable).
2. **Authentication → URL Configuration** : *Site URL* = `https://votre-domaine`, *Redirect URLs* = `https://votre-domaine/auth/callback`.
3. **Authentication → Emails** : branchez le SMTP de Resend (étape 3) pour que les liens de connexion partent de votre domaine.
4. Récupérez `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### 2. Stripe (abonnement Pro + Connect)
1. Rien à créer pour l'abonnement : produit, prix et portail sont provisionnés automatiquement.
2. Activez **Connect** (comptes **Express**, France) et le **Customer portal**.
3. Webhook `https://votre-domaine/api/webhooks/stripe`, créé **deux fois** :
   - *Votre compte* : `checkout.session.completed`, `customer.subscription.created|updated|deleted` → `STRIPE_WEBHOOK_SECRET`.
   - *Comptes connectés* : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `account.updated` → `STRIPE_CONNECT_WEBHOOK_SECRET`.
4. `STRIPE_SECRET_KEY`.

### 3. Resend (emails sortants)
Ajoutez le domaine, créez les enregistrements **SPF, DKIM, DMARC** (`p=quarantine` au minimum), puis `RESEND_API_KEY`,
`EMAIL_FROM`, `EMAIL_REPLY_TO`. **Webhooks** → `https://votre-domaine/api/webhooks/resend` avec les événements
`email.delivered`, `email.bounced`, `email.complained` → `RESEND_WEBHOOK_SECRET`. Inscrivez le domaine sur
[Google Postmaster Tools](https://postmaster.google.com) pour suivre le taux de plaintes.
Les Message-ID sont fixés par l'application (`<uuid@APP_DOMAIN>`) pour garder les fils Gmail / Outlook.

### 4. Cloudflare Email Routing + Worker (emails entrants)
```bash
cd workers/email-inbound && npm install
npx wrangler secret put INBOUND_SECRET     # même valeur que INBOUND_EMAIL_SECRET
npx wrangler deploy                        # APP_DOMAIN dans wrangler.toml
```
**Email Routing** : activez-le puis routez `bonjour@votre-domaine` (ou un catch-all) vers le Worker `rdv-email-inbound`.

### 5. Vercel
Importez le dépôt, renseignez les variables de `.env.example` (secrets longs : `openssl rand -hex 32` pour
`INBOUND_EMAIL_SECRET`, `PREFILL_SECRET`, `CRON_SECRET`). `ANTHROPIC_MODEL` vaut `claude-haiku-4-5` par défaut.
Complétez `src/config/site.ts` (raison sociale, SIREN, adresse) : pages légales et agent email en dépendent.

### 6. GitHub Secrets & Variables
| Secrets | Usage |
| --- | --- |
| `APP_URL`, `CRON_SECRET` | `crons.yml` |
| `APP_URL`, `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SERPER_API_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `UNSUBSCRIBE_SECRET` | `prospector.yml` |
| `SUPABASE_DB_URL` (chaîne de connexion Postgres) | `db-migrate.yml` |

| Variables (optionnelles) | Défaut |
| --- | --- |
| `DRY_RUN` | `auto` |
| `MAX_EMAILS_PER_DAY` / `HARD_MAX_EMAILS_PER_DAY` | `1500` / `6000` (extension +25 %/semaine si santé excellente) |
| `WARMUP_START` / `WARMUP_GROWTH` | `40` / `1.3` (≈ plafond atteint en 14 jours ouvrés si la santé est bonne) |
| `CONCURRENCY` / `MAX_SEARCHES_PER_RUN` | `8` / auto |
| `PROSPECT_CATEGORIES` (slugs séparés par des virgules) | tous les métiers |
| `PROSPECT_CITIES` / `PROSPECT_COUNTRY` | 20 grandes villes / `FR` |

Testez chaque cron via *Actions → Rendez-vous crons → Run workflow* (`?force=1` ajouté automatiquement).

### 7. Passage `DRY_RUN=false`
1. *Actions → Rendez-vous prospector → Run workflow* avec `dry_run = true` : relisez les emails générés.
2. Écrivez à `bonjour@votre-domaine` : réponse automatique dans le même fil. Répondez « STOP » : fil `stopped`
   sans réponse. Parlez de remboursement : escalade reçue avec brouillon.
3. Créez la variable de dépôt **`DRY_RUN=false`**. Le robot tourne 5 fois par jour ouvré, démarre à 40 emails/jour
   et augmente de 30 % par jour tant que rebonds < 3 % et plaintes < 0,08 % ; au-delà il divise le débit par deux,
   et se met en pause à 0,2 % de plaintes (alerte dans le bilan de 20 h). Relance unique J+4.

### Monter au-delà de 1 500 emails/jour
Gmail et Yahoo bloquent un domaine qui envoie en masse sans engagement. Pour passer à plusieurs milliers par
jour : laissez le warm-up atteindre le plafond avec des taux sains, vérifiez Google Postmaster (réputation
« High »), puis relevez `MAX_EMAILS_PER_DAY` par paliers (+50 % par semaine). Le robot n'utilise volontairement
ni rotation de domaines, ni listes achetées, ni pixels de suivi : ce sont les pratiques qui font blacklister.

## Ce qui est automatique, ce qui reste à faire une fois

**Une seule fois (comptes à votre nom, impossible à créer à votre place)** : créer les comptes Supabase, Stripe
(activation live, KYC), Resend (DNS), Cloudflare, Vercel, nom de domaine, et coller les clés (étapes 1 à 6).

**Ensuite, tout tourne seul** :
- déploiement Vercel à chaque push (intégration GitHub de Vercel) et migration SQL automatique (`db-migrate.yml`, secret `SUPABASE_DB_URL`) ;
- `/api/health/readiness` vérifie chaque jour paiements live, prix Pro, webhooks, domaine d'envoi, schéma, secrets ;
  le bilan de 20 h vous dit exactement ce qui manque ;
- la prospection (`DRY_RUN=auto`) **démarre seule** en envoi réel dès que tout est vert, monte en charge, freine seule ;
- rappels, alertes, avis, fidélisation, liste d'attente, facturation des commissions, réponses email par Claude.

## Paiement intégré
L'acompte se paie **sur le site** (Stripe Embedded Checkout, compte Connect du pro) : carte, Apple Pay, Google Pay,
PayPal, Link, Bancontact… Dans Stripe → *Paramètres → Moyens de paiement* → **Comptes connectés**, activez ceux que
vous voulez proposer (PayPal requiert l'éligibilité du compte). Le domaine Apple Pay / Google Pay est enregistré
automatiquement sur chaque compte connecté. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` obligatoire.

## Référencement Google et assistants IA
Tout est automatique côté code :
- **Données structurées schema.org exactes** : type précis par métier (HairSalon, AutoRepair, Attorney, Restaurant…),
  prestations et fourchettes de prix, horaires (pauses comprises), zone d'intervention, avis vérifiés, note,
  action « Réserver » ; Organization + WebSite + recherche interne sur l'accueil ; fil d'Ariane, liste et FAQ
  factuelle (chiffres réels : nombre d'établissements, prix d'entrée, domicile, visio, notes) sur chaque page
  métier et métier × ville.
- **Sitemaps** : `/sitemap.xml` (index) → pages fixes + 43 métiers, toutes les combinaisons métier × ville, fiches
  par lots de 40 000, avec date de dernière modification.
- **robots.txt** : Googlebot, Bingbot, Applebot, GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot,
  PerplexityBot, Google-Extended… explicitement autorisés ; espaces privés exclus.
- **`/llms.txt`** : guide factuel du site pour les assistants IA (structure des URL, lien direct `#reserver`).
- **IndexNow** : chaque création / modification de fiche est signalée instantanément à Bing (Copilot), Yandex…
- **Images de partage** générées pour chaque fiche, URL canoniques, métadonnées complètes.

À faire **une fois** (comptes à votre nom) : Google Search Console et Bing Webmaster Tools → ajouter le domaine
(codes `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`), soumettre `https://votre-domaine/sitemap.xml` ;
générer `INDEXNOW_KEY` (`openssl rand -hex 16`). `NEXT_PUBLIC_APP_URL` doit être défini **avant** le build.
Chaque pro est guidé (onglet « Partager ») pour ajouter son lien « Réserver » sur sa fiche Google.

## Modèle économique
Calé sur ce que le marché accepte : **abonnement, prix public, zéro commission** (Doctolib ~135–149 €/praticien,
Planity sur devis, Booksy 59 € HT + 10 €/collaborateur ; les commissions type Treatwell sont le premier reproche des pros).

| Offre | Prix | Pour qui |
| --- | --- | --- |
| Gratuit | 0 €, sans carte, 30 RDV/mois, 0 % de commission | essayer, petits volumes |
| Pro | **39 €/mois** le 1er agenda + **15 €** par agenda supplémentaire ; annuel 390 € + 150 € (2 mois offerts) | indépendants → équipes |
| Clients | **toujours gratuit** | tout le monde |

Le catalogue Stripe (produit, prix mensuel / annuel à paliers par agenda, portail client) est créé automatiquement ;
le nombre d'agendas facturés suit l'équipe active (au prorata). Leviers optionnels désactivés par défaut :
commission nouveaux clients (`newClientCommissionPercent`), frais sur acompte (`PLATFORM_DEPOSIT_FEE_PERCENT`).

## Assistant IA
Bouton « Assistant » sur toutes les pages publiques (plein écran sur mobile). Il cherche, montre de vrais
créneaux cliquables, prépare la réservation, lit « Mes rendez-vous » et passe la main à l'équipe pour les litiges.
Modèle : `ASSISTANT_MODEL` (défaut `claude-opus-5-5`, effort bas pour la réactivité, repli automatique en cas de refus).

## Application (iPhone, Android, Windows, macOS)
Rendez-vous est une web app installable (manifest, icônes, service worker, page hors ligne) :
Android / Chrome / Edge proposent « Installer » ; sur iPhone : Partager → « Sur l'écran d'accueil » (une bannière le
rappelle). Les pros peuvent abonner Google Agenda, Apple Calendrier ou Outlook à leur agenda depuis `/pro/agenda`.

---

## Contrats critiques (voir `CLAUDE.md`)
- **RLS** : chaque établissement ne voit que ses données, chaque usager que ses RDV/favoris/profil ; plan, Stripe,
  notes et index de recherche ne sont modifiables que côté serveur ; prospection réservée au `service_role`.
- **Acomptes** : charge directe sur le compte Connect du professionnel, jamais de fonds pour compte de tiers.
- **Zéro double réservation** : `create_booking_atomic` (verrou, quota gratuit 30 RDV/mois, équipe, capacité,
  congés, `pending_deposit` > 20 min ignorés) après recalcul serveur de tout le devis et du créneau exact.
- **Avis vérifiés** : un avis par rendez-vous honoré, classement des résultats transparent (CGU § 6).
- **Prospection** : warm-up + freinage automatique, suppression, MX, désinscription 1 clic, pas de traçage.
- **Liste d'attente & anti-absence** : créneau libéré → alerte aux inscrits ; réservation bloquée après N absences.
- **Agent email** : filtres déterministes avant IA, STOP en base sans réponse, 4 réponses max par fil, escalade
  avec brouillon, sortie Claude validée par Zod puis post-traitée (≤ 110 mots, aucun lien inventé).
- **Coût d'infra nul** pour la géo : Base Adresse Nationale + Nominatim, Haversine × 1,25, tuiles OpenStreetMap.
