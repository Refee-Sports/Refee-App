begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into public.user_roles (user_id, role)
values ('22222222-2222-4222-8222-222222222200'::uuid, 'assignor')
on conflict do nothing;

-- Importing needs a verified identity (0042), checked after the "whose
-- tournament is this" question. The director and the accepted assignor here
-- are verified people; 222...203 below deliberately isn't either.
insert into public.private_profiles (id, identity_status, identity_verified_at)
values
  ('11111111-1111-4111-8111-111111111101'::uuid, 'approved', now()),
  ('22222222-2222-4222-8222-222222222200'::uuid, 'approved', now())
on conflict (id) do update
  set identity_status = 'approved', identity_verified_at = now();

insert into public.tournaments (
  id, hirer_id, name, sport_id, starts_on, ends_on, venue_name,
  venue_city, venue_state, timezone, staffing_model, status,
  assignor_id, assignor_status,
  venue_address, venue_zip, ruleset, uniform_requirements, game_format, period_minutes
)
select
  '93000000-0000-4000-8000-000000000001'::uuid,
  h.id,
  'Schedule Import RBAC Tournament',
  'basketball',
  current_date + 60,
  current_date + 61,
  'Default Gym',
  'Austin',
  'TX',
  'America/Chicago',
  'assignor_managed',
  'open',
  '22222222-2222-4222-8222-222222222200'::uuid,
  'accepted',
  '1301 Shoal Creek Blvd', '78701', 'NFHS', 'Stripes', 'quarters', 8
from public.hirers h
where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select lives_ok(
  format(
    $$select public.import_tournament_schedule(
      '93000000-0000-4000-8000-000000000001'::uuid,
      '[{"home_team":"Lions","away_team":"Tigers","starts_at":"%sT15:00:00Z","venue_name":"Court 1","venue_city":"Austin","venue_state":"TX","level":"high_school","crew_size":3,"pay_per_game":75,"duration_minutes":60},{"home_team":"Bears","away_team":"Hawks","starts_at":"%sT16:00:00Z","venue_name":"Court 2","venue_city":"Austin","venue_state":"TX","level":"high_school","crew_size":2,"pay_per_game":65,"duration_minutes":60}]'::jsonb
    )$$,
    (current_date + 60)::text,
    (current_date + 60)::text
  ),
  'the owning director can atomically import a valid schedule'
);

select results_eq(
  $$select count(*)::bigint from public.jobs where tournament_id = '93000000-0000-4000-8000-000000000001'::uuid$$,
  array[2::bigint],
  'all valid rows are created'
);

select results_eq(
  $$select total_games from public.tournaments where id = '93000000-0000-4000-8000-000000000001'::uuid$$,
  array[2],
  'the stored tournament game count is synchronized'
);

select results_eq(
  $$select title || ':' || crew_size::text || ':' || pay_per_game::text from public.jobs where tournament_id = '93000000-0000-4000-8000-000000000001'::uuid order by starts_at limit 1$$,
  array['Lions vs Tigers:3:75'::text],
  'server-created game fields match the validated input'
);

select throws_ok(
  format(
    $$select public.import_tournament_schedule(
      '93000000-0000-4000-8000-000000000001'::uuid,
      '[{"home_team":"Lions","away_team":"Tigers","starts_at":"%sT15:00:00Z","venue_name":"Court 1","venue_city":"Austin","venue_state":"TX","level":"high_school","crew_size":3,"pay_per_game":75,"duration_minutes":60}]'::jsonb
    )$$,
    (current_date + 60)::text
  ),
  'P0001',
  'Game 1 already exists in this tournament',
  'a duplicate of an existing game is rejected'
);

select throws_ok(
  format(
    $$select public.import_tournament_schedule(
      '93000000-0000-4000-8000-000000000001'::uuid,
      '[{"home_team":"New A","away_team":"New B","starts_at":"%sT17:00:00Z","venue_name":"Court 3","venue_city":"Austin","venue_state":"TX","level":"youth","crew_size":2,"pay_per_game":55,"duration_minutes":60},{"home_team":"Same","away_team":"Same","starts_at":"%sT18:00:00Z","venue_name":"Court 4","venue_city":"Austin","venue_state":"TX","level":"youth","crew_size":2,"pay_per_game":55,"duration_minutes":60}]'::jsonb
    )$$,
    (current_date + 60)::text,
    (current_date + 60)::text
  ),
  'P0001',
  'Game 2 teams must differ',
  'one invalid row rejects the entire batch'
);

select results_eq(
  $$select count(*)::bigint from public.jobs where tournament_id = '93000000-0000-4000-8000-000000000001'::uuid$$,
  array[2::bigint],
  'the failed batch did not partially insert its first row'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222203', true);

select throws_ok(
  format(
    $$select public.import_tournament_schedule(
      '93000000-0000-4000-8000-000000000001'::uuid,
      '[{"home_team":"A","away_team":"B","starts_at":"%sT17:00:00Z","venue_name":"Court 3","venue_city":"Austin","venue_state":"TX","level":"youth","crew_size":2,"pay_per_game":55,"duration_minutes":60}]'::jsonb
    )$$,
    (current_date + 60)::text
  ),
  'P0001',
  'Only the director or accepted assignor can import this schedule',
  'another authenticated user cannot import games'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);

select lives_ok(
  format(
    $$select public.import_tournament_schedule(
      '93000000-0000-4000-8000-000000000001'::uuid,
      '[{"home_team":"Owls","away_team":"Foxes","starts_at":"%sT17:00:00Z","venue_name":"Court 3","venue_city":"Austin","venue_state":"TX","level":"youth","crew_size":2,"pay_per_game":55,"duration_minutes":60}]'::jsonb
    )$$,
    (current_date + 60)::text
  ),
  'the accepted assignor can import games'
);

select results_eq(
  $$select count(*)::bigint from public.jobs where tournament_id = '93000000-0000-4000-8000-000000000001'::uuid$$,
  array[3::bigint],
  'the accepted assignor import is stored'
);

select throws_ok(
  format(
    $$select public.import_tournament_schedule(
      '93000000-0000-4000-8000-000000000001'::uuid,
      '[{"home_team":"Late","away_team":"Game","starts_at":"%sT17:00:00Z","venue_name":"Court 4","venue_city":"Austin","venue_state":"TX","level":"youth","crew_size":2,"pay_per_game":55,"duration_minutes":60}]'::jsonb
    )$$,
    (current_date + 62)::text
  ),
  'P0001',
  'Game 1 is outside the tournament dates',
  'a game outside the tournament dates is rejected server-side'
);

reset role;
update public.tournaments set status = 'cancelled' where id = '93000000-0000-4000-8000-000000000001'::uuid;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select throws_ok(
  format(
    $$select public.import_tournament_schedule(
      '93000000-0000-4000-8000-000000000001'::uuid,
      '[{"home_team":"A","away_team":"B","starts_at":"%sT18:00:00Z","venue_name":"Court 4","venue_city":"Austin","venue_state":"TX","level":"youth","crew_size":2,"pay_per_game":55,"duration_minutes":60}]'::jsonb
    )$$,
    (current_date + 60)::text
  ),
  'P0001',
  'Closed tournaments cannot import games',
  'closed tournaments reject schedule changes'
);

select ok(
  not has_function_privilege('anon', 'public.import_tournament_schedule(uuid,jsonb)', 'EXECUTE'),
  'anonymous clients cannot execute schedule imports'
);

reset role;

select * from finish();
rollback;
