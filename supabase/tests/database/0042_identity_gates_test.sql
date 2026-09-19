begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

-- Stable local seed identities: director/assignor 111...101 (the seed gives
-- that user both roles), referee 222...202.
--
-- The fixtures below are written by the backend, which the gates don't apply
-- to — that's how an unverified person can have games to look at in the first
-- place.

-- Everyone here starts unverified. Set rather than assumed: the seed approves
-- local accounts so development isn't blocked.
update public.private_profiles
set identity_status = 'unstarted', identity_verified_at = null
where id in (
  '11111111-1111-4111-8111-111111111101',
  '22222222-2222-4222-8222-222222222202'
);

insert into public.tournaments (
  id, hirer_id, name, sport_id, starts_on, ends_on,
  venue_name, venue_address, venue_zip, venue_city, venue_state,
  game_format, period_minutes, ruleset, uniform_requirements,
  timezone, status, staffing_model, assignor_id, assignor_status
)
select
  '98000000-0000-4000-8000-000000000001'::uuid, h.id, 'Gate Test Classic', 'basketball',
  current_date + 30, current_date + 31,
  'Gate Gym', '1301 Shoal Creek Blvd', '78701', 'Austin', 'TX',
  'halves', 20, 'NFHS', 'Black and white stripes',
  'America/Chicago', 'open', 'direct',
  '11111111-1111-4111-8111-111111111101'::uuid, 'inviting'
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

insert into public.jobs (
  id, hirer_id, sport_id, title, home_team, away_team, level,
  starts_at, duration_minutes, venue_name, venue_address, venue_zip, venue_city, venue_state,
  game_format, period_minutes, ruleset, uniform_requirements,
  pay_per_game, crew_size, job_type, status, num_games
)
select
  job_id, h.id, 'basketball', 'Gate A vs Gate B', 'Gate A', 'Gate B', 'high_school',
  starts_at, 90, 'Gate Gym', '1301 Shoal Creek Blvd', '78701', 'Austin', 'TX',
  'halves', 20, 'NFHS', 'Black and white stripes',
  95, 3, 'single', 'open', 1
from public.hirers h
cross join (
  values
    ('98000000-0000-4000-8000-0000000000a1'::uuid, now() + interval '30 days'),
    ('98000000-0000-4000-8000-0000000000a2'::uuid, now() + interval '31 days'),
    ('98000000-0000-4000-8000-0000000000a3'::uuid, now() + interval '32 days')
) as games(job_id, starts_at)
where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

insert into public.assignor_rosters (assignor_id, ref_id, status, invited_at)
values (
  '11111111-1111-4111-8111-111111111101'::uuid,
  '22222222-2222-4222-8222-222222222202'::uuid,
  'invited',
  now()
);

insert into public.assignor_proposals (tournament_id, assignor_id, status, fee_type, invited_at)
values (
  '98000000-0000-4000-8000-000000000001'::uuid,
  '11111111-1111-4111-8111-111111111101'::uuid,
  'invited', 'flat', now()
);

-- ── A referee who hasn't verified ────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222202', true);

select throws_ok(
  $$ select public.respond_to_job('98000000-0000-4000-8000-0000000000a1'::uuid, true) $$,
  '42501', 'Verify your ID before applying to games.',
  'an unverified referee cannot apply to a game'
);

select results_eq(
  $$ select public.respond_to_job('98000000-0000-4000-8000-0000000000a1'::uuid, false) $$,
  array['declined'::text],
  'but can still decline one — nobody is trapped in work they can back out of'
);

select throws_ok(
  $$ select public.respond_to_roster_invite(
       (select id from public.assignor_rosters
        where ref_id = '22222222-2222-4222-8222-222222222202'), true) $$,
  '42501', 'Verify your ID before joining a roster.',
  'nor join an assignor roster'
);

select results_eq(
  $$ select public.respond_to_roster_invite(
       (select id from public.assignor_rosters
        where ref_id = '22222222-2222-4222-8222-222222222202'), false) $$,
  array['declined'::text],
  'but can decline the invitation'
);

reset role;

