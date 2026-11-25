# PROGRESS — Rendez-vous

Refonte complète de Slotly (detailing uniquement) en **Rendez-vous** : plateforme universelle de prise de
rendez-vous, tous métiers hors médical, avec une ergonomie de marketplace (recherche « Quoi / Où »,
créneaux visibles dès les résultats, carte, fiche avec réservation pas à pas).

## R1 — Socle universel ✅
- `src/config/categories.ts` : 43 métiers dans 10 univers (beauté, bien-être, sport, auto, maison, animaux, cours,
  conseil, loisirs, services). Chaque métier définit ses modes (sur place / à domicile / visio), sa dimension de
  variante (longueur de cheveux, gabarit, taille de l'animal, surface, nombre de personnes…), sa capacité
  (cours collectifs, tables) et son catalogue de démarrage. Aucune catégorie médicale (vérifié par test).
- `supabase/schema.sql` (idempotent) : `businesses`, `staff`, `services` (variantes jsonb, capacité, modes),
  `addons`, `opening_hours`, `time_off`, `bookings`, `reviews`, `favorites`, `customer_profiles`, prospection,
  `system_events`. Index plein texte français + trigrammes (`unaccent`, `pg_trgm`), prix « à partir de » et notes
  dénormalisés par triggers. RPC `search_businesses` (texte, catégorie, ville, rayon, mode, prix, note, tris),
  `create_booking_atomic` (verrou, quota, attribution d'équipe, capacité, congés), `reactivate_paid_booking`,
  `claim_guest_bookings`, `increment_ai_reply_count`. RLS stricte + grants par colonne.
- Domaine pur : `pricing.ts` (variantes, places, modes, frais km, acompte), `availability.ts` (équipe, capacité,
  congés, plages multi-jours, répartition de charge), `catalog.ts`, `slug.ts`.
- `supabase/tests/` + `scripts/test-sql.sh` : schéma rejoué 2 fois puis 30+ assertions comportementales sur Postgres 16.

## R2 — Marketplace usager ✅
- Accueil : barre « Quoi / Où » avec autocomplétion (métiers instantanés + établissements via `/api/suggest`,
  communes via la Base Adresse Nationale, « Autour de moi »), métiers populaires, univers, fonctionnement.
- `/recherche`, `/[métier]`, `/[métier]/[ville]` : filtres (métier, disponibilité aujourd'hui / 3 j / semaine,
  lieu, prix max, distance, note), tris (pertinence, distance, disponibilité, prix, note), pagination, cartes avec
  4 jours de créneaux cliquables, carte OpenStreetMap synchronisée (pastilles de prix), bascule liste/carte mobile.
- Fiche `/[métier]/[ville]/[établissement]` : bandeau, favoris, partage, présentation, prestations et tarifs,
  équipe, infos pratiques (adresse, itinéraire, modes, paiement, politique d'annulation, horaires, carte), avis,
  JSON-LD LocalBusiness, URL canonique. Module de réservation fixe en 8 étapes repliables : prestation → variante →
  lieu (adresse + frais km) → avec qui (« peu importe » ou un membre) → options → places → semaine de créneaux
  (« voir plus d'horaires », « prochaine disponibilité ») → coordonnées pré-remplies + récap → confirmation ou acompte.
- APIs : `/api/slots`, `/api/distance`, `/api/bookings` (recalcul serveur intégral, rattachement au compte), `/api/favorites`.

## R3 — Compte usager ✅
- `/compte` : à venir / passés, ajout au calendrier (`/api/ics/[token]`), annulation selon la politique de
  l'établissement, reprise de rendez-vous, avis vérifiés ; `/compte/favoris`, `/compte/profil`.
- Connexion par lien magique ; à la connexion, les RDV pris en invité avec le même email sont rattachés.
- `/confirm/[token]`, `/cancel/[token]` (bouton POST anti-scanners), `/avis/[token]` (clients venus uniquement).

## R4 — Espace pro ✅
- `/pro` (landing), `/pro/inscription` (choix du métier avec recherche, prérempli par le lien signé de l'agent
  email, catalogue/horaires du métier créés en 1 clic, prospect → `converted`).
- `/pro/agenda` (jour/semaine, filtre par membre, KPI, actions 1 clic, réattribution), `/pro/prestations`
  (variantes, places, modes, options), `/pro/equipe`, `/pro/horaires` (horaires + congés/fermetures),
  `/pro/ma-page` (vitrine + règles : pas, délai, horizon, annulation, zone), `/pro/partager` (lien, QR, bouton
  site web, répondeur), `/pro/avis` (réponses publiques), `/pro/abonnement` (quota, Pro, portail, Connect, acomptes).

## R5 — Intégrations généralisées ✅
- Stripe (abonnement, portail, Connect Express, webhook double secret, paiement tardif réactivé ou remboursé).
- Crons : `cleanup-pending`, `reminders`, `risk-check`, `rebooking` (auto-« terminé » à +48 h, demandes d'avis
  vérifiés tous plans, fidélisation Pro), `health-digest`.
- Agent email : base de connaissances tous métiers, contexte `prospect` / `business`, lien `/pro/inscription?prefill=`
  signé incluant le métier. Garde-fous inchangés (filtres avant IA, STOP, plafond 4, escalade avec brouillon).
- `scripts/prospector.py` : 44 métiers × villes en rotation aléatoire, 34 outils concurrents détectés, rédaction
  adaptée au métier ; liste synchronisée avec le catalogue TS par `__tests__/prospector-sync.test.ts`.
- CI : job `sql` sur un service Postgres 16 en plus des 4 vérifications.

## R6 — Vérification ✅
- `npx tsc --noEmit` ✅ · `npm test` ✅ (97 tests) · `npm run build` ✅ (43 routes) · `python3 -m py_compile scripts/prospector.py` ✅
- `scripts/test-sql.sh` sur PostgreSQL 16 réel : « ALL SQL TESTS PASSED ».
- Serveur de production en HTTP : pages publiques 200, métier inconnu / établissement inconnu 404, `/compte` et
  `/pro/agenda` → `/login`, APIs invalides 400, crons/webhooks 401/400 sans secret, favoris anonymes 401.
- Captures desktop + mobile (accueil, autocomplétion, recherche, page métier, pro, inscription) : aucun débordement
  horizontal, aucune erreur JS.

### Non testé ici
- Parcours complet contre un vrai Supabase (PostgREST + Auth) : le téléchargement d'un binaire PostgREST a été
  refusé par le bac à sable. La logique SQL est testée directement sur Postgres, l'API Next.js par tests unitaires
  et HTTP. À valider sur le projet Supabase réel (README, étape 1).
- Appels réels Stripe / Resend / Anthropic / Serper et `wrangler deploy`.

## V1 — Multi-plateformes & fonctions anti-concurrence ✅
- Recherche publique (Doctolib, règles Gmail/Yahoo, CNIL) → liste d'attente, blocage des absences récurrentes,
  désinscription en 1 clic, interdiction des pixels de suivi en prospection.
- **PWA** : `manifest.ts` (raccourcis, display standalone/WCO), icônes PNG générées (`/icons/[size]`, maskable,
  apple-touch), `public/sw.js` (réseau d'abord, cache des assets versionnés, jamais d'API en cache), `/offline`,
  bannière d'installation (Android/Windows/macOS : bouton ; iOS : consigne), safe-area, en-têtes de sécurité.
- **Liste d'attente** : `waitlist_entries`, `POST /api/waitlist`, formulaire dans le module de réservation,
  `notifyWaitlistForSlot` appelé à chaque annulation (usager, pro) et expiration d'acompte.
- **Anti-absence** : `no_show_block_threshold` (défaut 2, réglable dans « Ma page »), refus `blocked_no_show`.
- **Synchronisation agenda** : flux iCalendar privé `/api/calendar/{token}.ics` (Google Agenda, Apple, Outlook),
  carte dans `/pro/agenda`, jeton régénérable.

## V2 — Prospection à grande échelle, délivrable ✅
- Débit : warm-up 40/jour × 1,3 par jour jusqu'à `MAX_EMAILS_PER_DAY` (1 500), lissé sur 5 exécutions/jour,
  freinage ×½ si rebonds ≥ 3 % ou plaintes ≥ 0,08 % sur 7 j, pause à 0,2 % (seuil Google 0,3 %).
- Découverte en lots de recherches, scraping/qualification parallélisés (`CONCURRENCY`), pause 2-6 s entre envois,
  reprise sur 429 Resend, vérification MX (dnspython), liste `email_suppressions` consultée avant chaque envoi.
- RFC 8058 : `List-Unsubscribe` (https + mailto) + `List-Unsubscribe-Post`, `POST /api/unsubscribe`, page
  `/desinscription`, jetons HMAC identiques TS/Python (vecteur partagé testé des deux côtés).
- `POST /api/webhooks/resend` (signature Svix) : rebonds permanents et plaintes → suppression + prospect stoppé ;
  `email_events` alimente le calcul du débit. STOP par email → suppression aussi.
- Bug corrigé : `already_known` interrogeait encore l'ancienne table `studios`.

## V3 — Vérification ✅
- `tsc` ✅ · `npm test` 102 ✅ · `build` ✅ · `py_compile` ✅ · `scripts/test_prospector.py` ✅ · `scripts/test-sql.sh` ✅
- HTTP : manifest, icônes 180/192/512/maskable, `sw.js` (en-têtes dédiés), `/offline`, désinscription, webhooks
  Resend non signé 401, calendrier inconnu 404 ; service worker enregistré dans Chromium, aucune erreur JS.

## W — Paiement, monétisation, assistant IA, autopilote ✅
- Recherche : assistants IA (Doctolib, Bank of America Erica), modèles économiques (Doctolib abonnement, Treatwell
  commission nouveaux clients, Uber Eats commissions + frais + publicité + abonnement).
- **Paiement intégré** : Stripe Embedded Checkout (`ui_mode: embedded_page`) sur le compte Connect, page `/paiement/[token]`
  (récap, compte à rebours du créneau tenu, carte / Apple Pay / Google Pay / PayPal / Link), retour `/paiement/[token]/retour`,
  domaine wallets enregistré automatiquement (`paymentMethodDomains`) quand le compte Connect est activé.
- **Monétisation** : `bookings.source` (marketplace / direct / assistant), commission plan Gratuit 20 % max 20 € sur le 1er RDV
  d'un nouveau client marketplace (365 j), 0 % via `?via=pro` (liens, QR et bouton du pro), cron `billing` (facture Stripe le 1er
  du mois, RDV honorés uniquement), bonus Pro étiqueté « Mis en avant » en tri pertinence, CGU mises à jour.
- **Assistant IA** (`/api/assistant`, widget global) : boucle d'outils Messages API (`claude-opus-5-5`, effort bas, fallbacks
  serveur), outils `search_businesses`, `get_availability`, `get_my_appointments`, `handoff_to_human`, cartes cliquables,
  limite 20 msg / 10 min / IP, 5 tours d'outils max puis conclusion forcée.
- **Autopilote** : `/api/health/readiness` (secrets, schéma, Stripe live + prix + webhook, domaine Resend vérifié, site en ligne),
  prospection `DRY_RUN=auto`, plafond étendu jusqu'à `HARD_MAX_EMAILS_PER_DAY` (6 000) si rebonds < 1 % et plaintes < 0,03 %,
  alerte « mise en service incomplète » dans le bilan de 20 h, workflow `db-migrate.yml`.
- Bug corrigé : dépassement numérique de la montée en charge après plusieurs années (`1.3 ** jours`).
- Vérifs : `tsc` ✅ · 111 tests ✅ · build ✅ · `py_compile` + `test_prospector.py` ✅ · SQL ✅ · HTTP (assistant 503 sans clé,
  readiness 401 / « non prêt » détaillé, pages paiement, cron billing 401) · captures assistant mobile/desktop sans erreur JS.

## X — Prix accepté par tous & référencement Google / IA ✅
- Recherche prix : Doctolib (~135–149 €/praticien, sans commission), Planity (devis, ~60–100 €, sans commission),
  Booksy (59 € HT + 10 €/collaborateur), Treatwell (commission 25–35 % très critiquée).
- **Tarification** : `src/lib/domain/plans.ts` — Pro 39 €/mois le 1er agenda + 15 €/agenda, annuel 2 mois offerts, 0 % de
  commission (`newClientCommissionPercent = 0`), gratuit pour les clients. `src/lib/stripe-catalog.ts` : produit, prix
  à paliers (`lookup_key`) et portail client créés automatiquement, quantité = membres actifs (`syncSeats`, au prorata),
  codes promo acceptés au checkout. Simulateur de prix sur `/pro`, choix mensuel/annuel dans l'abonnement, CGU dynamiques.
- **SEO / IA** : `src/lib/seo.ts` (types schema.org par métier, offres, horaires, avis, ReserveAction, FAQ factuelle),
  JSON-LD sur accueil / métiers / villes / fiches, `robots.ts` (22 robots moteurs + IA autorisés), `/sitemap.xml` + `/sitemaps/*`,
  `/llms.txt`, IndexNow (`/indexnow.txt`, ping à chaque création / modification), images OG par fiche, canoniques,
  vérification Search Console / Bing, RPC `category_stats`, colonne `businesses.updated_at`.
- Vérifs : `tsc` ✅ · 121 tests ✅ · build ✅ · SQL ✅ · HTTP : robots, sitemap index et parties, llms.txt, clé IndexNow,
  image OG, canoniques et types JSON-LD vérifiés.

## Y — Croissance, sécurité, prospection ✅
- **Visibilité des pros** (`/pro/visibilite`) : vues de fiche par jour sans cookie (`business_daily_stats`, RPC `track_business_view`,
  robots exclus), réservations, taux vues → RDV, CA réservé (30 j), score de visibilité /100 (`src/lib/visibility.ts`) avec
  actions classées par gain, rédaction de fiche assistée (`/api/pro/listing-copy`, outil strict, faits fournis uniquement,
  10 / jour, relecture avant publication + ping IndexNow), guide Google Business / site / avis.
- **Fiche publique** : FAQ factuelle visible + JSON-LD `FAQPage` (`businessFaq` : tarifs, horaires, lieu, paiement, annulation, avis).
- **Module de réservation intégrable** : `/widget/[slug]` (noindex, `frame-ancestors *` uniquement ici), `public/embed.js`
  (bouton flottant ou mode inline), réservations comptées « direct », paiement d'acompte ouvert dans un nouvel onglet.
- **Parrainage pro** : `?parrain=CODE` mémorisé 30 j, filleul rattaché à l'inscription, 1 mois offert aux deux au premier
  paiement (`invoice.paid`, crédit de solde Stripe idempotent, réservation atomique `referral_rewarded_at`), email au parrain.
- **Conversion** : alerte « un client n'a pas pu réserver » (quota atteint, 1 / semaine), cron `growth` 9 h (proposition Pro à
  80 % du quota, 1 / mois ; bilan mensuel du 1er au 3), relance paiement refusé (`invoice.payment_failed`).
- **Connexion** : Google, Apple, Microsoft, Facebook (`NEXT_PUBLIC_AUTH_PROVIDERS`), code à 6 chiffres par email en plus du lien.
- **Double authentification** : TOTP (`/compte/securite`, `/auth/mfa`), imposée par le proxy, `getOwnBusiness`/`getApiBusiness`
  **et la base** (`mfa_satisfied()` dans `owns_business` + politiques restrictives sur établissements, RDV, profils, favoris,
  liste d'attente) ; déconnexion de tous les appareils.
- **Sécurité** : HSTS preload, anti-clickjacking (`X-Frame-Options DENY` + `frame-ancestors 'none'` hors widget), COOP,
  `base-uri`/`object-src`, limitation de débit partagée en base (`hit_rate_limit`, IP hachée) sur réservation, liste d'attente,
  distance et assistant, purge par `cleanup-pending`.
- **Prospection** : envoi en heures ouvrées locales uniquement, 2ᵉ relance J+10 puis arrêt définitif, plafond par domaine
  destinataire et par exécution, rejet des tournures stéréotypées (réécriture), signature `SENDER_NAME`, prompt mis en cache.
- Vérifs : `tsc` ✅ · 125 tests ✅ · build ✅ · `py_compile` + `test_prospector.py` (8) ✅ · SQL (2FA aal1/aal2, vues, parrainage,
  droits) ✅ · HTTP : en-têtes de sécurité, CSP widget, `embed.js`, page de connexion (capture mobile).
