begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

-- Show rate (migration 0069): how many confirmed games a referee kept over the
-- last year, against late withdrawals and no-shows.
--
-- Seeded users: ref C …202, ref B …201, director D …101.
-- What the seed already gives ref C, so the checks count only this test's games.
create temp table baseline as
  select * from public.referee_reliability(array['22222222-2222-4222-8222-222222222202']::uuid[]);
grant select on baseline to authenticated;

insert into public.jobs (id, hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at, duration_minutes,
                         venue_name, venue_city, venue_state, job_type, status, num_games)
select v.id::uuid, h.id, 'basketball', 'Reliability ' || v.n, 'high_school', 2, 70, now() + v.starts_in, 60,
       'Rel Gym', 'Austin', 'TX', 'single', 'completed', 1
from public.hirers h,
     (values (1, '98690000-0000-4000-8000-000000000001', interval '-3 days'),
             (2, '98690000-0000-4000-8000-000000000002', interval '-10 days'),
             (3, '98690000-0000-4000-8000-000000000003', interval '-40 days'),
             (4, '98690000-0000-4000-8000-000000000004', interval '-5 days'),
             (5, '98690000-0000-4000-8000-000000000005', interval '-6 days'),
             (6, '98690000-0000-4000-8000-000000000006', interval '-7 days'),
             (7, '98690000-0000-4000-8000-000000000007', interval '-400 days'),
             (8, '98690000-0000-4000-8000-000000000008', interval '5 days')) as v(n, id, starts_in)
where h.user_id = '11111111-1111-4111-8111-111111111101';

insert into public.job_assignments (job_id, ref_id, status, withdrew_late) values
  ('98690000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222202', 'completed', false),
  ('98690000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222202', 'completed', false),
  ('98690000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222202', 'completed', false),
  ('98690000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222202', 'withdrawn', true),
  ('98690000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222202', 'no_show', false),
  -- Withdrawing in good time doesn't count against anyone.
  ('98690000-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222202', 'withdrawn', false),
  -- Older than a year: forgiven.
  ('98690000-0000-4000-8000-000000000007', '22222222-2222-4222-8222-222222222202', 'no_show', false),
  -- Not played yet.
  ('98690000-0000-4000-8000-000000000008', '22222222-2222-4222-8222-222222222202', 'accepted', false);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select is(
  (select r.kept - b.kept from public.referee_reliability(array['22222222-2222-4222-8222-222222222202']::uuid[]) r, baseline b),
  3, 'counts the games the referee worked in the last year');
select is(
  (select r.late_withdrawals - b.late_withdrawals from public.referee_reliability(array['22222222-2222-4222-8222-222222222202']::uuid[]) r, baseline b),
  1, 'counts only late withdrawals, not ones made in good time');
select is(
  (select r.no_shows - b.no_shows from public.referee_reliability(array['22222222-2222-4222-8222-222222222202']::uuid[]) r, baseline b),
  1, 'counts no-shows from the last year only');
select is(
  (select kept from public.referee_reliability(array['22222222-2222-4222-8222-2222222222ff']::uuid[])),
  0, 'a referee with no history has a row of zeros');
select is(
  (select count(*)::int from public.referee_reliability(
     array['22222222-2222-4222-8222-222222222202', '22222222-2222-4222-8222-222222222201']::uuid[])),
  2, 'answers for several referees at once, one row each');

reset role;
set local role anon;
select throws_ok(
  $$ select * from public.referee_reliability(array['22222222-2222-4222-8222-222222222202']::uuid[]) $$,
  '42501', null, 'signed-out visitors cannot read it');
reset role;

select is(
  (select count(*)::int from public.referee_reliability(array_fill('22222222-2222-4222-8222-222222222202'::uuid, array[300]))),
  1, 'a long list of the same id is still one answer');

select * from finish();
rollback;
