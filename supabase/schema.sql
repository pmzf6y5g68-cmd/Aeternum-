-- =====================================================================
-- Slotly — schéma Supabase complet (idempotent : peut être rejoué)
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------
do $$ begin
  create type service_mode as enum ('workshop', 'mobile', 'both');
exception when duplicate_object then null; end $$;

do $$ begin
  create type studio_plan as enum ('free', 'pro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vehicle_size as enum ('citadine', 'berline', 'suv_4x4', 'utilitaire');
exception when duplicate_object then null; end $$;

do $$ begin
  create type location_type as enum ('workshop', 'mobile');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status as enum
    ('pending_deposit', 'scheduled', 'confirmed', 'at_risk', 'completed', 'cancelled', 'no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prospect_status as enum
    ('new', 'disqualified', 'sent', 'replied', 'ooo_paused', 'converted', 'stopped', 'error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type thread_status as enum ('open', 'ai_handled', 'escalated', 'stopped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_direction as enum ('outbound', 'inbound');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- studios
-- ---------------------------------------------------------------------
create table if not exists public.studios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])$'),
  name text not null,
  email text not null,
  phone text,
  address text,
  city text,
  base_lat double precision,
  base_lng double precision,
  service_mode service_mode not null default 'workshop',
  free_radius_km numeric(6,2) not null default 15 check (free_radius_km >= 0),
  max_radius_km numeric(6,2) not null default 45 check (max_radius_km >= 0),
  price_per_extra_km numeric(6,2) not null default 1.2 check (price_per_extra_km >= 0),
  travel_buffer_minutes integer not null default 30 check (travel_buffer_minutes between 0 and 240),
  deposit_enabled boolean not null default false,
  deposit_percent integer not null default 30 check (deposit_percent between 5 and 100),
  plan studio_plan not null default 'free',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_connect_account_id text unique,
  stripe_connect_onboarded boolean not null default false,
  rebooking_days integer not null default 90 check (rebooking_days between 7 and 730),
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  created_at timestamptz not null default now()
);
create index if not exists studios_email_idx on public.studios (lower(email));

-- ---------------------------------------------------------------------
-- services / addons / opening_hours
-- ---------------------------------------------------------------------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  name text not null,
  description text,
  base_price_eur numeric(10,2) not null check (base_price_eur >= 0),
  base_duration_minutes integer not null check (base_duration_minutes between 15 and 1440),
  size_pricing_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists services_studio_idx on public.services (studio_id);

create table if not exists public.addons (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  name text not null,
  price_eur numeric(10,2) not null check (price_eur >= 0),
  duration_minutes integer not null default 0 check (duration_minutes between 0 and 600),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists addons_studio_idx on public.addons (studio_id);

create table if not exists public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  open_time time,
  close_time time,
  break_start time,
  break_end time,
  is_closed boolean not null default false,
  unique (studio_id, day_of_week)
);

-- ---------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  addon_ids uuid[] not null default '{}',
  vehicle_size vehicle_size not null,
  vehicle_model text,
  location_type location_type not null default 'workshop',
  client_address text,
  distance_km numeric(8,2),
  travel_fee_eur numeric(10,2) not null default 0,
  total_price_eur numeric(10,2) not null,
  deposit_amount_eur numeric(10,2) not null default 0,
  deposit_paid boolean not null default false,
  stripe_checkout_session_id text unique,
  client_name text not null,
  client_email text not null,
  client_phone text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status booking_status not null default 'scheduled',
  confirm_token uuid not null default gen_random_uuid() unique,
  reminder_sent boolean not null default false,
  risk_alert_sent boolean not null default false,
  rebooking_sent boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index if not exists bookings_studio_start_idx on public.bookings (studio_id, start_at);
create index if not exists bookings_status_start_idx on public.bookings (status, start_at);
create index if not exists bookings_pending_idx on public.bookings (created_at) where status = 'pending_deposit';

