-- =============================================================================
-- DC-area seed — one account per state worth looking at, and a full game feed
-- around Washington, DC. Runs after seed.sql on `supabase db reset`, and again
-- on `npm run db:seed`, which moves every game date forward from today without
-- touching accounts you made yourself.
--
-- Sign in with the email; the code lands in the local inbox
-- (http://127.0.0.1:54324).
--   dc.new@refee.local         Riley P   referee, verified, no games yet
--   dc.booked@refee.local      Jamie C   referee with confirmed games, an application and an offer
--   dc.paid@refee.local        Morgan B  referee with a season of completed, paid games
--   dc.unverified@refee.local  Casey L   referee whose ID check is in review
--   dc.director@refee.local    Pat O     director: DMV Hoops Classic + weeknight games, applicants waiting
--   dc.assignor@refee.local    Drew M    assignor with a three-ref roster, running Capital Fall League
--   admin@refee.local          Sky A     staff admin (web /admin)
--
-- Any account you create with a DC ZIP (e.g. 20019) sees the same feed.
-- Every row has a fixed id, so re-running updates in place.
-- =============================================================================

-- ── Helpers (this session only) ────────────────────────────────────────────

-- A wall-clock time in DC, `days` from today.
create or replace function pg_temp.dc_local(days int, at time)
returns timestamp language sql stable as $$
  select ((now() at time zone 'America/New_York')::date + days) + at
$$;

create or replace function pg_temp.seed_person(
  p_id uuid, p_email text, p_first text, p_last text, p_role text,
  p_city text, p_state text, p_zip text, p_lat numeric, p_lng numeric,
  p_identity text default 'approved'
) returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, email_confirmed_at, encrypted_password,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    phone_change, phone_change_token, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_anonymous)
  values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    p_email, now(), '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('first_name', p_first, 'last_name', p_last),
    now() - interval '120 days', now(), false)
  on conflict (id) do update set
    email = excluded.email,
    email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (p_id::text, p_id,
          jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true, 'phone_verified', false),
          'email', now(), now(), now())
  on conflict (provider_id, provider) do update set identity_data = excluded.identity_data, updated_at = now();

  insert into public.public_profiles (id, first_name, last_initial, city, state, is_active, is_available, is_verified, primary_role)
  values (p_id, p_first, left(p_last, 1), p_city, p_state, true, p_role = 'referee', p_identity = 'approved', p_role)
  on conflict (id) do update set
    first_name = excluded.first_name, last_initial = excluded.last_initial,
    city = excluded.city, state = excluded.state, is_verified = excluded.is_verified,
    primary_role = excluded.primary_role;

  insert into public.private_profiles (
    id, legal_first_name, legal_last_name, date_of_birth, email, city, state,
    home_zip, home_lat, home_lng, background_check_status, identity_status, identity_verified_at)
  values (
    p_id, p_first, p_last, '1990-05-01', p_email, p_city, p_state,
    p_zip, p_lat, p_lng, 'cleared', p_identity, case when p_identity = 'approved' then now() end)
  on conflict (id) do update set
    email = excluded.email, city = excluded.city, state = excluded.state,
    home_zip = excluded.home_zip, home_lat = excluded.home_lat, home_lng = excluded.home_lng,
    identity_status = excluded.identity_status, identity_verified_at = excluded.identity_verified_at;

  insert into public.user_roles (user_id, role) values (p_id, p_role) on conflict do nothing;
end;
$$;

-- ── People ──────────────────────────────────────────────────────────────────
select pg_temp.seed_person('dc000000-0000-4000-8000-000000000000', 'dc.new@refee.local',        'Riley',  'Parker',  'referee',  'Washington',  'DC', '20019', 38.8912, -76.9377);
select pg_temp.seed_person('dc000000-0000-4000-8000-000000000001', 'dc.booked@refee.local',     'Jamie',  'Carter',  'referee',  'Washington',  'DC', '20002', 38.9050, -76.9850);
select pg_temp.seed_person('dc000000-0000-4000-8000-000000000002', 'dc.paid@refee.local',       'Morgan', 'Brooks',  'referee',  'Silver Spring','MD', '20910', 38.9967, -77.0261);
select pg_temp.seed_person('dc000000-0000-4000-8000-000000000003', 'dc.unverified@refee.local', 'Casey',  'Lopez',   'referee',  'Arlington',   'VA', '22204', 38.8580, -77.1100, 'in_review');
select pg_temp.seed_person('dc000000-0000-4000-8000-000000000004', 'dc.director@refee.local',   'Pat',    'Owens',   'director', 'Bowie',       'MD', '20715', 38.9426, -76.7302);
select pg_temp.seed_person('dc000000-0000-4000-8000-000000000005', 'dc.assignor@refee.local',   'Drew',   'Mitchell','assignor', 'Hyattsville', 'MD', '20781', 38.9559, -76.9455);
select pg_temp.seed_person('dc000000-0000-4000-8000-000000000006', 'admin@refee.local',         'Sky',    'Adams',   'referee',  'Washington',  'DC', '20003', 38.8846, -76.9958);

