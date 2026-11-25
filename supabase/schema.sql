-- =====================================================================
-- Rendez-vous — schéma Supabase complet (idempotent : peut être rejoué)
-- Plateforme universelle de prise de rendez-vous (hors médical).
-- =====================================================================
create extension if not exists pgcrypto;
-- Supabase installe les extensions dans le schéma « extensions ».
create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------
do $$ begin create type business_plan as enum ('free', 'pro'); exception when duplicate_object then null; end $$;
do $$ begin create type location_type as enum ('on_site', 'at_home', 'online'); exception when duplicate_object then null; end $$;
do $$ begin
  create type booking_status as enum ('pending_deposit', 'scheduled', 'confirmed', 'at_risk', 'completed', 'cancelled', 'no_show');
exception when duplicate_object then null; end $$;
do $$ begin
  create type prospect_status as enum ('new', 'disqualified', 'sent', 'replied', 'ooo_paused', 'converted', 'stopped', 'error');
exception when duplicate_object then null; end $$;
do $$ begin create type thread_status as enum ('open', 'ai_handled', 'escalated', 'stopped'); exception when duplicate_object then null; end $$;
do $$ begin create type message_direction as enum ('outbound', 'inbound'); exception when duplicate_object then null; end $$;

-- unaccent() n'est pas IMMUTABLE : wrapper requis pour les index.
create or replace function public.norm(p text) returns text
language sql immutable parallel safe
as $$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, ''))) $$;

-- ---------------------------------------------------------------------
-- Établissements
-- ---------------------------------------------------------------------
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,58}[a-z0-9])$'),
  name text not null,
  category text not null,
  tagline text,
  description text,
  email text not null,
  phone text,
  website text,
  address text,
  postal_code text,
  city text,
  city_slug text,
  lat double precision,
  lng double precision,
  modes location_type[] not null default '{on_site}',
  cover_url text,
  highlights text[] not null default '{}',
  payment_methods text[] not null default '{}',
  free_radius_km numeric(6,2) not null default 10 check (free_radius_km >= 0),
  max_radius_km numeric(6,2) not null default 30 check (max_radius_km >= 0),
  price_per_extra_km numeric(6,2) not null default 1 check (price_per_extra_km >= 0),
  travel_buffer_minutes integer not null default 30 check (travel_buffer_minutes between 0 and 240),
  slot_step_minutes integer not null default 30 check (slot_step_minutes in (10, 15, 20, 30, 45, 60)),
  min_lead_minutes integer not null default 120 check (min_lead_minutes between 0 and 20160),
  max_days_ahead integer not null default 60 check (max_days_ahead between 1 and 365),
  cancellation_hours integer not null default 24 check (cancellation_hours between 0 and 336),
  deposit_enabled boolean not null default false,
  deposit_percent integer not null default 30 check (deposit_percent between 5 and 100),
  plan business_plan not null default 'free',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_connect_account_id text unique,
  stripe_connect_onboarded boolean not null default false,
  rebooking_days integer not null default 60 check (rebooking_days between 7 and 730),
  published boolean not null default true,
  min_price_eur numeric(10,2),
  rating_avg numeric(3,2) not null default 0,
  rating_count integer not null default 0,
  search_tsv tsvector,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  created_at timestamptz not null default now()
);
create index if not exists businesses_owner_idx on public.businesses (owner_id);
create index if not exists businesses_category_city_idx on public.businesses (category, city_slug) where published;
create index if not exists businesses_search_idx on public.businesses using gin (search_tsv);
create index if not exists businesses_name_trgm_idx on public.businesses using gin (public.norm(name) extensions.gin_trgm_ops);
create index if not exists businesses_geo_idx on public.businesses (lat, lng) where published;
create index if not exists businesses_email_idx on public.businesses (lower(email));

