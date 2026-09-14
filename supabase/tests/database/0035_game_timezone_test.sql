begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

-- Region fallback
select is(public.tz_for_region('DC'), 'America/New_York', 'DC is Eastern');
select is(public.tz_for_region('pr'), 'America/Puerto_Rico', 'Puerto Rico is Atlantic');
select is(public.tz_for_region('AZ'), 'America/Phoenix', 'Arizona keeps its no-DST zone');

-- Games, created as the backend would (postgres) with the director's hirer.
create temp table g (label text, id uuid);
with j as (
  insert into public.jobs (hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at, starts_local,
                           venue_name, venue_city, venue_state, job_type, status, num_games)
  select h.id, 'basketball', 'TZ NY summer', 'high_school', 2, 70, now(), '2026-07-01 13:30',
         'Gym', 'Garden City', 'NY', 'single', 'open', 1
  from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid
  returning id
)
insert into g select 'ny-summer', id from j;
with j as (
  insert into public.jobs (hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at, starts_local,
                           venue_name, venue_city, venue_state, job_type, status, num_games)
  select h.id, 'basketball', 'TZ NY winter', 'high_school', 2, 70, now(), '2026-12-01 13:30',
         'Gym', 'Garden City', 'NY', 'single', 'open', 1
  from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid
  returning id
)
insert into g select 'ny-winter', id from j;
with j as (
  insert into public.jobs (hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at, starts_local,
                           venue_name, venue_city, venue_state, job_type, status, num_games)
  select h.id, 'basketball', 'TZ PR', 'high_school', 2, 70, now(), '2026-07-01 13:30',
         'Coliseo', 'San Juan', 'PR', 'single', 'open', 1
  from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid
  returning id
)
insert into g select 'pr', id from j;
with j as (
  insert into public.jobs (hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at,
                           venue_name, venue_city, venue_state, job_type, status, num_games)
  select h.id, 'basketball', 'TZ legacy client', 'high_school', 2, 70, '2026-07-01T17:30:00Z',
         'Gym', 'Austin', 'TX', 'single', 'open', 1
  from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid
  returning id
)
insert into g select 'legacy', id from j;

select is((select timezone from public.jobs where id = (select id from g where label = 'ny-summer')),
          'America/New_York', 'a New York game gets the Eastern zone from its state');
select is((select starts_at from public.jobs where id = (select id from g where label = 'ny-summer')),
          '2026-07-01 17:30:00+00'::timestamptz, '1:30 PM in New York in July is 17:30 UTC (EDT)');
select is((select starts_at from public.jobs where id = (select id from g where label = 'ny-winter')),
          '2026-12-01 18:30:00+00'::timestamptz, '1:30 PM in New York in December is 18:30 UTC (EST)');
select is((select starts_at from public.jobs where id = (select id from g where label = 'pr')),
          '2026-07-01 17:30:00+00'::timestamptz, '1:30 PM in San Juan is 17:30 UTC (AST, no DST)');
select is((select starts_local from public.jobs where id = (select id from g where label = 'legacy')),
          '2026-07-01 12:30:00'::timestamp, 'a client that only sends starts_at still gets a venue-local time');

update public.jobs set starts_local = '2026-07-01 15:00' where id = (select id from g where label = 'ny-summer');
select is((select starts_at from public.jobs where id = (select id from g where label = 'ny-summer')),
          '2026-07-01 19:00:00+00'::timestamptz, 'changing the local time recomputes the instant');

select throws_ok(
  $$ update public.jobs set timezone = 'Mars/Olympus' where id = (select id from g where label = 'pr') $$,
  '22023', 'Unknown time zone: Mars/Olympus', 'an unknown zone is rejected'
);

-- Tournaments: no silent Central default.
insert into public.tournaments (id, hirer_id, name, sport_id, starts_on, ends_on, venue_city, venue_state, status)
select '95000000-0000-4000-8000-000000000001'::uuid, h.id, 'TZ Cup', 'basketball', current_date + 5, current_date + 5,
       'Washington', 'DC', 'open'
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;
select is((select timezone from public.tournaments where id = '95000000-0000-4000-8000-000000000001'),
          'America/New_York', 'a DC tournament gets Eastern, not Central');

insert into public.jobs (hirer_id, tournament_id, sport_id, title, level, crew_size, pay_per_game, starts_at, starts_local,
                         venue_name, venue_city, venue_state, job_type, status, num_games)
select h.id, '95000000-0000-4000-8000-000000000001', 'basketball', 'TZ cup game', 'high_school', 2, 70, now(),
       (current_date + 5) + time '10:00', 'Gym', 'Washington', 'DC', 'tournament', 'open', 1
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;
select is((select timezone from public.jobs where title = 'TZ cup game'),
          'America/New_York', 'a tournament game inherits the tournament zone');

select * from finish();
rollback;
