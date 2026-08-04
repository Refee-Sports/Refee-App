-- =============================================================================
-- Local seed data — runs on `supabase start` (first time) and `supabase db reset`
-- See README → "Seed users & demo jobs"
-- =============================================================================

-- Stable user ids (use in tests / docs)
-- App entry: (555) 555-0100 → verify sends +15555550100 → OTP 123456
-- auth.users.phone must match GoTrue normalization (no leading +) or OTP creates a new user.

do $seed$
declare
  v_ref_id uuid := '11111111-1111-4111-8111-111111111100';
  v_dir_id uuid := '11111111-1111-4111-8111-111111111101';
  v_ref_phone text := '15555550100';
  v_dir_phone text := '15555550101';
begin
  -- ── Auth users (phone) ───────────────────────────────────────────────────
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    phone,
    phone_confirmed_at,
    encrypted_password,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    phone_change,
    phone_change_token,
    confirmation_sent_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_anonymous
  )
  values
    (
      '00000000-0000-0000-0000-000000000000',
      v_ref_id,
      'authenticated',
      'authenticated',
      v_ref_phone,
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      now(),
      '{"provider":"phone","providers":["phone"]}',
      '{"first_name":"Alex","last_name":"Rivera"}',
      now(),
      now(),
      false
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_dir_id,
      'authenticated',
      'authenticated',
      v_dir_phone,
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      now(),
      '{"provider":"phone","providers":["phone"]}',
      '{"first_name":"Jordan","last_name":"Hayes"}',
      now(),
      now(),
      false
    )
  on conflict (id) do update set
    phone = excluded.phone,
    phone_confirmed_at = excluded.phone_confirmed_at,
    encrypted_password = excluded.encrypted_password,
    confirmation_token = excluded.confirmation_token,
    recovery_token = excluded.recovery_token,
    email_change = excluded.email_change,
    email_change_token_new = excluded.email_change_token_new,
    phone_change = excluded.phone_change,
    phone_change_token = excluded.phone_change_token,
    confirmation_sent_at = excluded.confirmation_sent_at,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values
    (
      v_ref_id::text,
      v_ref_id,
      jsonb_build_object(
        'sub', v_ref_id::text,
        'email_verified', false,
        'phone_verified', true,
        'phone', v_ref_phone
      ),
      'phone',
      now(),
      now(),
      now()
    ),
    (
      v_dir_id::text,
      v_dir_id,
      jsonb_build_object(
        'sub', v_dir_id::text,
        'email_verified', false,
        'phone_verified', true,
        'phone', v_dir_phone
      ),
      'phone',
      now(),
      now(),
      now()
    )
  on conflict (provider_id, provider) do update set
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    updated_at = now();

  -- ── Public + private profiles ────────────────────────────────────────────
  insert into public.public_profiles (
    id,
    first_name,
    last_initial,
    city,
    state,
    rating,
    rating_count,
    games_called_total,
    is_active,
    is_available,
    is_verified,
    primary_role
  )
  values
    (v_ref_id, 'Alex', 'R', 'Austin', 'TX', 4.85, 42, 128, true, true, true, 'referee'),
    (v_dir_id, 'Jordan', 'H', 'Round Rock', 'TX', 0, 0, 0, true, false, true, 'director')
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_initial = excluded.last_initial,
    city = excluded.city,
    state = excluded.state,
    is_available = excluded.is_available,
    primary_role = excluded.primary_role;

  insert into public.private_profiles (
    id,
    legal_first_name,
    legal_last_name,
    date_of_birth,
    phone,
    email,
    city,
    state,
    background_check_status
  )
  values
    (v_ref_id, 'Alex', 'Rivera', '1992-06-15', '+' || v_ref_phone, 'alex.ref@refee.local', 'Austin', 'TX', 'cleared'),
    (v_dir_id, 'Jordan', 'Hayes', '1988-03-22', '+' || v_dir_phone, 'jordan.dir@refee.local', 'Round Rock', 'TX', 'cleared')
  on conflict (id) do update set
    phone = excluded.phone,
    email = excluded.email;

  insert into public.user_roles (user_id, role)
  values
    (v_ref_id, 'referee'),
    (v_dir_id, 'director'),
    (v_dir_id, 'assignor')
  on conflict do nothing;

  insert into public.ref_sports (ref_id, sport_id, years_experience)
  values (v_ref_id, 'basketball', 8)
  on conflict do nothing;

  -- ── Hirer (director org) ───────────────────────────────────────────────────
  insert into public.hirers (user_id, org_name, org_type, is_verified, city, state)
  values (v_dir_id, 'Texas Hoops Org', 'tournament', true, 'Round Rock', 'TX')
  on conflict (user_id) do update set
    org_name = excluded.org_name,
    org_type = excluded.org_type,
    is_verified = excluded.is_verified,
    city = excluded.city,
    state = excluded.state;
