# PROGRESS — Slotly

## Phase 1 — Socle, Base & Tests Domaine ✅
- Next.js 16 (App Router, TS strict + `noUncheckedIndexedAccess`), Tailwind v4, Vitest.
- `.env.example`, `src/config/site.ts`, `src/i18n/{fr,en,index}.ts` (même forme typée `Dictionary`).
- `supabase/schema.sql` idempotent : 8 tables + `system_events`, enums, index, RLS stricte
  (studios/services/addons/opening_hours/bookings via `owner_id`, tables prospection service_role only),
  grants colonne par colonne (le studio ne peut pas modifier plan / Stripe), RPC `create_booking_atomic`
  (`FOR UPDATE`, quota free 15/mois civil Paris, chevauchement strict en ignorant les `pending_deposit` > 20 min),
  `reactivate_paid_booking`, `increment_ai_reply_count`.
- Clients Supabase : `admin.ts` (service_role), `server.ts` (session), `browser.ts`, `src/proxy.ts`.
- Domaine pur : `pricing.ts`, `availability.ts`, `time.ts` (Europe/Paris sans dépendance), `geocode.ts` (BAN + Nominatim).
- Garde-fous : `src/lib/ai/email-guardrails.ts`, jeton HMAC `src/lib/prefill.ts`.
- Utilitaires : `src/lib/email/send.ts` (Resend + Message-ID/In-Reply-To/References), `ics.ts`, `stripe.ts`, `events.ts`.
- `npm test` : 65 tests verts (pricing, availability, email-guardrails + prefill HMAC).

## Phase 2 — Expérience Pro & Onboarding Pré-rempli ✅
- `/` : landing B2B (hero, calculateur interactif CA sauvé lapins + upsell, tunnel en 4 étapes, features, tarifs Gratuit 15 RDV / Pro 49 € 14 j offerts).
- `/login` : lien magique Supabase (`signInWithOtp`) + `/auth/callback` (échange PKCE, `next` sécurisé).
- `/onboarding` : décodage HMAC `?prefill=` (nom, ville, email), conservation du jeton à travers le login,
  création serveur (service_role) du studio + géocodage BAN/Nominatim + slug unique + 4 prestations (tarifs par gabarit),
  4 options, horaires standard ; `prospects.status = 'converted'` et rattachement des `email_threads`.
- `/dashboard` : agenda jour/semaine (badges Acompte payé / Confirmé / En attente / À risque / Terminé, véhicule, options,
  lien Maps, actions 1 clic + email d'annulation au client), `/share` (lien, QR code téléchargeable, script répondeur,
  guides Google Maps / Instagram), `/services` (CRUD prestations + prix/durée par gabarit, options, zone mobile, horaires),
  `/billing` (quota mensuel, upgrade Pro, Customer Portal, Stripe Connect, réglages d'acompte).
- Emails transactionnels : `src/lib/email/booking-emails.ts`.
- `tsc`, `npm test`, `npm run build` verts.