-- ── The same referee, once Didit has approved them ───────────────────────────

update public.private_profiles
set identity_status = 'approved', identity_verified_at = now()
where id = '22222222-2222-4222-8222-222222222202';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222202', true);

select lives_ok(
  $$ select public.respond_to_job('98000000-0000-4000-8000-0000000000a2'::uuid, true) $$,
  'a verified referee can apply'
);

reset role;

-- ── A director / assignor who hasn't verified ────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select throws_ok(
  $$ insert into public.jobs (hirer_id, sport_id, title, home_team, away_team, level, crew_size,
                              pay_per_game, starts_at, venue_name, venue_address, venue_zip,
                              venue_city, venue_state, game_format, period_minutes, ruleset,
                              uniform_requirements, job_type, status, num_games)
     select h.id, 'basketball', 'New vs Game', 'New', 'Game', 'high_school', 2, 80,
            now() + interval '40 days', 'Gate Gym', '1301 Shoal Creek Blvd', '78701',
            'Austin', 'TX', 'halves', 20, 'NFHS', 'Stripes', 'single', 'open', 1
     from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  '42501', 'Verify your ID before posting games.',
  'an unverified director cannot post a game'
);

select throws_ok(
  $$ insert into public.tournaments (hirer_id, name, sport_id, starts_on, ends_on, venue_name,
                                     venue_address, venue_zip, venue_city, venue_state,
                                     game_format, period_minutes, ruleset, uniform_requirements,
                                     timezone, status, staffing_model)
     select h.id, 'Unverified Cup', 'basketball', current_date + 40, current_date + 41,
            'Gate Gym', '1301 Shoal Creek Blvd', '78701', 'Austin', 'TX',
            'halves', 20, 'NFHS', 'Stripes', 'America/Chicago', 'open', 'direct'
     from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  '42501', 'Verify your ID before posting games.',
  'nor create a tournament'
);

select throws_ok(
  $$ select public.import_tournament_schedule(
       '98000000-0000-4000-8000-000000000001'::uuid,
       '[{"home_team":"A","away_team":"B","starts_local":"2030-01-01T10:00","crew_size":"2",
          "pay_per_game":"75","duration_minutes":"90","level":"high_school"}]'::jsonb) $$,
  '42501', 'Verify your ID before posting games.',
  'nor import a schedule'
);

select throws_ok(
  $$ select public.invite_existing_ref_to_roster('11111111-1111-4111-8111-111111111100'::uuid) $$,
  '42501', 'Verify your ID before staffing games.',
  'an unverified assignor cannot build a roster'
);

select throws_ok(
  $$ select public.submit_assignor_proposal(
       '98000000-0000-4000-8000-000000000001'::uuid, 'flat', 500, null, 'Happy to take it') $$,
  '42501', 'Verify your ID before staffing games.',
  'nor bid to staff a tournament'
);

-- The gate is on posting work, not on touching a row: an unverified director
-- can still run the games they already have.
select lives_ok(
  $$ update public.jobs set pay_per_game = 105
     where id = '98000000-0000-4000-8000-0000000000a3' $$,
  'but can still change the pay on a game they already posted'
);

reset role;

-- ── The same director, once approved ─────────────────────────────────────────

update public.private_profiles
set identity_status = 'approved', identity_verified_at = now()
where id = '11111111-1111-4111-8111-111111111101';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select lives_ok(
  $$ insert into public.jobs (hirer_id, sport_id, title, home_team, away_team, level, crew_size,
                              pay_per_game, starts_at, venue_name, venue_address, venue_zip,
                              venue_city, venue_state, game_format, period_minutes, ruleset,
                              uniform_requirements, job_type, status, num_games)
     select h.id, 'basketball', 'Verified vs Game', 'Verified', 'Game', 'high_school', 2, 80,
            now() + interval '41 days', 'Gate Gym', '1301 Shoal Creek Blvd', '78701',
            'Austin', 'TX', 'halves', 20, 'NFHS', 'Stripes', 'single', 'open', 1
     from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  'a verified director can post a game'
);

reset role;

select * from finish();
rollback;