end
$seed$;

-- ── Demo jobs (UUIDs match lib/jobs/mock-data.ts SEED_JOB_IDS) ───────────────
insert into public.jobs (
  id,
  hirer_id,
  sport_id,
  title,
  job_type,
  level,
  age_group,
  gender,
  ruleset,
  starts_at,
  duration_minutes,
  venue_name,
  venue_address,
  venue_city,
  venue_state,
  pay_per_game,
  num_games,
  crew_size,
  status,
  is_featured,
  hirer_note,
  uniform_requirements,
  parking_info
)
select
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  h.id,
  'basketball',
  'Spring AAU Showcase',
  'tournament',
  'youth',
  'U16',
  'boys',
  'NFHS',
  timestamptz (now() + interval '5 days'),
  240,
  'Eastside Sports Complex',
  '2400 Mays St',
  'Round Rock',
  'TX',
  185,
  4,
  3,
  'partially_filled',
  true,
  'Crew arrives 15 min early for pre-game review. Concessions onsite.',
  'Black / white stripe',
  'Free · on-site'
from public.hirers h
where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid
on conflict (id) do nothing;

insert into public.jobs (
  id,
  hirer_id,
  sport_id,
  title,
  job_type,
  level,
  age_group,
  gender,
  ruleset,
  starts_at,
  duration_minutes,
  venue_name,
  venue_city,
  venue_state,
  pay_per_game,
  num_games,
  crew_size,
  status,
  is_featured,
  hirer_note,
  uniform_requirements,
  parking_info
)
select
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid,
  h.id,
  'basketball',
  'Lakeway Tournament',
  'multi_day',
  'youth',
  'U18',
  'girls',
  'NFHS',
  timestamptz (now() + interval '8 days'),
  480,
  'Lakeway HS Gym',
  'Lakeway',
  'TX',
  420,
  1,
  3,
  'open',
  true,
  'Bring two whistles.',
  'Grey shirt',
  'Lot B'
from public.hirers h
where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid
on conflict (id) do nothing;

insert into public.jobs (
  id,
  hirer_id,
  sport_id,
  title,
  job_type,
  level,
  age_group,
  gender,
  ruleset,
  starts_at,
  duration_minutes,
  venue_name,
  venue_city,
  venue_state,
  pay_per_game,
  num_games,
  crew_size,
  status,
  is_featured,
  uniform_requirements,
  parking_info
)
select
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,
  h.id,
  'basketball',
  'Austin Rec Court 3',
  'single',
  'adult',
  'adult',
  'co_ed',
  'FIBA',
  timestamptz (now() + interval '12 days'),
  90,
  'Austin Rec Center',
  'Austin',
  'TX',
  85,
  1,
  2,
  'open',
  false,
  'Black / white',
  'Street'
from public.hirers h
where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid
on conflict (id) do nothing;

