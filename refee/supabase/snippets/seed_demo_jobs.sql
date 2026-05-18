-- =============================================================================
-- Demo hirer + jobs — OPTIONAL if you already use supabase/seed.sql locally.
--
-- Local: `npm run supabase:db:reset` (or `npx supabase db reset`) seeds users +
-- jobs automatically via supabase/seed.sql.
--
-- Hosted: run this in Dashboard → SQL Editor after migrations, once you have
-- at least one user in Authentication (or create one in the dashboard).
--
-- Uses the same UUIDs as lib/jobs/mock-data.ts (SEED_JOB_IDS).
-- =============================================================================

insert into public.hirers (user_id, org_name, org_type, is_verified, city, state)
select u.id, 'Texas Hoops Org', 'tournament', true, 'Round Rock', 'TX'
from auth.users u
order by u.created_at asc
limit 1
on conflict (user_id) do update
  set org_name = excluded.org_name,
      org_type = excluded.org_type,
      is_verified = excluded.is_verified,
      city = excluded.city,
      state = excluded.state
returning id;

-- If the INSERT matched no auth user, stop here and create a user first.

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
order by h.created_at asc
limit 1
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
order by h.created_at asc
limit 1
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
order by h.created_at asc
limit 1
on conflict (id) do nothing;