-- Membres de l'équipe : chaque membre est une ressource qui prend un rendez-vous à la fois.
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  title text,
  service_ids uuid[] not null default '{}', -- vide = toutes les prestations
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists staff_business_idx on public.staff (business_id);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  price_eur numeric(10,2) not null check (price_eur >= 0),
  duration_minutes integer not null check (duration_minutes between 5 and 1440),
  -- [{ "key": "longs", "label": "Cheveux longs", "price_eur": 60, "duration_minutes": 75 }]
  variants jsonb not null default '[]'::jsonb check (jsonb_typeof(variants) = 'array'),
  capacity integer not null default 1 check (capacity between 1 and 500),
  modes location_type[] not null default '{}', -- vide = tous les modes de l'établissement
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists services_business_idx on public.services (business_id);

create table if not exists public.addons (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  price_eur numeric(10,2) not null check (price_eur >= 0),
  duration_minutes integer not null default 0 check (duration_minutes between 0 and 600),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists addons_business_idx on public.addons (business_id);

create table if not exists public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  open_time time,
  close_time time,
  break_start time,
  break_end time,
  is_closed boolean not null default false,
  unique (business_id, day_of_week)
);

-- Congés, fermetures exceptionnelles, indisponibilités d'un membre.
create table if not exists public.time_off (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade, -- null = tout l'établissement
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index if not exists time_off_business_idx on public.time_off (business_id, start_at);

-- ---------------------------------------------------------------------
-- Usagers
-- ---------------------------------------------------------------------
create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  default_address text,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, business_id)
);

-- ---------------------------------------------------------------------
-- Rendez-vous
-- ---------------------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  staff_id uuid references public.staff(id) on delete set null,
  service_name text not null,
  variant_key text,
  variant_label text,
  addon_ids uuid[] not null default '{}',
  seats integer not null default 1 check (seats between 1 and 500),
  location_type location_type not null default 'on_site',
  client_address text,
  distance_km numeric(8,2),
  travel_fee_eur numeric(10,2) not null default 0,
  total_price_eur numeric(10,2) not null,
  deposit_amount_eur numeric(10,2) not null default 0,
  deposit_paid boolean not null default false,
  stripe_checkout_session_id text unique,
  client_user_id uuid references auth.users(id) on delete set null,
  client_name text not null,
  client_email text not null,
  client_phone text,
  client_notes text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status booking_status not null default 'scheduled',
  cancelled_by text check (cancelled_by in ('client', 'business', 'system')),
  confirm_token uuid not null default gen_random_uuid() unique,
  reminder_sent boolean not null default false,
  risk_alert_sent boolean not null default false,
  rebooking_sent boolean not null default false,
  review_requested boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index if not exists bookings_business_start_idx on public.bookings (business_id, start_at);
create index if not exists bookings_status_start_idx on public.bookings (status, start_at);
create index if not exists bookings_client_idx on public.bookings (client_user_id, start_at desc);
create index if not exists bookings_client_email_idx on public.bookings (lower(client_email));
create index if not exists bookings_pending_idx on public.bookings (created_at) where status = 'pending_deposit';

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1500),
  reply text check (char_length(reply) <= 1500),
  created_at timestamptz not null default now()
);
create index if not exists reviews_business_idx on public.reviews (business_id, created_at desc);

-- ---------------------------------------------------------------------
-- Prospection & fils email (service_role uniquement)
-- ---------------------------------------------------------------------
create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  website text unique,
  email text unique,
  city text,
  country text not null default 'FR',
  phone text,
  detected_booking_tool text,
  status prospect_status not null default 'new',
  followup_count integer not null default 0,
  next_followup_at timestamptz,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists prospects_followup_idx on public.prospects (next_followup_at) where status = 'sent';

create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  contact_email text not null,
  prospect_id uuid references public.prospects(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  subject text,
  status thread_status not null default 'open',
  ai_reply_count integer not null default 0,
  last_message_id text,
  references_chain text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists email_threads_contact_idx on public.email_threads (contact_email, updated_at desc);
create index if not exists email_threads_status_idx on public.email_threads (status, updated_at desc);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  direction message_direction not null,
  from_email text not null,
  to_email text not null,
  message_id text unique,
  in_reply_to text,
  body_text text,
  ai_intent text,
  created_at timestamptz not null default now()
);
create index if not exists email_messages_thread_idx on public.email_messages (thread_id, created_at);