-- =============================================================================
-- ENRICHED SEED — 4 new test scenarios
-- Ref (new/blank) → (555) 555-0102 → Sam T, Denver CO (zero games)
-- Ref (earnings)  → (555) 555-0103 → Marcus J, Houston TX (completed games for earnings switcher)
-- Ref (upcoming)  → (555) 555-0104 → Devon K, San Antonio TX (accepted future games)
-- Dir 2 (rich)    → (555) 555-0105 → Taylor W, DFW Hoops Coalition, Dallas TX
-- All OTP: 123456
-- =============================================================================

-- ── Enrich existing referee (Alex R) with certs, levels, availability ────────
insert into public.certifications (ref_id, org_name, license_number, issued_date, is_verified)
values
  ('11111111-1111-4111-8111-111111111100'::uuid, 'iaabo', 'TX-8821', '2018-06-01', true),
  ('11111111-1111-4111-8111-111111111100'::uuid, 'nfhs',  'N-44012', '2020-03-15', true)
on conflict do nothing;

insert into public.ref_levels (ref_id, level_id, years_experience)
values
  ('11111111-1111-4111-8111-111111111100'::uuid, 'youth_rec',   8),
  ('11111111-1111-4111-8111-111111111100'::uuid, 'high_school',  5),
  ('11111111-1111-4111-8111-111111111100'::uuid, 'juco',         2)
on conflict do nothing;

insert into public.availability_prefs (ref_id, available_days, travel_radius_miles, min_pay_per_game)
values ('11111111-1111-4111-8111-111111111100'::uuid, 62, 40, 75)
on conflict do nothing;

do $extra$
declare
  v_ref2_id    uuid := '22222222-2222-4222-8222-222222222200';
  v_ref2_phone text := '15555550102';
  v_ref3_id    uuid := '22222222-2222-4222-8222-222222222201';
  v_ref3_phone text := '15555550103';
  v_ref4_id    uuid := '22222222-2222-4222-8222-222222222202';
  v_ref4_phone text := '15555550104';
  v_dir2_id    uuid := '22222222-2222-4222-8222-222222222203';
  v_dir2_phone text := '15555550105';

  v_dir1_hirer_id uuid;
  v_dir2_hirer_id uuid;
  v_tournament_id  uuid;

  j_wk1 uuid := 'ee000000-0000-4000-8000-000000000001';
  j_wk2 uuid := 'ee000000-0000-4000-8000-000000000002';
  j_wk3 uuid := 'ee000000-0000-4000-8000-000000000003';
  j_mo1 uuid := 'ee000000-0000-4000-8000-000000000004';
  j_mo2 uuid := 'ee000000-0000-4000-8000-000000000005';
  j_yr1 uuid := 'ee000000-0000-4000-8000-000000000006';
  j_yr2 uuid := 'ee000000-0000-4000-8000-000000000007';
  j_yr3 uuid := 'ee000000-0000-4000-8000-000000000008';
  j_up1 uuid := 'ff000000-0000-4000-8000-000000000001';
  j_up2 uuid := 'ff000000-0000-4000-8000-000000000002';
  j_up3 uuid := 'ff000000-0000-4000-8000-000000000003';