-- ---------------------------------------------------------------------
-- Prospection & fils email (service_role uniquement)
-- ---------------------------------------------------------------------
create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
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
  studio_id uuid references public.studios(id) on delete set null,
  subject text,
  status thread_status not null default 'open',
  ai_reply_count integer not null default 0,
  last_message_id text,
  references_chain text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists email_threads_contact_idx on public.email_threads (lower(contact_email), updated_at desc);
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

-- Journal d'anomalies lu par le cron health-digest
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
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.studios enable row level security;
alter table public.services enable row level security;
alter table public.addons enable row level security;
alter table public.opening_hours enable row level security;
alter table public.bookings enable row level security;
alter table public.prospects enable row level security;
alter table public.email_threads enable row level security;
alter table public.email_messages enable row level security;
alter table public.system_events enable row level security;

-- Helper : le studio appartient-il à l'utilisateur courant ?
create or replace function public.owns_studio(p_studio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.studios s where s.id = p_studio_id and s.owner_id = auth.uid());
$$;

drop policy if exists studios_owner_select on public.studios;
create policy studios_owner_select on public.studios for select using (auth.uid() = owner_id);
-- Pas de policy INSERT : la création d'un studio passe par le serveur (service_role)
-- afin qu'aucun client ne puisse s'attribuer plan = 'pro' ou un compte Stripe.
drop policy if exists studios_owner_insert on public.studios;
drop policy if exists studios_owner_update on public.studios;
create policy studios_owner_update on public.studios for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Les colonnes de facturation / Connect ne sont modifiables que par le serveur (service_role).
revoke update on public.studios from authenticated;
grant update (name, email, phone, address, city, base_lat, base_lng, service_mode, free_radius_km,
  max_radius_km, price_per_extra_km, travel_buffer_minutes, deposit_enabled, deposit_percent,
  rebooking_days, locale) on public.studios to authenticated;

drop policy if exists services_owner_all on public.services;
create policy services_owner_all on public.services for all
  using (public.owns_studio(studio_id)) with check (public.owns_studio(studio_id));

drop policy if exists addons_owner_all on public.addons;
create policy addons_owner_all on public.addons for all
  using (public.owns_studio(studio_id)) with check (public.owns_studio(studio_id));

drop policy if exists opening_hours_owner_all on public.opening_hours;
create policy opening_hours_owner_all on public.opening_hours for all
  using (public.owns_studio(studio_id)) with check (public.owns_studio(studio_id));

-- Les RDV sont créés uniquement par create_booking_atomic (service_role) ;
-- le studio peut les lire et changer leur statut.
drop policy if exists bookings_owner_select on public.bookings;
create policy bookings_owner_select on public.bookings for select using (public.owns_studio(studio_id));
drop policy if exists bookings_owner_update on public.bookings;
create policy bookings_owner_update on public.bookings for update
  using (public.owns_studio(studio_id)) with check (public.owns_studio(studio_id));
revoke update on public.bookings from authenticated;
grant update (status) on public.bookings to authenticated;

-- prospects / email_threads / email_messages / system_events : aucune policy
-- => inaccessibles à anon/authenticated, accessibles au seul service_role.

