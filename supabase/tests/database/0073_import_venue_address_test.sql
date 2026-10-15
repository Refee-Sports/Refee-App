begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

-- An import never gives a game another city's street address (migration 0073).
-- Director D …101 owns a tournament in Austin.
insert into public.tournaments (
  id, hirer_id, name, sport_id, starts_on, ends_on, venue_name, venue_city, venue_state, timezone,
  staffing_model, status, venue_address, venue_zip, ruleset, uniform_requirements, game_format, period_minutes
)
select '97300000-0000-4000-8000-000000000001'::uuid, h.id, 'Venue Import Cup', 'basketball',
       current_date + 60, current_date + 61, 'Main Gym', 'Austin', 'TX', 'America/Chicago',
       'direct', 'open', '1301 Shoal Creek Blvd', '78701', 'NFHS', 'Stripes', 'quarters', 8
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

create function pg_temp.game(p_home text, p_name text, p_city text, p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'home_team', p_home, 'away_team', 'Visitors', 'starts_at', (current_date + 60)::text || 'T15:00:00Z',
    'venue_name', p_name, 'venue_city', p_city, 'venue_state', 'TX', 'level', 'high_school',
    'crew_size', 2, 'pay_per_game', 60, 'duration_minutes', 60) || p_extra
$$;

select throws_ok(
  format('select public.import_tournament_schedule(%L, %L)', '97300000-0000-4000-8000-000000000001',
         jsonb_build_array(pg_temp.game('Dallas Home', 'Eastside Rec', 'Dallas'))),
  '23514', 'Game 1 is at a different venue from the tournament: add its street address and ZIP',
  'a game in another city without its own address is refused');

select lives_ok(
  format('select public.import_tournament_schedule(%L, %L)', '97300000-0000-4000-8000-000000000001',
         jsonb_build_array(pg_temp.game('Dallas Own', 'Eastside Rec', 'Dallas',
           '{"venue_address": "500 Elm St", "venue_zip": "75201"}'::jsonb))),
  'with its own street and ZIP it imports');

select lives_ok(
  format('select public.import_tournament_schedule(%L, %L)', '97300000-0000-4000-8000-000000000001',
         jsonb_build_array(pg_temp.game('Court Two', 'Court 2', 'austin'))),
  'a court at the tournament''s building inherits its address');

select is(
  (select venue_address || ' ' || venue_zip from public.jobs
    where tournament_id = '97300000-0000-4000-8000-000000000001' and home_team = 'Court Two'),
  '1301 Shoal Creek Blvd 78701', 'and gets the tournament''s street and ZIP');

select * from finish();
rollback;
