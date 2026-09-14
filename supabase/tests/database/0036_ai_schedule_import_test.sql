begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- Director 111...101 owns a tournament with a full venue on file.
insert into public.tournaments (id, hirer_id, name, sport_id, starts_on, ends_on, venue_name, venue_address, venue_zip,
                                venue_city, venue_state, venue_lat, venue_lng, courts, arrival_notes, timezone, status,
                                ruleset, uniform_requirements)
select '96000000-0000-4000-8000-000000000001'::uuid, h.id, 'AI Import Cup', 'basketball', date '2026-09-20', date '2026-09-20',
       'Adelphi University', '1 South Ave', '11530', 'Garden City', 'NY', 40.7197638, -73.6519719,
       array['Main floor'], 'Doors 1:00 PM.', 'America/New_York', 'open', 'NFHS', 'Stripes'
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select is(
  (public.import_tournament_schedule('96000000-0000-4000-8000-000000000001', jsonb_build_array(
    jsonb_build_object('home_team', 'Long Island Friars', 'away_team', 'Queens Knights',
                       'starts_local', '2026-09-20T13:30', 'level', 'high_school', 'team_level', 'varsity',
                       'crew_size', 2, 'pay_per_game', 75, 'duration_minutes', 60, 'court', 'Main floor'),
    jsonb_build_object('home_team', 'BX Mustangs', 'away_team', 'Queens Crusaders',
                       'starts_local', '2026-09-20T14:45', 'level', 'high_school',
                       'crew_size', 2, 'pay_per_game', 75, 'duration_minutes', 60)
  ))->>'count')::int,
  2,
  'the director imports two games from a matchup list'
);

reset role;
select is((select venue_address from public.jobs where home_team = 'Long Island Friars'), '1 South Ave',
          'blank venue fields come from the tournament: street');
select is((select venue_zip || ' ' || venue_state from public.jobs where home_team = 'Long Island Friars'), '11530 NY',
          'ZIP and state from the tournament');
select ok((select venue_lat is not null and venue_lng is not null from public.jobs where home_team = 'Long Island Friars'),
          'the map pin comes from the tournament');
select is((select starts_at from public.jobs where home_team = 'Long Island Friars'), '2026-09-20 17:30:00+00'::timestamptz,
          '1:30 PM local converts in the tournament zone (EDT)');
select is((select court || '/' || team_level from public.jobs where home_team = 'Long Island Friars'), 'Main floor/varsity',
          'court and team level are stored');
select is((select arrival_notes from public.jobs where home_team = 'BX Mustangs'), 'Doors 1:00 PM.',
          'arrival notes default to the tournament''s');

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select throws_ok(
  $$ select public.import_tournament_schedule('96000000-0000-4000-8000-000000000001', jsonb_build_array(
       jsonb_build_object('home_team', 'A', 'away_team', 'B', 'starts_local', '2026-09-20T16:00', 'level', 'high_school',
                          'crew_size', 2, 'pay_per_game', 75, 'duration_minutes', 60))) $$,
  'P0001', 'Only the director or accepted assignor can import this schedule',
  'a referee cannot import into someone''s tournament'
);
select throws_ok(
  $$ insert into public.ai_events (user_id, kind) values ('22222222-2222-4222-8222-222222222200', 'schedule_extract') $$,
  '42501', null,
  'apps cannot write the AI log directly'
);

reset role;
select is(
  (select count(*)::int from public.jobs where tournament_id = '96000000-0000-4000-8000-000000000001'),
  2,
  'nothing else was imported'
);

select * from finish();
rollback;