-- An unverified account isn't a verified person yet.
update public.public_profiles set is_verified = false where id = 'dc000000-0000-4000-8000-000000000003';

insert into public.admins (user_id, note) values ('dc000000-0000-4000-8000-000000000006', 'Local seed admin')
on conflict (user_id) do nothing;

-- Referees: basketball, levels, and what they're willing to take.
insert into public.ref_sports (ref_id, sport_id, years_experience) values
  ('dc000000-0000-4000-8000-000000000000', 'basketball', 1),
  ('dc000000-0000-4000-8000-000000000001', 'basketball', 6),
  ('dc000000-0000-4000-8000-000000000002', 'basketball', 11),
  ('dc000000-0000-4000-8000-000000000003', 'basketball', 3)
on conflict do nothing;

insert into public.ref_levels (ref_id, level_id, years_experience) values
  ('dc000000-0000-4000-8000-000000000000', 'youth_rec', 1),
  ('dc000000-0000-4000-8000-000000000001', 'youth_rec', 6),
  ('dc000000-0000-4000-8000-000000000001', 'high_school', 4),
  ('dc000000-0000-4000-8000-000000000002', 'youth_rec', 11),
  ('dc000000-0000-4000-8000-000000000002', 'high_school', 9),
  ('dc000000-0000-4000-8000-000000000002', 'juco', 3),
  ('dc000000-0000-4000-8000-000000000003', 'youth_rec', 3)
on conflict do nothing;

insert into public.certifications (ref_id, org_name, license_number, issued_date, is_verified) values
  ('dc000000-0000-4000-8000-000000000001', 'nfhs',  'N-DC-2231', '2020-08-01', true),
  ('dc000000-0000-4000-8000-000000000002', 'iaabo', 'MD-0912',   '2015-09-15', true),
  ('dc000000-0000-4000-8000-000000000002', 'nfhs',  'N-MD-7781', '2016-01-10', true)
on conflict do nothing;

-- available_days is a Sun..Sat bitmask: 127 every day, 65 weekends.
insert into public.availability_prefs (ref_id, available_days, travel_radius_miles, min_pay_per_game) values
  ('dc000000-0000-4000-8000-000000000000', 127, 25, 50),
  ('dc000000-0000-4000-8000-000000000001', 127, 25, 60),
  ('dc000000-0000-4000-8000-000000000002', 65,  35, 90),
  ('dc000000-0000-4000-8000-000000000003', 127, 25, 50)
on conflict (ref_id) do update set
  available_days = excluded.available_days,
  travel_radius_miles = excluded.travel_radius_miles,
  min_pay_per_game = excluded.min_pay_per_game;

-- ── The director's organization, tournaments and the assignor's roster ─────
insert into public.hirers (user_id, org_name, org_type, is_verified, city, state)
values ('dc000000-0000-4000-8000-000000000004', 'DMV Hoops Collective', 'tournament', true, 'Bowie', 'MD')
on conflict (user_id) do update set org_name = excluded.org_name, is_verified = true;

insert into public.assignor_rosters (assignor_id, ref_id, status, invited_at, responded_at)
select 'dc000000-0000-4000-8000-000000000005', r, 'accepted', now() - interval '60 days', now() - interval '59 days'
from unnest(array[
  'dc000000-0000-4000-8000-000000000000',
  'dc000000-0000-4000-8000-000000000001',
  'dc000000-0000-4000-8000-000000000002']::uuid[]) as r
where not exists (
  select 1 from public.assignor_rosters x
   where x.assignor_id = 'dc000000-0000-4000-8000-000000000005' and x.ref_id = r);

