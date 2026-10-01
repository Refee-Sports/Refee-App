begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- ADR 0002, case C: one person assigns some days and referees other days, and
-- may put themselves on a game they're assigning. Seed: 111...101 is director +
-- assignor; here they also referee. 222...200 is a referee not on their roster.

insert into public.private_profiles (id, identity_status, identity_verified_at)
values
  ('11111111-1111-4111-8111-111111111101'::uuid, 'approved', now()),
  ('22222222-2222-4222-8222-222222222200'::uuid, 'approved', now())
on conflict (id) do update
  set identity_status = 'approved', identity_verified_at = now();

insert into public.user_roles (user_id, role)
values ('11111111-1111-4111-8111-111111111101'::uuid, 'referee')
on conflict do nothing;

insert into public.tournaments (
  id, hirer_id, name, sport_id, starts_on, ends_on, venue_city, venue_state,
  staffing_model, assignor_id, assignor_status, status
)
select
  '95000000-0000-4000-8000-000000000001'::uuid, h.id, 'Two Hats Classic', 'basketball',
  current_date + 30, current_date + 31, 'Austin', 'TX',
  'assignor_managed', '11111111-1111-4111-8111-111111111101'::uuid, 'accepted', 'open'
from public.hirers h
where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

insert into public.jobs (
  id, hirer_id, sport_id, title, level, starts_at, duration_minutes, venue_name,
  venue_city, venue_state, pay_per_game, crew_size, status, tournament_id,
  assignor_staffing_mode
)
select
  job_id, h.id, 'basketball', title, 'high_school', starts_at, 90, 'Two Hats Gym',
  'Austin', 'TX', 100, 2, 'open', '95000000-0000-4000-8000-000000000001'::uuid, mode
from public.hirers h
cross join (
  values
    -- direct: the assignor places people
    ('95000000-0000-4000-8000-000000000101'::uuid, 'Direct One', now() + interval '30 days', 'assignor_direct'),
    -- overlaps Direct One
    ('95000000-0000-4000-8000-000000000102'::uuid, 'Direct Overlap', now() + interval '30 days' + interval '30 minutes', 'assignor_direct'),
    -- self_assign: roster members claim games
    ('95000000-0000-4000-8000-000000000103'::uuid, 'Claimable', now() + interval '32 days', 'self_assign')
) as games(job_id, title, starts_at, mode)
where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

-- Direct mode: assigning yourself needs no roster entry and no second step.
select lives_ok(
  $$ select public.offer_ref_to_game(
       '95000000-0000-4000-8000-000000000101'::uuid,
       '11111111-1111-4111-8111-111111111101'::uuid,
       'crew_chief') $$,
  'an assignor who referees can assign themselves'
);

reset role;

select results_eq(
  $$ select status, offered_by from public.job_assignments
     where job_id = '95000000-0000-4000-8000-000000000101'::uuid
       and ref_id = '11111111-1111-4111-8111-111111111101'::uuid $$,
  $$ values ('accepted'::text, '11111111-1111-4111-8111-111111111101'::uuid) $$,
  'a self-assignment is accepted straight away, not left as an offer to themselves'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select throws_ok(
  $$ select public.offer_ref_to_game(
       '95000000-0000-4000-8000-000000000102'::uuid,
       '11111111-1111-4111-8111-111111111101'::uuid,
       'official') $$,
  'Referee has a schedule conflict',
  'self-assignment still respects the schedule'
);

-- Someone else still has to be on the roster.
select throws_ok(
  $$ select public.offer_ref_to_game(
       '95000000-0000-4000-8000-000000000102'::uuid,
       '22222222-2222-4222-8222-222222222200'::uuid,
       'official') $$,
  'Referee must accept the roster invitation first',
  'other referees still need to be on the roster'
);

-- self_assign mode: the assignor can claim their own tournament's games like a roster member.
select is(
  public.respond_to_job('95000000-0000-4000-8000-000000000103'::uuid, true),
  'accepted',
  'an assignor can claim a game in their own roster-only tournament'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);

select throws_ok(
  $$ select public.respond_to_job('95000000-0000-4000-8000-000000000103'::uuid, true) $$,
  'This game is limited to the assignor roster',
  'a referee off the roster still cannot claim it'
);

-- The referee hat is required: without it, no self-assignment.
reset role;
delete from public.user_roles
where user_id = '11111111-1111-4111-8111-111111111101'::uuid and role = 'referee';
update public.public_profiles set primary_role = 'assignor'
where id = '11111111-1111-4111-8111-111111111101'::uuid;
delete from public.job_assignments
where ref_id = '11111111-1111-4111-8111-111111111101'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select throws_ok(
  $$ select public.offer_ref_to_game(
       '95000000-0000-4000-8000-000000000102'::uuid,
       '11111111-1111-4111-8111-111111111101'::uuid,
       'official') $$,
  'Eligible referee not found',
  'an assignor without the referee role cannot assign themselves'
);

-- And identity verification still applies.
reset role;
insert into public.user_roles (user_id, role)
values ('11111111-1111-4111-8111-111111111101'::uuid, 'referee');
update public.private_profiles set identity_status = 'in_review', identity_verified_at = null
where id = '11111111-1111-4111-8111-111111111101'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select throws_ok(
  $$ select public.offer_ref_to_game(
       '95000000-0000-4000-8000-000000000102'::uuid,
       '11111111-1111-4111-8111-111111111101'::uuid,
       'official') $$,
  '42501',
  'Verify your ID before staffing games.',
  'an unverified assignor cannot assign themselves'
);

-- Filling the last slot by self-assignment marks the game staffed, as accepting does.
reset role;
update public.private_profiles set identity_status = 'approved', identity_verified_at = now()
where id = '11111111-1111-4111-8111-111111111101'::uuid;
update public.jobs set crew_size = 1
where id = '95000000-0000-4000-8000-000000000102'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select lives_ok(
  $$ select public.offer_ref_to_game(
       '95000000-0000-4000-8000-000000000102'::uuid,
       '11111111-1111-4111-8111-111111111101'::uuid,
       'crew_chief') $$,
  'assigning yourself to the last slot works'
);

reset role;

select is(
  (select status from public.jobs where id = '95000000-0000-4000-8000-000000000102'::uuid),
  'staffed',
  'and the game is marked staffed'
);

select * from finish();
rollback;