create table if not exists public.system_events (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'error' check (level in ('info', 'warning', 'error')),
  source text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists system_events_created_idx on public.system_events (created_at desc);

-- ---------------------------------------------------------------------
-- Évolutions (idempotentes) : anti-absence, synchronisation calendrier, liste d'attente, délivrabilité
-- ---------------------------------------------------------------------
alter table public.businesses add column if not exists no_show_block_threshold integer not null default 2
  check (no_show_block_threshold between 0 and 10);
alter table public.businesses add column if not exists calendar_token uuid not null default gen_random_uuid();
create unique index if not exists businesses_calendar_token_idx on public.businesses (calendar_token);
create index if not exists bookings_noshow_idx on public.bookings (business_id, lower(client_email)) where status = 'no_show';

-- Monétisation : origine du client et commission « nouveau client marketplace » (plan Gratuit).
alter table public.bookings add column if not exists source text not null default 'marketplace' check (source in ('marketplace', 'direct', 'assistant'));
alter table public.bookings add column if not exists commission_eur numeric(10,2) not null default 0 check (commission_eur >= 0);
alter table public.bookings add column if not exists commission_invoiced boolean not null default false;
create index if not exists bookings_commission_idx on public.bookings (business_id) where commission_eur > 0 and not commission_invoiced;

-- Liste d'attente : prévenue par email dès qu'un créneau se libère (annulation, acompte expiré).
create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid references public.services(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  date_from date not null,
  date_to date not null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  check (date_to >= date_from and date_to <= date_from + 31)
);
create index if not exists waitlist_business_idx on public.waitlist_entries (business_id, date_from, date_to) where notified_at is null;
create unique index if not exists waitlist_unique_idx on public.waitlist_entries (business_id, lower(email), coalesce(service_id, '00000000-0000-0000-0000-000000000000'::uuid), date_from);

-- Désinscriptions, bounces et plaintes : plus aucun envoi de prospection vers ces adresses.
create table if not exists public.email_suppressions (
  email text primary key check (email = lower(email)),
  reason text not null check (reason in ('unsubscribe', 'bounce', 'complaint', 'manual')),
  created_at timestamptz not null default now()
);

alter table public.email_messages add column if not exists provider_id text;
create index if not exists email_messages_provider_idx on public.email_messages (provider_id);

-- Événements renvoyés par Resend (délivré, rebond, plainte) : pilotent le débit de prospection.
create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  provider_id text,
  email text,
  type text not null,
  created_at timestamptz not null default now()
);
create index if not exists email_events_type_created_idx on public.email_events (type, created_at desc);

-- ---------------------------------------------------------------------
-- Dénormalisations : index de recherche, prix « à partir de », notes
-- ---------------------------------------------------------------------
create or replace function public.refresh_business_listing(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_services text;
  v_min numeric;
begin
  select string_agg(s.name || ' ' || coalesce(s.description, ''), ' '),
         min(least(s.price_eur, coalesce((select min((v->>'price_eur')::numeric) from jsonb_array_elements(s.variants) v), s.price_eur)))
    into v_services, v_min
    from public.services s
   where s.business_id = p_business_id and s.active;

  update public.businesses b
     set min_price_eur = v_min,
         search_tsv =
           setweight(to_tsvector('french', public.norm(b.name)), 'A') ||
           setweight(to_tsvector('french', public.norm(b.category || ' ' || coalesce(b.tagline, ''))), 'B') ||
           setweight(to_tsvector('french', public.norm(coalesce(v_services, ''))), 'B') ||
           setweight(to_tsvector('french', public.norm(coalesce(b.city, '') || ' ' || coalesce(b.description, ''))), 'C')
   where b.id = p_business_id;
end;
$$;

create or replace function public.trg_services_listing() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.refresh_business_listing(coalesce(new.business_id, old.business_id));
  return null;
end;
$$;
drop trigger if exists services_listing on public.services;
create trigger services_listing after insert or update or delete on public.services
  for each row execute function public.trg_services_listing();

create or replace function public.trg_businesses_listing() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.name is distinct from old.name or new.category is distinct from old.category
     or new.tagline is distinct from old.tagline or new.description is distinct from old.description
     or new.city is distinct from old.city then
    perform public.refresh_business_listing(new.id);
  end if;
  return null;
end;
$$;
drop trigger if exists businesses_listing on public.businesses;
create trigger businesses_listing after insert or update on public.businesses
  for each row execute function public.trg_businesses_listing();

create or replace function public.trg_reviews_rating() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_id uuid := coalesce(new.business_id, old.business_id);
begin
  update public.businesses b
     set rating_avg = coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r where r.business_id = v_id), 0),
         rating_count = (select count(*) from public.reviews r where r.business_id = v_id)
   where b.id = v_id;
  return null;