insert into public.tournaments (
  id, hirer_id, name, description, sport_id, starts_on, ends_on, venue_name, venue_address,
  venue_city, venue_state, venue_zip, venue_lat, venue_lng, timezone, total_games, pay_per_game,
  status, staffing_model, assignor_id, assignor_status, assignor_fee_type, assignor_fee)
select v.id, h.id, v.name, v.descr, 'basketball',
       (now() at time zone 'America/New_York')::date + v.d0,
       (now() at time zone 'America/New_York')::date + v.d1,
       v.venue, v.addr, v.city, v.st, v.zip, v.lat, v.lng, 'America/New_York', v.games, v.pay,
       'open', v.model, v.assignor, v.astatus, 'flat', v.fee
from public.hirers h,
     (values
       ('3a000000-0000-4000-8000-000000000001'::uuid, 'DMV Hoops Classic',
        'Two-day youth showcase, 16 teams across U14–U17.', 9, 10,
        'Bowie Sports Center', '15200 Annapolis Rd', 'Bowie', 'MD', '20715', 38.9426, -76.7302,
        16, 95, 'direct', null::uuid, null::text, null::int),
       ('3a000000-0000-4000-8000-000000000002'::uuid, 'Capital Fall League',
        'Eight-week high school fall league. Staffed by the league assignor.', 4, 60,
        'Columbia Heights Rec Center', '1480 Girard St NW', 'Washington', 'DC', '20009', 38.9258, -77.0326,
        24, 110, 'assignor_managed', 'dc000000-0000-4000-8000-000000000005'::uuid, 'accepted', 300)
     ) as v(id, name, descr, d0, d1, venue, addr, city, st, zip, lat, lng, games, pay, model, assignor, astatus, fee)
where h.user_id = 'dc000000-0000-4000-8000-000000000004'
on conflict (id) do update set
  starts_on = excluded.starts_on, ends_on = excluded.ends_on, status = 'open',
  assignor_id = excluded.assignor_id, assignor_status = excluded.assignor_status;

-- ── Games ───────────────────────────────────────────────────────────────────
-- Wall-clock starts in DC; the timezone trigger turns them into starts_at.
-- Re-seeding moves them forward; accepted crews would be sent back to
-- re-confirm, so assignments are re-applied below.
insert into public.jobs (
  id, hirer_id, tournament_id, sport_id, title, job_type, level, age_group, gender, ruleset,
  starts_local, timezone, duration_minutes, venue_name, venue_address, venue_city, venue_state,
  venue_zip, venue_lat, venue_lng, pay_per_game, num_games, crew_size, status, is_featured,
  completed_at, payment_status, uniform_requirements, parking_info, hirer_note)
select v.id, h.id, v.tid, 'basketball', v.title, v.jtype, v.lvl, v.age, v.gender, 'NFHS',
       pg_temp.dc_local(v.d, v.at), 'America/New_York', v.mins, v.venue, v.addr, v.city, v.st,
       v.zip, v.lat, v.lng, v.pay, 1, v.crew, v.status, v.featured,
       case when v.status = 'completed' then pg_temp.dc_local(v.d, v.at) at time zone 'America/New_York' + interval '2 hours' end,
       case when v.status = 'completed' then 'paid' else 'unpaid' end,
       'Black / white stripe', 'Free lot', null
