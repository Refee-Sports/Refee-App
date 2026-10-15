begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

-- A game is never staffed without its full venue address (migration 0071).
-- Seeded users: refs A …200, B …201; director D …101.
-- Written as the backend would (seed, import), which skips the posting check.
insert into public.jobs (id, hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at, duration_minutes,
                         venue_name, venue_address, venue_zip, venue_city, venue_state, job_type, status, num_games,
                         auto_accept)
select v.id::uuid, h.id, 'basketball', v.title, 'high_school', 2, 70, now() + interval '3 days', 60,
       'Venue Gym', v.address, v.zip, 'Austin', 'TX', 'single', 'open', 1, false
from public.hirers h,
     (values ('98710000-0000-4000-8000-000000000001', 'No Street', null, '78701'),
             ('98710000-0000-4000-8000-000000000002', 'No ZIP', '1 South Ave', null),
             ('98710000-0000-4000-8000-000000000003', 'Complete', '1 South Ave', '78701')) as v(id, title, address, zip)
where h.user_id = '11111111-1111-4111-8111-111111111101';

-- Applications from before the rule.
insert into public.job_assignments (job_id, ref_id, status) values
  ('98710000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222201', 'pending'),
  ('98710000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222200', 'pending');

select ok(not public.venue_is_complete('', '78701', 'Austin', 'TX'), 'a missing street is incomplete');
select ok(public.venue_is_complete('1 South Ave', '78701', 'Austin', 'tx'), 'a full address is complete');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);

select throws_ok(
  $$ select public.respond_to_job('98710000-0000-4000-8000-000000000001', true) $$,
  '23514', null, 'a referee cannot apply to a game with no street address');
select is(public.respond_to_job('98710000-0000-4000-8000-000000000003', true), 'pending',
  'a game with its full address takes applications as before');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);
select is(public.respond_to_job('98710000-0000-4000-8000-000000000002', false), 'declined',
  'a referee already waiting on an incomplete game can still back out');

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
select throws_ok(
  $$ select public.director_respond_to_application(
       '98710000-0000-4000-8000-000000000002'::uuid, '22222222-2222-4222-8222-222222222200'::uuid, true) $$,
  '23514', null, 'the director cannot confirm anyone until the address is complete');

reset role;
select is(
  (select count(*)::int from public.matching_referees_for_job('98710000-0000-4000-8000-000000000001')),
  0, 'nobody is alerted about a game with an incomplete address');

select * from finish();
rollback;
