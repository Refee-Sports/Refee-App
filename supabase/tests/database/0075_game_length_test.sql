begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

-- A game is 2 halves or 4 quarters, and a half runs at most 20 minutes.

select lives_ok(
  $$ insert into public.jobs (hirer_id, sport_id, title, home_team, away_team, level, crew_size, pay_per_game, starts_at,
                              venue_name, venue_address, venue_zip, venue_city, venue_state, game_format, period_minutes,
                              ruleset, uniform_requirements, job_type, status, num_games)
     select h.id, 'basketball', 'A vs B', 'A', 'B', 'high_school', 2, 75, now() + interval '30 days',
            'Main Gym', '1301 Shoal Creek Blvd', '78701', 'Austin', 'TX', 'halves', 20, 'NFHS', 'Stripes', 'single', 'open', 1
     from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  'a game of 20-minute halves posts'
);

select throws_like(
  $$ insert into public.jobs (hirer_id, sport_id, title, home_team, away_team, level, crew_size, pay_per_game, starts_at,
                              venue_name, venue_address, venue_zip, venue_city, venue_state, game_format, period_minutes,
                              ruleset, uniform_requirements, job_type, status, num_games)
     select h.id, 'basketball', 'A vs B', 'A', 'B', 'high_school', 2, 75, now() + interval '30 days',
            'Main Gym', '1301 Shoal Creek Blvd', '78701', 'Austin', 'TX', 'halves', 24, 'NFHS', 'Stripes', 'single', 'open', 1
     from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  '%jobs_half_length_check%',
  'a half can''t run longer than 20 minutes'
);

select lives_ok(
  $$ insert into public.jobs (hirer_id, sport_id, title, home_team, away_team, level, crew_size, pay_per_game, starts_at,
                              venue_name, venue_address, venue_zip, venue_city, venue_state, game_format, period_minutes,
                              ruleset, uniform_requirements, job_type, status, num_games)
     select h.id, 'basketball', 'A vs B', 'A', 'B', 'high_school', 2, 75, now() + interval '30 days',
            'Main Gym', '1301 Shoal Creek Blvd', '78701', 'Austin', 'TX', 'quarters', 8, 'NFHS', 'Stripes', 'single', 'open', 1
     from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  'quarters are unaffected'
);

select throws_like(
  $$ insert into public.tournaments (hirer_id, name, sport_id, starts_on, ends_on, venue_name, venue_address, venue_zip,
                                     venue_city, venue_state, timezone, game_format, period_minutes)
     select h.id, 'Long Halves Cup', 'basketball', current_date + 30, current_date + 31, 'Main Gym',
            '1301 Shoal Creek Blvd', '78701', 'Austin', 'TX', 'America/Chicago', 'halves', 24
     from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  '%tournaments_half_length_check%',
  'tournament defaults follow the same rule'
);

select ok(
  (select count(*) from public.jobs j join public.hirers h on h.id = j.hirer_id
     join auth.users u on u.id = h.user_id
    where u.email like '%@refee.local' and (j.game_format is null or j.period_minutes is null)) = 0,
  'every seeded game says how it is played'
);

select * from finish();
rollback;