from public.hirers h,
     (values
       -- Open feed: 15 games inside 25 miles of DC
       ('3b000000-0000-4000-8000-000000000001'::uuid, null::uuid, 'Capitol Hill Rec League', 'single', 'adult', 'adult', 'co_ed', 1, time '19:00', 90, 'Capitol Hill Community Gym', '700 Pennsylvania Ave SE', 'Washington', 'DC', '20003', 38.8846, -76.9958, 70, 2, 'open', false),
       ('3b000000-0000-4000-8000-000000000002', null, 'Anacostia Youth Night', 'single', 'youth', 'U14', 'boys', 2, '18:00', 90, 'Anacostia Fieldhouse', '1800 Anacostia Dr SE', 'Washington', 'DC', '20020', 38.8622, -76.9750, 65, 2, 'open', true),
       ('3b000000-0000-4000-8000-000000000003', null, 'Silver Spring Girls U16', 'single', 'youth', 'U16', 'girls', 3, '18:30', 90, 'Silver Spring Sports Center', '8500 Colesville Rd', 'Silver Spring', 'MD', '20910', 38.9967, -77.0261, 75, 2, 'open', false),
       ('3b000000-0000-4000-8000-000000000004', null, 'Bethesda Men''s League', 'single', 'adult', 'adult', 'men', 4, '20:00', 90, 'Bethesda Community Gym', '4600 Elm St', 'Bethesda', 'MD', '20814', 38.9807, -77.1003, 80, 2, 'open', false),
       ('3b000000-0000-4000-8000-000000000005', null, 'Arlington JV Scrimmage', 'single', 'high_school', 'U16', 'boys', 5, '17:00', 120, 'Arlington Mill Gym', '909 S Dinwiddie St', 'Arlington', 'VA', '22204', 38.8580, -77.1100, 90, 3, 'open', false),
       ('3b000000-0000-4000-8000-000000000006', null, 'Alexandria Saturday Showcase', 'tournament', 'youth', 'U15', 'boys', 6, '09:00', 240, 'Alexandria Athletic Center', '1200 Braddock Rd', 'Alexandria', 'VA', '22314', 38.8140, -77.0469, 140, 3, 'open', true),
       ('3b000000-0000-4000-8000-000000000007', null, 'Hyattsville Rec Doubleheader', 'single', 'youth', 'U12', 'co_ed', 6, '13:00', 120, 'Hyattsville Fieldhouse', '4310 Gallatin St', 'Hyattsville', 'MD', '20781', 38.9559, -76.9455, 60, 2, 'open', false),
       ('3b000000-0000-4000-8000-000000000008', null, 'College Park Varsity Preview', 'single', 'high_school', 'U18', 'girls', 7, '16:00', 120, 'College Park Community Gym', '4321 Hartwick Rd', 'College Park', 'MD', '20740', 38.9807, -76.9369, 105, 3, 'open', false),
       ('3b000000-0000-4000-8000-000000000009', null, 'Rockville Adult League', 'single', 'adult', 'adult', 'co_ed', 8, '19:30', 90, 'Rockville Sports Complex', '100 Maryland Ave', 'Rockville', 'MD', '20850', 39.0840, -77.1528, 75, 2, 'open', false),
       ('3b000000-0000-4000-8000-000000000010', null, 'Fairfax Fall Ball', 'single', 'youth', 'U14', 'girls', 9, '18:00', 90, 'Fairfax Hoops Center', '10455 Armstrong St', 'Fairfax', 'VA', '22030', 38.8462, -77.3064, 70, 2, 'open', false),
       ('3b000000-0000-4000-8000-000000000011', null, 'Landover Midnight League', 'single', 'adult', 'adult', 'men', 10, '21:00', 90, 'Landover Rec Center', '8001 Sheriff Rd', 'Landover', 'MD', '20785', 38.9240, -76.8900, 85, 2, 'open', false),
       ('3b000000-0000-4000-8000-000000000012', null, 'Takoma Park Youth Clinic Games', 'single', 'youth', 'U10', 'co_ed', 11, '10:00', 60, 'Takoma Park Gym', '7500 Maple Ave', 'Takoma Park', 'MD', '20912', 38.9779, -77.0075, 50, 1, 'open', false),
       ('3b000000-0000-4000-8000-000000000013', null, 'Falls Church Women''s League', 'single', 'adult', 'adult', 'women', 12, '19:00', 90, 'Falls Church Community Center', '223 Little Falls St', 'Falls Church', 'VA', '22046', 38.8823, -77.1711, 80, 2, 'open', false),
       ('3b000000-0000-4000-8000-000000000014', '3a000000-0000-4000-8000-000000000001', 'DMV Hoops Classic — U16 Pool A', 'tournament', 'youth', 'U16', 'boys', 9, '09:00', 120, 'Bowie Sports Center', '15200 Annapolis Rd', 'Bowie', 'MD', '20715', 38.9426, -76.7302, 95, 3, 'partially_filled', true),
       ('3b000000-0000-4000-8000-000000000015', '3a000000-0000-4000-8000-000000000001', 'DMV Hoops Classic — U17 Final', 'tournament', 'youth', 'U17', 'boys', 10, '15:00', 120, 'Bowie Sports Center', '15200 Annapolis Rd', 'Bowie', 'MD', '20715', 38.9426, -76.7302, 120, 3, 'open', true),
       ('3b000000-0000-4000-8000-000000000016', '3a000000-0000-4000-8000-000000000002', 'Capital Fall League — Week 1', 'single', 'high_school', 'U18', 'boys', 4, '18:00', 120, 'Columbia Heights Rec Center', '1480 Girard St NW', 'Washington', 'DC', '20009', 38.9258, -77.0326, 110, 3, 'partially_filled', false),
       -- Outside the radius: Baltimore is ~30 miles out
       ('3b000000-0000-4000-8000-000000000017', null, 'Baltimore Holiday Invitational', 'tournament', 'high_school', 'U18', 'boys', 14, '10:00', 240, 'Baltimore Arena Annex', '201 W Baltimore St', 'Baltimore', 'MD', '21201', 39.2904, -76.6122, 150, 3, 'open', false),
       -- Morgan's season: completed and paid (or paying out)
       ('3b000000-0000-4000-8000-000000000020', null, 'Bowie Fall Opener', 'single', 'high_school', 'U18', 'boys', -40, '18:00', 120, 'Bowie Sports Center', '15200 Annapolis Rd', 'Bowie', 'MD', '20715', 38.9426, -76.7302, 110, 3, 'completed', false),
       ('3b000000-0000-4000-8000-000000000021', null, 'Silver Spring Showcase', 'tournament', 'youth', 'U16', 'girls', -33, '10:00', 240, 'Silver Spring Sports Center', '8500 Colesville Rd', 'Silver Spring', 'MD', '20910', 38.9967, -77.0261, 150, 3, 'completed', false),
       ('3b000000-0000-4000-8000-000000000022', null, 'Rockville Adult League', 'single', 'adult', 'adult', 'men', -26, '19:30', 90, 'Rockville Sports Complex', '100 Maryland Ave', 'Rockville', 'MD', '20850', 39.0840, -77.1528, 90, 2, 'completed', false),
       ('3b000000-0000-4000-8000-000000000023', null, 'College Park JV Night', 'single', 'high_school', 'U16', 'boys', -12, '17:00', 120, 'College Park Community Gym', '4321 Hartwick Rd', 'College Park', 'MD', '20740', 38.9807, -76.9369, 95, 3, 'completed', false),
       ('3b000000-0000-4000-8000-000000000024', null, 'Hyattsville Saturday League', 'single', 'youth', 'U14', 'co_ed', -5, '11:00', 90, 'Hyattsville Fieldhouse', '4310 Gallatin St', 'Hyattsville', 'MD', '20781', 38.9559, -76.9455, 75, 2, 'completed', false),
       ('3b000000-0000-4000-8000-000000000025', null, 'Capitol Hill Rec League', 'single', 'adult', 'adult', 'co_ed', -2, '19:00', 90, 'Capitol Hill Community Gym', '700 Pennsylvania Ave SE', 'Washington', 'DC', '20003', 38.8846, -76.9958, 70, 2, 'completed', false),
       -- Jamie's confirmed games
       ('3b000000-0000-4000-8000-000000000030', null, 'Northeast Rec Thursday', 'single', 'adult', 'adult', 'men', 3, '20:00', 90, 'Capitol Hill Community Gym', '700 Pennsylvania Ave SE', 'Washington', 'DC', '20003', 38.8846, -76.9958, 75, 2, 'partially_filled', false),
       ('3b000000-0000-4000-8000-000000000031', null, 'Landover Youth Saturday', 'single', 'youth', 'U13', 'boys', 13, '12:00', 90, 'Landover Rec Center', '8001 Sheriff Rd', 'Landover', 'MD', '20785', 38.9240, -76.8900, 65, 2, 'partially_filled', false)
     ) as v(id, tid, title, jtype, lvl, age, gender, d, at, mins, venue, addr, city, st, zip, lat, lng, pay, crew, status, featured)