-- ---------------------------------------------------------------------
-- RPC atomique de création de RDV
-- ---------------------------------------------------------------------
create or replace function public.create_booking_atomic(
  p_studio_id uuid,
  p_service_id uuid,
  p_addon_ids uuid[],
  p_vehicle_size vehicle_size,
  p_vehicle_model text,
  p_location_type location_type,
  p_client_address text,
  p_distance_km numeric,
  p_travel_fee_eur numeric,
  p_total_price_eur numeric,
  p_deposit_amount_eur numeric,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_status booking_status,
  p_free_monthly_limit integer default 15,
  p_pending_ttl_minutes integer default 20
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_studio public.studios;
  v_month_start timestamptz;
  v_month_count integer;
  v_booking public.bookings;
begin
  if p_status not in ('pending_deposit', 'scheduled') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  -- Verrou exclusif : sérialise toutes les créations de RDV d'un même studio.
  select * into v_studio from public.studios where id = p_studio_id for update;
  if not found then
    raise exception 'STUDIO_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Quota du plan gratuit : mois civil, heure de Paris.
  if v_studio.plan = 'free' then
    v_month_start := date_trunc('month', p_start_at at time zone 'Europe/Paris') at time zone 'Europe/Paris';
    select count(*) into v_month_count
      from public.bookings b
     where b.studio_id = p_studio_id
       and b.start_at >= v_month_start
       and b.start_at < v_month_start + interval '1 month'
       and b.status not in ('cancelled')
       and not (b.status = 'pending_deposit' and b.created_at < now() - make_interval(mins => p_pending_ttl_minutes));
    if v_month_count >= p_free_monthly_limit then
      raise exception 'QUOTA_EXCEEDED' using errcode = 'P0001';
    end if;
  end if;

  -- Chevauchement strict (les pending_deposit expirés sont ignorés).
  if exists (
    select 1 from public.bookings b
     where b.studio_id = p_studio_id
       and b.status not in ('cancelled', 'no_show')
       and not (b.status = 'pending_deposit' and b.created_at < now() - make_interval(mins => p_pending_ttl_minutes))
       and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
  ) then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;

  insert into public.bookings (
    studio_id, service_id, addon_ids, vehicle_size, vehicle_model, location_type, client_address,
    distance_km, travel_fee_eur, total_price_eur, deposit_amount_eur, client_name, client_email,
    client_phone, start_at, end_at, status
  ) values (
    p_studio_id, p_service_id, coalesce(p_addon_ids, '{}'), p_vehicle_size, p_vehicle_model, p_location_type,
    p_client_address, p_distance_km, coalesce(p_travel_fee_eur, 0), p_total_price_eur,
    coalesce(p_deposit_amount_eur, 0), p_client_name, lower(p_client_email), p_client_phone,
    p_start_at, p_end_at, p_status
  ) returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.create_booking_atomic(uuid, uuid, uuid[], vehicle_size, text, location_type, text,
  numeric, numeric, numeric, numeric, text, text, text, timestamptz, timestamptz, booking_status, integer, integer)
  from public, anon, authenticated;
grant execute on function public.create_booking_atomic(uuid, uuid, uuid[], vehicle_size, text, location_type, text,
  numeric, numeric, numeric, numeric, text, text, text, timestamptz, timestamptz, booking_status, integer, integer)
  to service_role;

-- Réactivation d'un RDV dont l'acompte est payé après expiration (paiement tardif) :
-- même verrou, même contrôle de chevauchement.
create or replace function public.reactivate_paid_booking(p_booking_id uuid, p_pending_ttl_minutes integer default 20)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    return false;
  end if;
  perform 1 from public.studios where id = v_booking.studio_id for update;
  if exists (
    select 1 from public.bookings b
     where b.studio_id = v_booking.studio_id
       and b.id <> v_booking.id
       and b.status not in ('cancelled', 'no_show')
       and not (b.status = 'pending_deposit' and b.created_at < now() - make_interval(mins => p_pending_ttl_minutes))
       and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(v_booking.start_at, v_booking.end_at, '[)')
  ) then
    return false;
  end if;
  update public.bookings set status = 'scheduled', deposit_paid = true where id = p_booking_id;
  return true;
end;
$$;

revoke all on function public.reactivate_paid_booking(uuid, integer) from public, anon, authenticated;
grant execute on function public.reactivate_paid_booking(uuid, integer) to service_role;

-- Incrément atomique du compteur de réponses IA d'un fil.
create or replace function public.increment_ai_reply_count(p_thread_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.email_threads
     set ai_reply_count = ai_reply_count + 1, updated_at = now()
   where id = p_thread_id
  returning ai_reply_count;
$$;

revoke all on function public.increment_ai_reply_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_ai_reply_count(uuid) to service_role;