end;
$$;
drop trigger if exists reviews_rating on public.reviews;
create trigger reviews_rating after insert or update or delete on public.reviews
  for each row execute function public.trg_reviews_rating();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.businesses enable row level security;
alter table public.staff enable row level security;
alter table public.services enable row level security;
alter table public.addons enable row level security;
alter table public.opening_hours enable row level security;
alter table public.time_off enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;
alter table public.prospects enable row level security;
alter table public.email_threads enable row level security;
alter table public.email_messages enable row level security;
alter table public.system_events enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.email_suppressions enable row level security;
alter table public.email_events enable row level security;

create or replace function public.owns_business(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.businesses b where b.id = p_business_id and b.owner_id = auth.uid()); $$;

-- Établissement : le propriétaire lit et modifie ses colonnes éditables. La création, le plan,
-- Stripe, les notes et l'index de recherche passent uniquement par le serveur (service_role).
drop policy if exists businesses_owner_select on public.businesses;
create policy businesses_owner_select on public.businesses for select using (auth.uid() = owner_id);
drop policy if exists businesses_owner_update on public.businesses;
create policy businesses_owner_update on public.businesses for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
revoke insert, update, delete on public.businesses from anon, authenticated;
grant update (name, tagline, description, email, phone, website, address, postal_code, city, city_slug, lat, lng, modes,
  cover_url, highlights, payment_methods, free_radius_km, max_radius_km, price_per_extra_km, travel_buffer_minutes,
  slot_step_minutes, min_lead_minutes, max_days_ahead, cancellation_hours, deposit_enabled, deposit_percent,
  rebooking_days, published, locale, no_show_block_threshold) on public.businesses to authenticated;

do $$
declare t text;
begin
  foreach t in array array['staff', 'services', 'addons', 'opening_hours', 'time_off'] loop
    execute format('drop policy if exists %1$s_owner_all on public.%1$s', t);
    execute format('create policy %1$s_owner_all on public.%1$s for all using (public.owns_business(business_id)) with check (public.owns_business(business_id))', t);
  end loop;
end $$;

drop policy if exists customer_profiles_own on public.customer_profiles;
create policy customer_profiles_own on public.customer_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Rendez-vous : lus par l'établissement et par l'usager concerné ; créés uniquement par la RPC.
drop policy if exists bookings_owner_select on public.bookings;
create policy bookings_owner_select on public.bookings for select using (public.owns_business(business_id));
drop policy if exists bookings_client_select on public.bookings;
create policy bookings_client_select on public.bookings for select using (auth.uid() = client_user_id);
drop policy if exists bookings_owner_update on public.bookings;
create policy bookings_owner_update on public.bookings for update using (public.owns_business(business_id)) with check (public.owns_business(business_id));
revoke insert, update, delete on public.bookings from anon, authenticated;
grant update (status, staff_id) on public.bookings to authenticated;

