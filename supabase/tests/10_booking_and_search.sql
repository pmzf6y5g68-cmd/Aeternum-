-- Tests comportementaux du schéma (à jouer sur une base vierge après 00_supabase_stubs.sql + schema.sql).
-- Chaque vérification lève une exception si elle échoue.
\set ON_ERROR_STOP 1
begin;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222'), ('33333333-3333-3333-3333-333333333333');
insert into businesses (id, owner_id, slug, name, category, email, city, city_slug, lat, lng, modes) values
 ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'salon-elegance', 'Salon Élégance', 'coiffeur', 'a@x.fr', 'Lyon', 'lyon', 45.764, 4.8357, '{on_site,at_home}'),
 ('b0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'yoga-flow', 'Yoga Flow', 'yoga-pilates', 'b@x.fr', 'Paris', 'paris', 48.8566, 2.3522, '{on_site,online}');
insert into services (id, business_id, name, price_eur, duration_minutes, variants, capacity) values
 ('50000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Coupe brushing', 45, 60,
   '[{"key":"courts","label":"Courts","price_eur":40,"duration_minutes":45},{"key":"longs","label":"Longs","price_eur":63,"duration_minutes":80}]', 1),
 ('50000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Cours collectif vinyasa', 18, 60, '[]', 3);
insert into staff (id, business_id, name) values
 ('5a000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Alice'),
 ('5a000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Bob');

-- Dénormalisations
do $$ begin
  assert (select min_price_eur from businesses where slug = 'salon-elegance') = 40, 'min_price via variantes';
  assert (select search_tsv is not null from businesses where slug = 'salon-elegance'), 'index de recherche';
end $$;

-- Recherche
do $$ declare r record; begin
  select * into r from search_businesses(p_query => 'elegance');
  assert r.slug = 'salon-elegance', 'recherche sans accent par nom';
  select * into r from search_businesses(p_query => 'brushing');
  assert r.slug = 'salon-elegance', 'recherche par prestation';
  select * into r from search_businesses(p_query => 'elegnce');
  assert r.slug = 'salon-elegance', 'tolérance aux fautes (trigrammes)';
  assert (select count(*) from search_businesses(p_category => 'yoga-pilates')) = 1, 'filtre catégorie';
  assert (select count(*) from search_businesses(p_lat => 45.75, p_lng => 4.85, p_radius_km => 20)) = 1, 'rayon autour de Lyon';
  assert (select count(*) from search_businesses(p_lat => 45.75, p_lng => 4.85, p_radius_km => 20, p_mode => 'online')) = 1, 'visio ignore le rayon (seul Yoga est en ligne)';
  assert (select slug from search_businesses(p_lat => 48.85, p_lng => 2.35, p_sort => 'distance') limit 1) = 'yoga-flow', 'tri distance';
  assert (select slug from search_businesses(p_sort => 'price_asc') limit 1) = 'yoga-flow', 'tri prix';
  assert (select count(*) from search_businesses(p_max_price => 20)) = 1, 'filtre prix max';
  assert (select total_count from search_businesses() limit 1) = 2, 'total';
end $$;

-- Réservation avec équipe : « peu importe » prend le premier membre libre puis le suivant
do $$ declare b1 bookings; b2 bookings; begin
  select * into b1 from create_booking_atomic('b0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Coupe', 'longs', 'Longs', '{}', 1,
    null, array['5a000000-0000-0000-0000-000000000001','5a000000-0000-0000-0000-000000000002']::uuid[], 1, 'on_site', null, null, 0, 63, 0,
    null, 'Client 1', 'C1@X.fr', null, null, '2026-12-01 09:00+01', '2026-12-01 10:20+01', 'scheduled');
  select * into b2 from create_booking_atomic('b0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Coupe', 'longs', 'Longs', '{}', 1,
    null, array['5a000000-0000-0000-0000-000000000001','5a000000-0000-0000-0000-000000000002']::uuid[], 1, 'on_site', null, null, 0, 63, 0,
    null, 'Client 2', 'c2@x.fr', null, null, '2026-12-01 09:30+01', '2026-12-01 10:30+01', 'scheduled');
  assert b1.staff_id = '5a000000-0000-0000-0000-000000000001' and b2.staff_id = '5a000000-0000-0000-0000-000000000002', 'répartition équipe';
  assert b1.client_email = 'c1@x.fr', 'email normalisé';
  begin
    perform create_booking_atomic('b0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Coupe', null, null, '{}', 1,
      null, array['5a000000-0000-0000-0000-000000000001','5a000000-0000-0000-0000-000000000002']::uuid[], 1, 'on_site', null, null, 0, 45, 0,
      null, 'Client 3', 'c3@x.fr', null, null, '2026-12-01 09:45+01', '2026-12-01 10:45+01', 'scheduled');
    raise exception 'devait être complet';
  exception when others then assert sqlerrm = 'SLOT_TAKEN', 'complet : ' || sqlerrm; end;
end $$;

-- Congé d'un membre
insert into time_off (business_id, staff_id, start_at, end_at) values ('b0000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000002', '2026-12-02 00:00+01', '2026-12-03 00:00+01');
do $$ declare b bookings; begin
  select * into b from create_booking_atomic('b0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Coupe', null, null, '{}', 1,
    '5a000000-0000-0000-0000-000000000001', null, 1, 'on_site', null, null, 0, 45, 0, null, 'X', 'x@x.fr', null, null, '2026-12-02 09:00+01', '2026-12-02 10:00+01', 'scheduled');
  begin
    perform create_booking_atomic('b0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Coupe', null, null, '{}', 1,
      '5a000000-0000-0000-0000-000000000002', null, 1, 'on_site', null, null, 0, 45, 0, null, 'Y', 'y@x.fr', null, null, '2026-12-02 11:00+01', '2026-12-02 12:00+01', 'scheduled');
    raise exception 'Bob est en congé';
  exception when others then assert sqlerrm = 'SLOT_TAKEN', 'congé : ' || sqlerrm; end;
end $$;

-- Capacité : cours de 3 places
do $$ begin
  perform create_booking_atomic('b0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'Vinyasa', null, null, '{}', 2,
    null, null, 3, 'on_site', null, null, 0, 36, 0, null, 'A', 'a1@x.fr', null, null, '2026-12-03 18:00+01', '2026-12-03 19:00+01', 'scheduled');
  perform create_booking_atomic('b0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'Vinyasa', null, null, '{}', 1,
    null, null, 3, 'on_site', null, null, 0, 18, 0, null, 'B', 'b1@x.fr', null, null, '2026-12-03 18:00+01', '2026-12-03 19:00+01', 'scheduled');
  begin
    perform create_booking_atomic('b0000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'Vinyasa', null, null, '{}', 1,
      null, null, 3, 'on_site', null, null, 0, 18, 0, null, 'C', 'c1@x.fr', null, null, '2026-12-03 18:00+01', '2026-12-03 19:00+01', 'scheduled');
    raise exception 'cours complet';
  exception when others then assert sqlerrm = 'SLOT_TAKEN', 'capacité : ' || sqlerrm; end;
end $$;

-- Quota gratuit (limite abaissée à 5 pour le test) et pending expiré
do $$ begin
  for i in 1..2 loop
    perform create_booking_atomic('b0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Coupe', null, null, '{}', 1,
      '5a000000-0000-0000-0000-000000000001', null, 1, 'on_site', null, null, 0, 45, 0, null, 'Q', 'q@x.fr', null, null,
      ('2026-12-10 09:00+01'::timestamptz + make_interval(hours => i)), ('2026-12-10 09:30+01'::timestamptz + make_interval(hours => i)), 'scheduled', 5);
  end loop;
  begin
    perform create_booking_atomic('b0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Coupe', null, null, '{}', 1,
      '5a000000-0000-0000-0000-000000000001', null, 1, 'on_site', null, null, 0, 45, 0, null, 'Q', 'q@x.fr', null, null, '2026-12-20 09:00+01', '2026-12-20 10:00+01', 'scheduled', 5);
    raise exception 'quota';
  exception when others then assert sqlerrm = 'QUOTA_EXCEEDED', 'quota : ' || sqlerrm; end;
end $$;

-- Avis -> note moyenne
insert into reviews (business_id, booking_id, author_name, rating) select business_id, id, 'Client', 4 from bookings where client_name = 'Client 1';
insert into reviews (business_id, booking_id, author_name, rating) select business_id, id, 'Client', 5 from bookings where client_name = 'Client 2';
do $$ begin
  assert (select rating_avg from businesses where slug = 'salon-elegance') = 4.5 and (select rating_count from businesses where slug = 'salon-elegance') = 2, 'note moyenne';
  assert (select count(*) from search_businesses(p_min_rating => 4.5)) = 1, 'filtre note';
end $$;

-- Rattachement des RDV invités à un compte
do $$ begin
  assert claim_guest_bookings('33333333-3333-3333-3333-333333333333', 'C1@x.fr') = 1, 'claim';
end $$;

-- RLS
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$ begin
  assert (select count(*) from bookings) = 1, 'usager : ses seuls RDV';
  assert (select count(*) from businesses) = 0, 'usager : aucun établissement en direct';
  assert (select count(*) from reviews) = 2, 'avis publics';
  assert (select count(*) from prospects) = 0, 'prospects invisibles';
end $$;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert (select count(*) from bookings) = 5, 'pro : ses RDV uniquement (pas ceux du yoga)';
  begin
    update businesses set plan = 'pro';
    raise exception 'plan modifiable !';
  exception when insufficient_privilege then null; end;
  begin
    update bookings set total_price_eur = 1;
    raise exception 'prix modifiable !';
  exception when insufficient_privilege then null; end;
  update bookings set status = 'confirmed' where client_name = 'Client 1';
  assert (select count(*) from search_businesses()) = 2, 'recherche accessible';
end $$;
reset role;
select 'ALL SQL TESTS PASSED' as result;
rollback;
