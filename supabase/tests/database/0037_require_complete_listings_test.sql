begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

-- Posting needs a verified identity (0042), checked before the listing itself
-- is inspected; this test is about completeness, so its director is verified.
insert into public.private_profiles (id, identity_status, identity_verified_at)
values ('11111111-1111-4111-8111-111111111101'::uuid, 'approved', now())
on conflict (id) do update
  set identity_status = 'approved', identity_verified_at = now();

-- Backend writes are trusted: an incomplete tournament and game can still be
-- written by the backend (seed data, older listings), just not by the apps.
insert into public.tournaments (id, hirer_id, name, sport_id, starts_on, ends_on, venue_name, venue_city, venue_state,
                                timezone, status, staffing_model)
select '97000000-0000-4000-8000-000000000001'::uuid, h.id, 'Incomplete Cup', 'basketball',
       current_date + 30, current_date + 30, 'Old Gym', 'Austin', 'TX', 'America/Chicago', 'open', 'direct'
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

insert into public.jobs (id, hirer_id, sport_id, title, home_team, away_team, level, crew_size, pay_per_game,
                         starts_at, venue_name, venue_city, venue_state, job_type, status, num_games)
select '97000000-0000-4000-8000-0000000000a1'::uuid, h.id, 'basketball', 'Old vs Game', 'Old', 'Game', 'high_school', 2, 60,
       now() + interval '30 days', 'Old Gym', 'Austin', 'TX', 'single', 'open', 1
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

select ok(
  exists (select 1 from public.jobs where id = '97000000-0000-4000-8000-0000000000a1'),
  'the backend can still write an incomplete game (seed data, older listings)'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select throws_like(
  $$ insert into public.jobs (hirer_id, sport_id, title, home_team, away_team, level, crew_size, pay_per_game, starts_at,
                              venue_name, venue_city, venue_state, game_format, period_minutes, ruleset, uniform_requirements,
                              job_type, status, num_games)
     select h.id, 'basketball', 'A vs B', 'A', 'B', 'high_school', 2, 75, now() + interval '30 days',
            'Main Gym', 'Austin', 'TX', 'quarters', 8, 'NFHS', 'Stripes', 'single', 'open', 1
     from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  'Missing game details: street address, ZIP code',
  'a director cannot post a game without the street address and ZIP'
);

select throws_like(
  $$ insert into public.jobs (hirer_id, sport_id, title, home_team, away_team, level, crew_size, pay_per_game, starts_at,
                              venue_name, venue_address, venue_zip, venue_city, venue_state, job_type, status, num_games)
     select h.id, 'basketball', 'A vs B', 'A', 'B', 'high_school', 2, 75, now() + interval '30 days',
            'Main Gym', '1301 Shoal Creek Blvd', '78701', 'Austin', 'TX', 'single', 'open', 1
     from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  'Missing game details: game format, minutes per period, ruleset, uniform',
  'or without the format, ruleset and uniform'
);

select throws_like(
  $$ insert into public.jobs (hirer_id, sport_id, title, home_team, away_team, level, crew_size, pay_per_game, starts_at,
                              venue_name, venue_address, venue_zip, venue_city, venue_state, game_format, period_minutes,
                              ruleset, uniform_requirements, job_type, status, num_games)
     select h.id, 'basketball', 'A vs B', 'A', 'B', 'youth_rec', 2, 45, now() + interval '30 days',
            'Main Gym', '1301 Shoal Creek Blvd', '78701', 'Austin', 'TX', 'halves', 16, 'NFHS', 'Stripes', 'single', 'open', 1
     from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  'Missing game details: age group',
  'a youth game needs an age group'
);

select lives_ok(
  $$ insert into public.jobs (id, hirer_id, sport_id, title, home_team, away_team, level, crew_size, pay_per_game, starts_at,
                              venue_name, venue_address, venue_zip, venue_city, venue_state, game_format, period_minutes,
                              ruleset, uniform_requirements, job_type, status, num_games)
     select '97000000-0000-4000-8000-0000000000b1', h.id, 'basketball', 'A vs B', 'A', 'B', 'high_school', 2, 75,
            now() + interval '30 days', 'Main Gym', '1301 Shoal Creek Blvd', '78701', 'Austin', 'TX', 'quarters', 8,
            'NFHS', 'Stripes', 'single', 'open', 1
     from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  'a complete game posts'
);

select throws_like(
  $$ update public.jobs set venue_address = '' where id = '97000000-0000-4000-8000-0000000000b1' $$,
  'Missing game details: street address',
  'the street address cannot be cleared later'
);

select lives_ok(
  $$ update public.jobs set hirer_note = 'Park in lot B' where id = '97000000-0000-4000-8000-0000000000a1' $$,
  'an older incomplete game still takes changes that do not touch its details'
);

select throws_like(
  $$ insert into public.tournaments (hirer_id, name, sport_id, starts_on, ends_on, venue_name, venue_address, venue_city,
                                     venue_state, game_format, period_minutes, ruleset, uniform_requirements, status,
                                     staffing_model)
     select h.id, 'No ZIP Classic', 'basketball', current_date + 40, current_date + 41, 'Main Gym', '1301 Shoal Creek Blvd',
            'Austin', 'TX', 'quarters', 8, 'NFHS', 'Stripes', 'open', 'direct'
     from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  'Missing tournament details: ZIP code',
  'a director cannot create a tournament without a ZIP'
);

select lives_ok(
  $$ insert into public.tournaments (hirer_id, name, sport_id, starts_on, ends_on, venue_name, venue_address, venue_zip,
                                     venue_city, venue_state, game_format, period_minutes, ruleset, uniform_requirements,
                                     status, staffing_model)
     select h.id, 'Complete Classic', 'basketball', current_date + 40, current_date + 41, 'Main Gym', '1301 Shoal Creek Blvd',
            '78701', 'Austin', 'TX', 'quarters', 8, 'NFHS', 'Stripes', 'open', 'direct'
     from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  'a complete tournament is created'
);

select throws_ok(
  format(
    $$ select public.import_tournament_schedule('97000000-0000-4000-8000-000000000001', jsonb_build_array(
         jsonb_build_object('home_team', 'A', 'away_team', 'B', 'starts_local', '%sT10:00', 'level', 'high_school',
                            'crew_size', 2, 'pay_per_game', 75, 'duration_minutes', 32,
                            'game_format', 'quarters', 'period_minutes', 8))) $$,
    (current_date + 30)::text
  ),
  'P0001',
  'Add the tournament''s street address and ZIP before importing games',
  'games cannot be imported into a tournament missing its address'
);

reset role;
select is(
  (select count(*)::int from public.jobs where tournament_id = '97000000-0000-4000-8000-000000000001'),
  0,
  'nothing was imported into the incomplete tournament'
);

select * from finish();
rollback;
