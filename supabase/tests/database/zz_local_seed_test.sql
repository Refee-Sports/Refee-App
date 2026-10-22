begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

-- The local seed (supabase/seed.sql + supabase/seeds/*.sql) is what every
-- screen is tested against by hand. These checks fail when a migration breaks
-- it, or when it stops covering a state someone needs to see.

-- ── Accounts ────────────────────────────────────────────────────────────────
select bag_has(
  $$ select email::text from auth.users $$,
  $$ values ('dc.new@refee.local'), ('dc.booked@refee.local'), ('dc.paid@refee.local'),
            ('dc.unverified@refee.local'), ('dc.director@refee.local'),
            ('dc.assignor@refee.local'), ('admin@refee.local') $$,
  'every DC persona can sign in by email'
);

select is(
  (select count(*)::int from auth.identities i join auth.users u on u.id = i.user_id
    where u.email like 'dc.%@refee.local' or u.email = 'admin@refee.local'),
  7,
  'each persona has exactly one email identity'
);

select is(
  (select identity_status from public.private_profiles p join auth.users u on u.id = p.id
    where u.email = 'dc.unverified@refee.local'),
  'in_review',
  'the unverified referee is waiting on ID review'
);

select is(
  (select count(*)::int from public.private_profiles p join auth.users u on u.id = p.id
    where (u.email like 'dc.%@refee.local' or u.email = 'admin@refee.local')
      and u.email <> 'dc.unverified@refee.local'
      and p.identity_status = 'approved'),
  6,
  'everyone else is ID-verified'
);

select ok(
  exists (select 1 from public.admins a join auth.users u on u.id = a.user_id
           where u.email = 'admin@refee.local'),
  'the admin account is an admin'
);

-- ── The DC feed ─────────────────────────────────────────────────────────────
-- A referee with a DC ZIP and the default 25-mile radius sees a full feed.
select cmp_ok(
  (select count(*)::int from public.jobs j
    where j.status in ('open', 'partially_filled')
      and j.starts_at > now()
      and j.venue_lat is not null
      and 3958.8 * 2 * asin(sqrt(
            power(sin(radians(j.venue_lat - 38.8912) / 2), 2)
          + cos(radians(38.8912)) * cos(radians(j.venue_lat))
          * power(sin(radians(j.venue_lng - -76.9377) / 2), 2))) <= 25),
  '>=',
  15,
  'at least 15 open games within 25 miles of DC'
);

select is(
  (select count(*)::int from public.jobs j join public.hirers h on h.id = j.hirer_id
     join auth.users u on u.id = h.user_id
    where u.email = 'dc.director@refee.local'
      and (j.timezone <> 'America/New_York'
           or j.venue_lat is null
           or not public.venue_is_complete(j.venue_address, j.venue_zip, j.venue_city, j.venue_state))),
  0,
  'DC games have a full address, a map pin and Eastern time'
);

select ok(
  exists (select 1 from public.jobs j join public.hirers h on h.id = j.hirer_id
            join auth.users u on u.id = h.user_id
           where u.email = 'dc.director@refee.local' and j.status = 'open'
             and j.venue_city = 'Baltimore'),
  'one game sits outside the radius, to prove the filter'
);

-- ── Per-persona states ──────────────────────────────────────────────────────
select cmp_ok(
  (select count(*)::int from public.job_assignments a join public.jobs j on j.id = a.job_id
     join auth.users u on u.id = a.ref_id
    where u.email = 'dc.booked@refee.local' and a.status = 'accepted' and j.starts_at > now()),
  '>=', 2,
  'the booked referee has upcoming confirmed games'
);

select bag_has(
  $$ select a.status from public.job_assignments a join auth.users u on u.id = a.ref_id
      where u.email = 'dc.booked@refee.local' $$,
  $$ values ('pending'), ('offered') $$,
  'the booked referee also has an application and an offer waiting'
);

select bag_has(
  $$ select a.payout_status from public.job_assignments a join auth.users u on u.id = a.ref_id
      where u.email = 'dc.paid@refee.local' and a.status = 'completed' $$,
  $$ values ('paid'), ('pending') $$,
  'the paid referee has paid and pending payouts'
);

select is(
  (select count(*)::int from public.job_assignments a join auth.users u on u.id = a.ref_id
    where u.email = 'dc.new@refee.local'),
  0,
  'the new referee has no games yet'
);

select ok(
  exists (select 1 from public.job_assignments a join public.jobs j on j.id = a.job_id
            join public.hirers h on h.id = j.hirer_id join auth.users u on u.id = h.user_id
           where u.email = 'dc.director@refee.local' and a.status = 'pending'),
  'the director has applicants to review'
);

select is(
  (select count(*)::int from public.assignor_rosters r join auth.users u on u.id = r.assignor_id
    where u.email = 'dc.assignor@refee.local' and r.status = 'accepted'),
  3,
  'the assignor has a roster of three referees'
);

select ok(
  exists (select 1 from public.tournaments t join auth.users u on u.id = t.assignor_id
           where u.email = 'dc.assignor@refee.local'
             and t.staffing_model = 'assignor_managed' and t.assignor_status = 'accepted'),
  'the assignor runs a tournament for the director'
);

-- ── Freshness ───────────────────────────────────────────────────────────────
-- Seeded games that are meant to be upcoming stay upcoming after a re-seed.
select is(
  (select count(*)::int from public.jobs j join public.hirers h on h.id = j.hirer_id
     join auth.users u on u.id = h.user_id
    where u.email like '%@refee.local'
      and j.status in ('open', 'partially_filled') and j.starts_at < now()),
  0,
  'no seeded open game is in the past'
);

-- ── Re-seed hygiene ─────────────────────────────────────────────────────────
select is(
  (select count(*)::int from (
     select ref_id, org_name from public.certifications
      where ref_id in (select id from auth.users where email like '%@refee.local')
      group by 1, 2 having count(*) > 1) d),
  0,
  'each seeded certification appears once'
);

select is(
  (select count(*)::int from public.jobs j
    where j.payment_status = 'paid'
      and exists (select 1 from public.job_assignments a
                   where a.job_id = j.id and a.status = 'completed' and a.payout_status <> 'paid')),
  0,
  'no seeded game is marked paid while a ref on it is still owed'
);

select * from finish();
rollback;
