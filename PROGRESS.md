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
