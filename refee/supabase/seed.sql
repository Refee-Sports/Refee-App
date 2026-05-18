-- =============================================================================
-- Local seed data — runs on `supabase start` (first time) and `supabase db reset`
-- See README → "Seed users & demo jobs"
-- =============================================================================

-- Stable user ids (use in tests / docs)
-- Referee  → sign in (555) 555-0100  →  +15555550100  →  OTP 123456
-- Director → sign in (555) 555-0101  →  +15555550101  →  OTP 123456

do $seed$
declare
  v_ref_id uuid := '11111111-1111-4111-8111-111111111100';
  v_dir_id uuid := '11111111-1111-4111-8111-111111111101';
  v_ref_phone text := '+15555550100';
  v_dir_phone text := '+15555550101';
begin
  -- ── Auth users (phone) ───────────────────────────────────────────────────
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    phone,
    phone_confirmed_at,
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
      '{"provider":"phone","providers":["phone"]}',
      '{"first_name":"Jordan","last_name":"Hayes"}',
      now(),
      now(),
      false
    )
  on conflict (id) do update set
    phone = excluded.phone,
    phone_confirmed_at = excluded.phone_confirmed_at,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values
    (
      v_ref_id,
      v_ref_id,
      v_ref_phone,
      jsonb_build_object('sub', v_ref_id::text, 'phone', v_ref_phone),
      'phone',
      now(),
      now(),
      now()
    ),
    (
      v_dir_id,
      v_dir_id,
      v_dir_phone,
      jsonb_build_object('sub', v_dir_id::text, 'phone', v_dir_phone),
      'phone',
      now(),
      now(),
      now()
    )
  on conflict (provider_id, provider) do update set
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
    (v_ref_id, 'Alex', 'Rivera', '1992-06-15', v_ref_phone, 'alex.ref@refee.local', 'Austin', 'TX', 'cleared'),
    (v_dir_id, 'Jordan', 'Hayes', '1988-03-22', v_dir_phone, 'jordan.dir@refee.local', 'Round Rock', 'TX', 'cleared')
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
  timestamptz '2026-05-04 14:00:00-05',
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
  timestamptz '2026-05-05 13:00:00-05',
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
  timestamptz '2026-05-07 23:00:00-05',
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