where h.user_id = 'dc000000-0000-4000-8000-000000000004'
on conflict (id) do update set
  starts_local = excluded.starts_local,
  status = excluded.status,
  completed_at = excluded.completed_at,
  payment_status = excluded.payment_status,
  cancelled_at = null;

-- The Capital Fall League game is roster-only.
update public.jobs set assignor_staffing_mode = 'self_assign'
 where id = '3b000000-0000-4000-8000-000000000016';

-- ── Who's on what ───────────────────────────────────────────────────────────
-- Upserted so a re-seed puts everyone back where they were.
insert into public.job_assignments (job_id, ref_id, role, status, applied_at, responded_at, offered_at, offered_by, amount_due, payout_status, paid_at)
values
  -- Jamie: two confirmed, one application pending, one offer from the assignor
  ('3b000000-0000-4000-8000-000000000030', 'dc000000-0000-4000-8000-000000000001', 'crew_chief', 'accepted', now() - interval '6 days', now() - interval '5 days', null, null, null, null, null),
  ('3b000000-0000-4000-8000-000000000031', 'dc000000-0000-4000-8000-000000000001', 'official',   'accepted', now() - interval '4 days', now() - interval '3 days', null, null, null, null, null),
  ('3b000000-0000-4000-8000-000000000014', 'dc000000-0000-4000-8000-000000000001', 'official',   'pending',  now() - interval '1 day',  null, null, null, null, null, null),
  ('3b000000-0000-4000-8000-000000000016', 'dc000000-0000-4000-8000-000000000001', 'official',   'offered',  null, null, now() - interval '2 hours', 'dc000000-0000-4000-8000-000000000005', null, null, null),
  -- Morgan: a crew spot on the DMV Classic, an applicant on the U17 final, and a season of payouts
  ('3b000000-0000-4000-8000-000000000014', 'dc000000-0000-4000-8000-000000000002', 'crew_chief', 'accepted', now() - interval '8 days', now() - interval '7 days', null, null, null, null, null),
  ('3b000000-0000-4000-8000-000000000015', 'dc000000-0000-4000-8000-000000000002', 'official',   'pending',  now() - interval '1 day',  null, null, null, null, null, null),
  ('3b000000-0000-4000-8000-000000000016', 'dc000000-0000-4000-8000-000000000002', 'crew_chief', 'accepted', now() - interval '3 days', now() - interval '3 days', null, null, null, null, null),
  ('3b000000-0000-4000-8000-000000000020', 'dc000000-0000-4000-8000-000000000002', 'crew_chief', 'completed', now() - interval '50 days', now() - interval '49 days', null, null, 110, 'paid',    now() - interval '38 days'),
  ('3b000000-0000-4000-8000-000000000021', 'dc000000-0000-4000-8000-000000000002', 'official',   'completed', now() - interval '45 days', now() - interval '44 days', null, null, 150, 'paid',    now() - interval '31 days'),
  ('3b000000-0000-4000-8000-000000000022', 'dc000000-0000-4000-8000-000000000002', 'official',   'completed', now() - interval '35 days', now() - interval '34 days', null, null, 90,  'paid',    now() - interval '24 days'),
  ('3b000000-0000-4000-8000-000000000023', 'dc000000-0000-4000-8000-000000000002', 'crew_chief', 'completed', now() - interval '20 days', now() - interval '19 days', null, null, 95,  'paid',    now() - interval '10 days'),
  ('3b000000-0000-4000-8000-000000000024', 'dc000000-0000-4000-8000-000000000002', 'official',   'completed', now() - interval '10 days', now() - interval '9 days',  null, null, 75,  'pending', null),
  ('3b000000-0000-4000-8000-000000000025', 'dc000000-0000-4000-8000-000000000002', 'official',   'completed', now() - interval '6 days',  now() - interval '5 days',  null, null, 70,  'pending', null)