begin

  -- ── Auth users ─────────────────────────────────────────────────────────────
  insert into auth.users (
    instance_id, id, aud, role, phone, phone_confirmed_at,
    encrypted_password, confirmation_token, recovery_token,
    email_change, email_change_token_new, phone_change, phone_change_token,
    confirmation_sent_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous
  )
  values
    ('00000000-0000-0000-0000-000000000000', v_ref2_id, 'authenticated', 'authenticated',
     v_ref2_phone, now(), '', '', '', '', '', '', '', now(),
     '{"provider":"phone","providers":["phone"]}',
     '{"first_name":"Sam","last_name":"Torres"}', now(), now(), false),
    ('00000000-0000-0000-0000-000000000000', v_ref3_id, 'authenticated', 'authenticated',
     v_ref3_phone, now(), '', '', '', '', '', '', '', now(),
     '{"provider":"phone","providers":["phone"]}',
     '{"first_name":"Marcus","last_name":"Johnson"}', now(), now(), false),
    ('00000000-0000-0000-0000-000000000000', v_ref4_id, 'authenticated', 'authenticated',
     v_ref4_phone, now(), '', '', '', '', '', '', '', now(),
     '{"provider":"phone","providers":["phone"]}',
     '{"first_name":"Devon","last_name":"Kim"}', now(), now(), false),
    ('00000000-0000-0000-0000-000000000000', v_dir2_id, 'authenticated', 'authenticated',
     v_dir2_phone, now(), '', '', '', '', '', '', '', now(),
     '{"provider":"phone","providers":["phone"]}',
     '{"first_name":"Taylor","last_name":"Wright"}', now(), now(), false)
  on conflict (id) do update set
    phone = excluded.phone,
    phone_confirmed_at = excluded.phone_confirmed_at,
    encrypted_password = excluded.encrypted_password,
    confirmation_token = excluded.confirmation_token,
    recovery_token = excluded.recovery_token,
    email_change = excluded.email_change,
    email_change_token_new = excluded.email_change_token_new,
    phone_change = excluded.phone_change,
    phone_change_token = excluded.phone_change_token,
    confirmation_sent_at = excluded.confirmation_sent_at,
    updated_at = now();

  insert into auth.identities (provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at)
  values
    (v_ref2_id::text, v_ref2_id,
     jsonb_build_object('sub', v_ref2_id::text, 'email_verified', false, 'phone_verified', true, 'phone', v_ref2_phone),
     'phone', now(), now(), now()),
    (v_ref3_id::text, v_ref3_id,
     jsonb_build_object('sub', v_ref3_id::text, 'email_verified', false, 'phone_verified', true, 'phone', v_ref3_phone),
     'phone', now(), now(), now()),
    (v_ref4_id::text, v_ref4_id,
     jsonb_build_object('sub', v_ref4_id::text, 'email_verified', false, 'phone_verified', true, 'phone', v_ref4_phone),
     'phone', now(), now(), now()),
    (v_dir2_id::text, v_dir2_id,
     jsonb_build_object('sub', v_dir2_id::text, 'email_verified', false, 'phone_verified', true, 'phone', v_dir2_phone),
     'phone', now(), now(), now())
  on conflict (provider_id, provider) do update set
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    updated_at = now();

  -- ── Public profiles ────────────────────────────────────────────────────────
  insert into public.public_profiles
    (id, first_name, last_initial, city, state, rating, rating_count,
     games_called_total, is_active, is_available, is_verified, primary_role)
  values
    (v_ref2_id, 'Sam',    'T', 'Denver',      'CO', 0.00, 0,  0,   true, false, false, 'referee'),
    (v_ref3_id, 'Marcus', 'J', 'Houston',     'TX', 4.92, 87, 312, true, true,  true,  'referee'),
    (v_ref4_id, 'Devon',  'K', 'San Antonio', 'TX', 4.71, 29, 94,  true, true,  true,  'referee'),
    (v_dir2_id, 'Taylor', 'W', 'Dallas',      'TX', 0.00, 0,  0,   true, false, true,  'director')
  on conflict (id) do update set
    first_name = excluded.first_name, last_initial = excluded.last_initial,
    city = excluded.city, state = excluded.state, primary_role = excluded.primary_role;

  -- ── Private profiles ───────────────────────────────────────────────────────
  insert into public.private_profiles
    (id, legal_first_name, legal_last_name, date_of_birth, phone, email, city, state, background_check_status)
  values
    (v_ref2_id, 'Sam',    'Torres',  '1999-09-04', '+' || v_ref2_phone, 'sam.ref@refee.local',    'Denver',      'CO', 'pending'),
    (v_ref3_id, 'Marcus', 'Johnson', '1986-11-22', '+' || v_ref3_phone, 'marcus.ref@refee.local', 'Houston',     'TX', 'cleared'),
    (v_ref4_id, 'Devon',  'Kim',     '1993-04-17', '+' || v_ref4_phone, 'devon.ref@refee.local',  'San Antonio', 'TX', 'cleared'),
    (v_dir2_id, 'Taylor', 'Wright',  '1984-07-30', '+' || v_dir2_phone, 'taylor.dir@refee.local', 'Dallas',      'TX', 'cleared')
  on conflict (id) do update set phone = excluded.phone, email = excluded.email;

  insert into public.user_roles (user_id, role) values
    (v_ref2_id, 'referee'),
    (v_ref3_id, 'referee'),
    (v_ref4_id, 'referee'),
    (v_dir2_id, 'director')
  on conflict do nothing;

  insert into public.ref_sports (ref_id, sport_id, years_experience) values
    (v_ref3_id, 'basketball', 14),
    (v_ref4_id, 'basketball',  6)
  on conflict do nothing;

  -- ── Certifications ─────────────────────────────────────────────────────────
  insert into public.certifications (ref_id, org_name, license_number, issued_date, is_verified) values
    (v_ref3_id, 'iaabo', 'TX-1142', '2012-08-01', true),
    (v_ref3_id, 'nfhs',  'N-20987', '2013-05-10', true),
    (v_ref3_id, 'ncaa',  'C-00331', '2017-01-15', true),
    (v_ref4_id, 'nfhs',  'N-78234', '2021-07-20', true)
  on conflict do nothing;

  -- ── Levels ─────────────────────────────────────────────────────────────────
  insert into public.ref_levels (ref_id, level_id, years_experience) values
    (v_ref3_id, 'youth_rec',   14),
    (v_ref3_id, 'high_school', 12),
    (v_ref3_id, 'juco',         8),
    (v_ref3_id, 'naia',         5),
    (v_ref3_id, 'ncaa_mens',    3),
    (v_ref3_id, 'ncaa_womens',  3),
    (v_ref4_id, 'youth_rec',    6),
    (v_ref4_id, 'high_school',  4)
  on conflict do nothing;

  -- ── Availability ───────────────────────────────────────────────────────────
  -- Marcus: weekends (0b1000001 = 65), 50-mile radius
  insert into public.availability_prefs (ref_id, available_days, travel_radius_miles, min_pay_per_game)
  values (v_ref3_id, 65, 50, 120) on conflict do nothing;

  -- Devon: all days (0b1111111 = 127), 30-mile radius
  insert into public.availability_prefs (ref_id, available_days, travel_radius_miles, min_pay_per_game)
  values (v_ref4_id, 127, 30, 60) on conflict do nothing;

  -- ── Director 2: hirer + tournament ─────────────────────────────────────────
  insert into public.hirers (user_id, org_name, org_type, is_verified, city, state,
    contact_first_name, contact_last_initial)
  values (v_dir2_id, 'DFW Hoops Coalition', 'tournament', true, 'Dallas', 'TX', 'Taylor', 'W')
  on conflict (user_id) do update set org_name = excluded.org_name, city = excluded.city;

  select id into v_dir2_hirer_id from public.hirers where user_id = v_dir2_id;
  select id into v_dir1_hirer_id from public.hirers where user_id = '11111111-1111-4111-8111-111111111101'::uuid;

  insert into public.tournaments
    (hirer_id, name, description, sport_id, starts_on, ends_on,
     venue_name, venue_city, venue_state, total_games, pay_per_game, status)
  values
    (v_dir2_hirer_id,
     'DFW Summer Slam',
     '3-day summer invitational — 24 teams, all divisions',
     'basketball',
     (current_date + interval '30 days')::date,
     (current_date + interval '32 days')::date,
     'American Airlines Center Auxiliary Gym', 'Dallas', 'TX',
     36, 160, 'open')
  on conflict do nothing
  returning id into v_tournament_id;

  if v_tournament_id is not null then
    insert into public.jobs
      (hirer_id, tournament_id, sport_id, title, job_type, level, age_group, gender, ruleset,
       starts_at, duration_minutes, venue_name, venue_city, venue_state,
       pay_per_game, num_games, crew_size, status, is_featured, uniform_requirements)
    values
      (v_dir2_hirer_id, v_tournament_id, 'basketball',
       'DFW Summer Slam — Pool A Day 1', 'tournament', 'high_school', 'U18', 'boys', 'NFHS',
       (now() + interval '30 days'), 120, 'AAC Auxiliary Court 1', 'Dallas', 'TX',
       160, 3, 3, 'open', true, 'Black / white stripe'),
      (v_dir2_hirer_id, v_tournament_id, 'basketball',
       'DFW Summer Slam — Pool B Day 1', 'tournament', 'high_school', 'U18', 'girls', 'NFHS',
       (now() + interval '30 days' + interval '4 hours'), 120, 'AAC Auxiliary Court 2', 'Dallas', 'TX',
       160, 3, 2, 'partially_filled', false, 'Black / white stripe'),
      (v_dir2_hirer_id, v_tournament_id, 'basketball',
       'DFW Summer Slam — Finals', 'tournament', 'high_school', 'U18', 'boys', 'NFHS',
       (now() + interval '32 days'), 120, 'AAC Auxiliary Court 1', 'Dallas', 'TX',
       200, 1, 3, 'open', true, 'Black / white stripe')
    on conflict do nothing;
  end if;

  -- ── Marcus: past completed jobs (earnings) ─────────────────────────────────
  -- This week 3 × $150 = $450
  insert into public.jobs (id, hirer_id, sport_id, title, job_type, level, age_group, gender, ruleset,
    starts_at, duration_minutes, venue_name, venue_city, venue_state, pay_per_game, crew_size, status)
  values
    (j_wk1, v_dir1_hirer_id, 'basketball', 'Rec Tuesday Night', 'single', 'adult', 'adult', 'men', 'FIBA',
     (now() - interval '2 days'),   90, 'Austin Rec Center', 'Austin', 'TX', 150, 2, 'completed'),
    (j_wk2, v_dir1_hirer_id, 'basketball', 'Rec Wednesday Night', 'single', 'adult', 'adult', 'men', 'FIBA',
     (now() - interval '1 day'),    90, 'Austin Rec Center', 'Austin', 'TX', 150, 2, 'completed'),
    (j_wk3, v_dir1_hirer_id, 'basketball', 'Rec Thursday Night', 'single', 'adult', 'adult', 'co_ed', 'FIBA',
     (now() - interval '12 hours'), 90, 'Austin Rec Center', 'Austin', 'TX', 150, 2, 'completed')
  on conflict (id) do nothing;

  -- This month, not this week: 2 × $200 = $400 (total month = $850)
  insert into public.jobs (id, hirer_id, sport_id, title, job_type, level, age_group, gender, ruleset,
    starts_at, duration_minutes, venue_name, venue_city, venue_state, pay_per_game, crew_size, status)
  values
    (j_mo1, v_dir1_hirer_id, 'basketball', 'East Side League — Boys', 'single', 'high_school', 'U18', 'boys', 'NFHS',
     (date_trunc('month', now()) + interval '3 days'), 120, 'Eastside HS Gym', 'Austin', 'TX', 200, 3, 'completed'),
    (j_mo2, v_dir1_hirer_id, 'basketball', 'East Side League — Girls', 'single', 'high_school', 'U18', 'girls', 'NFHS',
     (date_trunc('month', now()) + interval '5 days'), 120, 'Eastside HS Gym', 'Austin', 'TX', 200, 3, 'completed')
  on conflict (id) do nothing;

  -- This year, not this month: 3 × $175 = $525 (total year = $1,375)
  insert into public.jobs (id, hirer_id, sport_id, title, job_type, level, age_group, gender, ruleset,
    starts_at, duration_minutes, venue_name, venue_city, venue_state, pay_per_game, crew_size, status)
  values
    (j_yr1, v_dir1_hirer_id, 'basketball', 'Winter AAU Showcase G1', 'tournament', 'juco', 'adult', 'men', 'NCAA',
     make_date(extract(year from now())::int, 1, 15), 90, 'Round Rock Sportsplex', 'Round Rock', 'TX', 175, 3, 'completed'),
    (j_yr2, v_dir1_hirer_id, 'basketball', 'Winter AAU Showcase G2', 'tournament', 'juco', 'adult', 'men', 'NCAA',
     make_date(extract(year from now())::int, 2, 8),  90, 'Round Rock Sportsplex', 'Round Rock', 'TX', 175, 3, 'completed'),
    (j_yr3, v_dir1_hirer_id, 'basketball', 'Spring Invitational Semi', 'tournament', 'high_school', 'U18', 'girls', 'NFHS',
     make_date(extract(year from now())::int, 3, 22), 90, 'Cedar Park Gym',        'Cedar Park',  'TX', 175, 3, 'completed')
  on conflict (id) do nothing;

  insert into public.job_assignments (job_id, ref_id, role, status, applied_at, responded_at, amount_due, payout_status)
  values
    (j_wk1, v_ref3_id, 'crew_chief', 'completed', now()-interval'10 days', now()-interval'10 days', 150, 'paid'),
    (j_wk2, v_ref3_id, 'official',   'completed', now()-interval'10 days', now()-interval'10 days', 150, 'paid'),
    (j_wk3, v_ref3_id, 'official',   'completed', now()-interval'10 days', now()-interval'10 days', 150, 'paid'),
    (j_mo1, v_ref3_id, 'crew_chief', 'completed', now()-interval'20 days', now()-interval'20 days', 200, 'paid'),
    (j_mo2, v_ref3_id, 'official',   'completed', now()-interval'20 days', now()-interval'20 days', 200, 'paid'),
    (j_yr1, v_ref3_id, 'crew_chief', 'completed', now()-interval'90 days', now()-interval'90 days', 175, 'paid'),
    (j_yr2, v_ref3_id, 'official',   'completed', now()-interval'90 days', now()-interval'90 days', 175, 'paid'),
    (j_yr3, v_ref3_id, 'official',   'completed', now()-interval'90 days', now()-interval'90 days', 175, 'paid')
  on conflict (job_id, ref_id) do nothing;

  -- ── Devon: upcoming accepted jobs ─────────────────────────────────────────
  insert into public.jobs (id, hirer_id, sport_id, title, job_type, level, age_group, gender, ruleset,
    starts_at, duration_minutes, venue_name, venue_city, venue_state, pay_per_game, crew_size, status)
  values
    (j_up1, v_dir1_hirer_id, 'basketball',
     'Spring AAU Showcase — Court 4', 'tournament', 'youth', 'U16', 'boys', 'NFHS',
     (now() + interval '3 days'), 120, 'Northside Gym', 'San Antonio', 'TX', 120, 3, 'partially_filled'),
    (j_up2, v_dir2_hirer_id, 'basketball',
     'DFW Summer Slam — Pool C', 'tournament', 'high_school', 'U18', 'girls', 'NFHS',
     (now() + interval '10 days'), 120, 'AAC Auxiliary Court 3', 'Dallas', 'TX', 160, 2, 'partially_filled'),
    (j_up3, v_dir1_hirer_id, 'basketball',
     'Thursday Night League', 'single', 'adult', 'adult', 'co_ed', 'FIBA',
     (now() + interval '21 days'), 90, 'Austin Rec Center', 'Austin', 'TX', 85, 2, 'open')
  on conflict (id) do nothing;

  insert into public.job_assignments (job_id, ref_id, role, status, applied_at, responded_at)
  values
    (j_up1, v_ref4_id, 'official',   'accepted', now()-interval'5 days', now()-interval'4 days'),
    (j_up2, v_ref4_id, 'crew_chief', 'accepted', now()-interval'3 days', now()-interval'2 days'),
    (j_up3, v_ref4_id, 'official',   'accepted', now()-interval'1 day',  now()-interval'12 hours')
  on conflict (job_id, ref_id) do nothing;

end
$extra$;
