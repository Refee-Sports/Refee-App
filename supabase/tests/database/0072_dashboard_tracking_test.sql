begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

-- Application outcomes and time to fill (migration 0072).
-- Seeded users: refs A …200, B …201; director D …101.
insert into public.jobs (id, hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at, duration_minutes,
                         venue_name, venue_address, venue_zip, venue_city, venue_state, job_type, status, num_games,
                         auto_accept)
select v.id::uuid, h.id, 'basketball', v.title, 'high_school', 1, 70, now() + v.starts_in, 60,
       'Track Gym', '1 South Ave', '78701', 'Austin', 'TX', 'single', 'open', 1, v.auto
from public.hirers h,
     (values ('98720000-0000-4000-8000-000000000001', 'Approve Me', interval '3 days',             false),
             ('98720000-0000-4000-8000-000000000002', 'Decline Me', interval '4 days',             false),
             ('98720000-0000-4000-8000-000000000003', 'Cancel Me',  interval '5 days',             false),
             ('98720000-0000-4000-8000-000000000004', 'Overlap',    interval '3 days 30 minutes',  false),
             ('98720000-0000-4000-8000-000000000005', 'Auto',       interval '6 days',             true))
       as v(id, title, starts_in, auto)
where h.user_id = '11111111-1111-4111-8111-111111111101';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Ref A applies to four games, one of which overlaps the first.
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select public.respond_to_job('98720000-0000-4000-8000-000000000001', true);
select public.respond_to_job('98720000-0000-4000-8000-000000000002', true);
select public.respond_to_job('98720000-0000-4000-8000-000000000003', true);
select public.respond_to_job('98720000-0000-4000-8000-000000000004', true);
select public.respond_to_job('98720000-0000-4000-8000-000000000005', true);
-- …and cancels one.
select public.respond_to_job('98720000-0000-4000-8000-000000000003', false);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
select public.director_respond_to_application('98720000-0000-4000-8000-000000000001'::uuid, '22222222-2222-4222-8222-222222222200'::uuid, true);
select public.director_respond_to_application('98720000-0000-4000-8000-000000000002'::uuid, '22222222-2222-4222-8222-222222222200'::uuid, false);

reset role;

create function pg_temp.outcome(p_job text) returns text language sql as $$
  select application_outcome from public.job_assignments
  where job_id = ('98720000-0000-4000-8000-' || p_job)::uuid and ref_id = '22222222-2222-4222-8222-222222222200'
$$;

select is(pg_temp.outcome('000000000001'), 'approved', 'the director approving is recorded as approved');
select is(pg_temp.outcome('000000000002'), 'declined', 'the director saying no is recorded as declined');
select is(pg_temp.outcome('000000000003'), 'withdrawn', 'the referee cancelling is not counted against them');
select is(pg_temp.outcome('000000000004'), 'closed', 'an application closed because they were booked at the same time is not a decline');
select is(pg_temp.outcome('000000000005'), 'approved', 'an auto-accepted application counts as approved');

select isnt((select filled_at from public.jobs where id = '98720000-0000-4000-8000-000000000001'), null,
  'a game records when its crew filled');
select is((select filled_at from public.jobs where id = '98720000-0000-4000-8000-000000000002'), null,
  'an unfilled game has no fill time');

select * from finish();
rollback;