on conflict (job_id, ref_id) do update set
  role = excluded.role, status = excluded.status, applied_at = excluded.applied_at,
  responded_at = excluded.responded_at, offered_at = excluded.offered_at, offered_by = excluded.offered_by,
  amount_due = excluded.amount_due, payout_status = excluded.payout_status, paid_at = excluded.paid_at,
  withdrawn_at = null;

-- ── How each seeded game is played ──────────────────────────────────────────
-- 2 halves or 4 quarters, halves at most 20 minutes (0075). Covers the Texas
-- games from seed.sql too. Changing the format doesn't send crews to re-confirm.
update public.jobs j
   set game_format = case when j.level in ('high_school', 'juco') then 'quarters' else 'halves' end,
       period_minutes = case
         when j.level in ('high_school', 'juco') then 8
         when j.level = 'adult' then 20
         when j.age_group in ('U8', 'U9', 'U10', 'U11', 'U12') then 16
         else 18
       end
  from public.hirers h join auth.users u on u.id = h.user_id
 where h.id = j.hirer_id and u.email like '%@refee.local'
   and (j.game_format is null or j.period_minutes is null);

update public.tournaments t
   set game_format = 'halves', period_minutes = 18
  from public.hirers h join auth.users u on u.id = h.user_id
 where h.id = t.hirer_id and u.email like '%@refee.local'
   and (t.game_format is null or t.period_minutes is null);