-- Avis : publics en lecture, écrits par le serveur ; l'établissement peut répondre.
drop policy if exists reviews_public_select on public.reviews;
create policy reviews_public_select on public.reviews for select using (true);
drop policy if exists reviews_owner_reply on public.reviews;
create policy reviews_owner_reply on public.reviews for update using (public.owns_business(business_id)) with check (public.owns_business(business_id));
revoke insert, update, delete on public.reviews from anon, authenticated;
grant update (reply) on public.reviews to authenticated;

-- Liste d'attente : l'usager connecté voit ses inscriptions ; l'établissement voit les siennes.
drop policy if exists waitlist_own_select on public.waitlist_entries;
create policy waitlist_own_select on public.waitlist_entries for select using (auth.uid() = user_id or public.owns_business(business_id));
revoke insert, update, delete on public.waitlist_entries from anon, authenticated;

-- prospects / email_threads / email_messages / email_suppressions / email_events / system_events :
-- aucune policy => service_role uniquement.

-- ---------------------------------------------------------------------
-- Recherche : texte (FTS + trigrammes), catégorie, distance, prix, mode, note
-- ---------------------------------------------------------------------
drop function if exists public.search_businesses(text, text, text, double precision, double precision, double precision, numeric, text, numeric, text, integer, integer);
create or replace function public.search_businesses(
  p_query text default null,
  p_category text default null,
  p_city_slug text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_max_price numeric default null,
  p_mode text default null,
  p_min_rating numeric default null,
  p_sort text default 'relevance',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid, slug text, name text, category text, tagline text, city text, city_slug text, address text,
  lat double precision, lng double precision, modes location_type[], cover_url text, min_price_eur numeric,
  rating_avg numeric, rating_count integer, plan business_plan, distance_km double precision,
  relevance real, sponsored boolean, total_count bigint
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with q as (
    select nullif(trim(p_query), '') as raw,
           case when nullif(trim(p_query), '') is null then null
                else websearch_to_tsquery('french', public.norm(p_query)) end as tsq,
           public.norm(p_query) as nq
  ),
  base as (
    select b.*,
      case when p_lat is null or p_lng is null or b.lat is null then null
           else 2 * 6371 * asin(sqrt(power(sin(radians(b.lat - p_lat) / 2), 2)
                + cos(radians(p_lat)) * cos(radians(b.lat)) * power(sin(radians(b.lng - p_lng) / 2), 2)))
      end as dist,
      case when (select raw from q) is null then 0::real
           else (ts_rank(b.search_tsv, (select tsq from q)) + 2 * similarity(public.norm(b.name), (select nq from q)))::real
      end as rel
    from public.businesses b
    where b.published
      and b.min_price_eur is not null
      and (p_category is null or b.category = p_category)
      and (p_city_slug is null or b.city_slug = p_city_slug)
      and (p_mode is null or p_mode::location_type = any(b.modes))
      and (p_max_price is null or b.min_price_eur <= p_max_price)
      and (p_min_rating is null or (b.rating_count > 0 and b.rating_avg >= p_min_rating))
      and ((select raw from q) is null
           or b.search_tsv @@ (select tsq from q)
           or public.norm(b.name) % (select nq from q)
           or public.norm(b.name) like '%' || (select nq from q) || '%')
  )
  select base.id, base.slug, base.name, base.category, base.tagline, base.city, base.city_slug, base.address,
         base.lat, base.lng, base.modes, base.cover_url, base.min_price_eur, base.rating_avg, base.rating_count,
         base.plan, base.dist, base.rel, base.plan = 'pro', count(*) over ()
    from base
   where p_radius_km is null or p_mode = 'online' or base.dist is null or base.dist <= p_radius_km
         or ('at_home' = any(base.modes) and base.dist <= greatest(p_radius_km, base.max_radius_km))
   order by
     case when p_sort = 'distance' then base.dist end asc nulls last,
     case when p_sort = 'price_asc' then base.min_price_eur end asc nulls last,
     case when p_sort = 'price_desc' then base.min_price_eur end desc nulls last,
     case when p_sort = 'rating' then base.rating_avg end desc,
     -- Tri « pertinence » uniquement : léger bonus aux établissements Pro, signalé « Mis en avant » (CGU § 6).
     base.rel + case when p_sort = 'relevance' and base.plan = 'pro' then 0.15 else 0 end desc,
     (base.rating_avg * ln(base.rating_count + 1)) desc,
     base.dist asc nulls last,
     base.created_at asc
   limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;
grant execute on function public.search_businesses(text, text, text, double precision, double precision, double precision, numeric, text, numeric, text, integer, integer) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- RPC atomique de création de RDV (équipe, capacité, congés, quota)
-- ---------------------------------------------------------------------
drop function if exists public.create_booking_atomic(uuid, uuid, text, text, text, uuid[], integer, uuid, uuid[], integer, location_type, text, numeric, numeric, numeric, numeric, uuid, text, text, text, text, timestamptz, timestamptz, booking_status, integer, integer);
create or replace function public.create_booking_atomic(
  p_business_id uuid,
  p_service_id uuid,
  p_service_name text,
  p_variant_key text,
  p_variant_label text,
  p_addon_ids uuid[],
  p_seats integer,
  p_staff_id uuid,             -- membre choisi par l'usager, ou null = « peu importe »
  p_candidate_staff uuid[],    -- membres éligibles (ordre de préférence) si p_staff_id est null
  p_capacity integer,
  p_location_type location_type,
  p_client_address text,
  p_distance_km numeric,
  p_travel_fee_eur numeric,
  p_total_price_eur numeric,
  p_deposit_amount_eur numeric,
  p_client_user_id uuid,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_client_notes text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_status booking_status,
  p_free_monthly_limit integer default 30,
  p_pending_ttl_minutes integer default 20
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses;
  v_month_start timestamptz;
  v_count integer;
  v_candidates uuid[];
  v_candidate uuid;
  v_chosen uuid;
  v_found boolean := false;
  v_has_staff boolean;
  v_booking public.bookings;
begin
  if p_status not in ('pending_deposit', 'scheduled') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  -- Verrou exclusif : sérialise toutes les créations de RDV d'un même établissement.
  select * into v_business from public.businesses where id = p_business_id for update;
  if not found then raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0001'; end if;

  if v_business.plan = 'free' then
    v_month_start := date_trunc('month', p_start_at at time zone 'Europe/Paris') at time zone 'Europe/Paris';
    select count(*) into v_count from public.bookings b
     where b.business_id = p_business_id
       and b.start_at >= v_month_start and b.start_at < v_month_start + interval '1 month'
       and b.status <> 'cancelled'
       and not (b.status = 'pending_deposit' and b.created_at < now() - make_interval(mins => p_pending_ttl_minutes));
    if v_count >= p_free_monthly_limit then raise exception 'QUOTA_EXCEEDED' using errcode = 'P0001'; end if;
  end if;

  -- Fermeture de tout l'établissement.
  if exists (select 1 from public.time_off t where t.business_id = p_business_id and t.staff_id is null
              and tstzrange(t.start_at, t.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')) then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;

  select exists (select 1 from public.staff s where s.business_id = p_business_id and s.active) into v_has_staff;
  if not v_has_staff then
    v_candidates := array[null::uuid];
  elsif p_staff_id is not null then
    v_candidates := array[p_staff_id];
  else
    v_candidates := coalesce(p_candidate_staff, '{}');
  end if;

  foreach v_candidate in array v_candidates loop
    -- Indisponibilité du membre.
    if v_candidate is not null and exists (
      select 1 from public.time_off t where t.business_id = p_business_id and t.staff_id = v_candidate
         and tstzrange(t.start_at, t.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')) then
      continue;
    end if;
    -- Conflit dur : tout RDV actif qui chevauche, sauf une place du même cours collectif au même horaire.
    if exists (
      select 1 from public.bookings b
       where b.business_id = p_business_id
         and b.staff_id is not distinct from v_candidate
         and b.status not in ('cancelled', 'no_show')
         and not (b.status = 'pending_deposit' and b.created_at < now() - make_interval(mins => p_pending_ttl_minutes))
         and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
         and not (p_capacity > 1 and b.service_id = p_service_id and b.start_at = p_start_at)
    ) then
      continue;
    end if;
    -- Capacité du cours collectif / des tables.
    if p_capacity > 1 then
      select coalesce(sum(b.seats), 0) into v_count from public.bookings b
       where b.business_id = p_business_id
         and b.staff_id is not distinct from v_candidate
         and b.service_id = p_service_id and b.start_at = p_start_at
         and b.status not in ('cancelled', 'no_show')
         and not (b.status = 'pending_deposit' and b.created_at < now() - make_interval(mins => p_pending_ttl_minutes));
      if v_count + p_seats > p_capacity then continue; end if;
    end if;
    v_chosen := v_candidate;
    v_found := true;
    exit;
  end loop;

  if not v_found then raise exception 'SLOT_TAKEN' using errcode = 'P0001'; end if;

  insert into public.bookings (
    business_id, service_id, staff_id, service_name, variant_key, variant_label, addon_ids, seats, location_type,
    client_address, distance_km, travel_fee_eur, total_price_eur, deposit_amount_eur, client_user_id, client_name,
    client_email, client_phone, client_notes, start_at, end_at, status
  ) values (
    p_business_id, p_service_id, v_chosen, p_service_name, p_variant_key, p_variant_label, coalesce(p_addon_ids, '{}'),
    greatest(coalesce(p_seats, 1), 1), p_location_type, p_client_address, p_distance_km, coalesce(p_travel_fee_eur, 0),
    p_total_price_eur, coalesce(p_deposit_amount_eur, 0), p_client_user_id, p_client_name, lower(p_client_email),
    p_client_phone, p_client_notes, p_start_at, p_end_at, p_status
  ) returning * into v_booking;

  return v_booking;
end;
$$;
revoke all on function public.create_booking_atomic from public, anon, authenticated;
grant execute on function public.create_booking_atomic to service_role;

-- Paiement d'acompte arrivé après libération du créneau : réactivation si toujours libre.
create or replace function public.reactivate_paid_booking(p_booking_id uuid, p_pending_ttl_minutes integer default 20)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then return false; end if;
  perform 1 from public.businesses where id = v_booking.business_id for update;
  if exists (
    select 1 from public.bookings b
     where b.business_id = v_booking.business_id and b.id <> v_booking.id
       and b.staff_id is not distinct from v_booking.staff_id
       and b.status not in ('cancelled', 'no_show')
       and not (b.status = 'pending_deposit' and b.created_at < now() - make_interval(mins => p_pending_ttl_minutes))
       and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(v_booking.start_at, v_booking.end_at, '[)')
       and not (b.service_id = v_booking.service_id and b.start_at = v_booking.start_at
                and (select s.capacity from public.services s where s.id = v_booking.service_id) > 1)
  ) then
    return false;
  end if;
  update public.bookings set status = 'scheduled', deposit_paid = true, cancelled_by = null where id = p_booking_id;
  return true;
end;
$$;
revoke all on function public.reactivate_paid_booking(uuid, integer) from public, anon, authenticated;
grant execute on function public.reactivate_paid_booking(uuid, integer) to service_role;

-- Rattache à un compte usager les RDV pris avec son email avant la création du compte.
create or replace function public.claim_guest_bookings(p_user_id uuid, p_email text)
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.bookings set client_user_id = p_user_id
     where client_user_id is null and lower(client_email) = lower(p_email)
    returning 1
  ) select count(*)::integer from updated;
$$;
revoke all on function public.claim_guest_bookings(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_guest_bookings(uuid, text) to service_role;

create or replace function public.increment_ai_reply_count(p_thread_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.email_threads set ai_reply_count = ai_reply_count + 1, updated_at = now()
   where id = p_thread_id returning ai_reply_count;
$$;
revoke all on function public.increment_ai_reply_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_ai_reply_count(uuid) to service_role;
