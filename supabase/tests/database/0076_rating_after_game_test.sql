begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

-- A director can rate a referee only once the game is over (0076): marking a
-- game completed at tip-off doesn't open rating before its scheduled end.
-- Seeded: ref …200, director …101.
insert into public.jobs (id, hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at, duration_minutes,
                         venue_name, venue_city, venue_state, job_type, status, num_games)
select v.id::uuid, h.id, 'basketball', v.title, 'high_school', 2, 70, now() + v.starts_in, 90,
       'Rate Gym', 'Austin', 'TX', 'single', 'completed', 1
from public.hirers h,
     (values ('98760000-0000-4000-8000-000000000001', 'Still Playing', interval '-30 minutes'),
             ('98760000-0000-4000-8000-000000000002', 'Over',          interval '-3 hours')) as v(id, title, starts_in)
where h.user_id = '11111111-1111-4111-8111-111111111101';

insert into public.job_assignments (job_id, ref_id, status, amount_due) values
  ('98760000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222200', 'completed', 70),
  ('98760000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222200', 'completed', 70);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select throws_ok($$
  insert into public.ratings (job_id, ref_id, hirer_id, on_time, professionalism, game_management)
  select '98760000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222200', h.id, 5, 5, 5
  from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  '42501', null, 'a game marked completed mid-play cannot be rated yet');

select lives_ok($$
  insert into public.ratings (job_id, ref_id, hirer_id, on_time, professionalism, game_management)
  select '98760000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222200', h.id, 5, 5, 5
  from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  'once its scheduled end has passed, the director can rate');

select * from finish();
rollback;
