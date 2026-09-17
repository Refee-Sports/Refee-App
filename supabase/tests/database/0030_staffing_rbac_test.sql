begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

-- Stable local seed identities:
-- assignor/director 111...101, referee 111...100, referees 222...200/201.

-- Taking, staffing and posting games all need a verified identity (0042).
-- Everyone in this test is a verified person; what's under test is staffing.
insert into public.private_profiles (id, identity_status, identity_verified_at)
values
  ('11111111-1111-4111-8111-111111111100'::uuid, 'approved', now()),
  ('11111111-1111-4111-8111-111111111101'::uuid, 'approved', now()),
  ('22222222-2222-4222-8222-222222222200'::uuid, 'approved', now()),
  ('22222222-2222-4222-8222-222222222201'::uuid, 'approved', now())
on conflict (id) do update
  set identity_status = 'approved', identity_verified_at = now();
insert into public.tournaments (
  id,
  hirer_id,
  name,
  sport_id,
  starts_on,
  ends_on,
  venue_city,
  venue_state,
  staffing_model,
  assignor_id,
  assignor_status,
  status
)
select
  '90000000-0000-4000-8000-000000000001'::uuid,
  h.id,
  'RBAC Test Tournament',
  'basketball',
  current_date + 30,
  current_date + 31,
  'Austin',
  'TX',
  'assignor_managed',
  '11111111-1111-4111-8111-111111111101'::uuid,
  'accepted',
  'open'
from public.hirers h
where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

insert into public.jobs (
  id,
  hirer_id,
  sport_id,
  title,
  level,
  starts_at,
  duration_minutes,
  venue_name,
  venue_city,
  venue_state,
  pay_per_game,
  crew_size,
  status,
  tournament_id,
  assignor_staffing_mode
)
select
  job_id,
  h.id,
  'basketball',
  title,
  'high_school',
  starts_at,
  90,
  'RBAC Test Gym',
  'Austin',
  'TX',
  100,
  crew_size,
  'open',
  '90000000-0000-4000-8000-000000000001'::uuid,
  'assignor_direct'
from public.hirers h
cross join (
  values
    ('90000000-0000-4000-8000-000000000101'::uuid, 'RBAC Game One', now() + interval '30 days', 2),
    ('90000000-0000-4000-8000-000000000102'::uuid, 'RBAC Game Two', now() + interval '31 days', 2)
) as games(job_id, title, starts_at, crew_size)
where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

insert into public.assignor_rosters (assignor_id, ref_id, status, responded_at)
values (
  '11111111-1111-4111-8111-111111111101'::uuid,
  '11111111-1111-4111-8111-111111111100'::uuid,
  'accepted',
  now()
);

insert into public.job_assignments (
  job_id, ref_id, role, status, offered_at, offered_by
)
values (
  '90000000-0000-4000-8000-000000000101'::uuid,
  '11111111-1111-4111-8111-111111111100'::uuid,
  'crew_chief',
  'offered',
  now(),
  '11111111-1111-4111-8111-111111111101'::uuid
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111100', true);

select throws_ok(
  $$
    insert into public.job_assignments (job_id, ref_id, status)
    values (
      '90000000-0000-4000-8000-000000000102'::uuid,
      '11111111-1111-4111-8111-111111111100'::uuid,
      'accepted'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "job_assignments"',
  'a referee cannot insert an accepted assignment directly'
);

select is_empty(
  $$
    update public.job_assignments
    set status = 'accepted'
    where job_id = '90000000-0000-4000-8000-000000000101'::uuid
      and ref_id = '11111111-1111-4111-8111-111111111100'::uuid
    returning status
  $$,
  'a referee cannot update an offer directly'
);

select results_eq(
  $$select public.respond_to_job('90000000-0000-4000-8000-000000000101'::uuid, true)$$,
  array['accepted'::text],
  'the offered referee can accept through the authorized RPC'
);

select results_eq(
  $$
    select status from public.job_assignments
    where job_id = '90000000-0000-4000-8000-000000000101'::uuid
      and ref_id = '11111111-1111-4111-8111-111111111100'::uuid
  $$,
  array['accepted'::text],
  'the authorized response persists accepted state'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select throws_ok(
  $$
    select public.offer_ref_to_game(
      '90000000-0000-4000-8000-000000000101'::uuid,
      '22222222-2222-4222-8222-222222222200'::uuid,
      'official'
    )
  $$,
  'P0001',
  'Referee must accept the roster invitation first',
  'an assignor cannot offer a game to a non-roster referee'
);

select ok(
  public.invite_existing_ref_to_roster('22222222-2222-4222-8222-222222222200'::uuid) is not null,
  'an assignor can invite an eligible existing referee'
);

select results_eq(
  $$
    select status from public.assignor_rosters
    where assignor_id = '11111111-1111-4111-8111-111111111101'::uuid
      and ref_id = '22222222-2222-4222-8222-222222222200'::uuid
  $$,
  array['invited'::text],
  'the roster invitation remains pending until referee consent'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);

select results_eq(
  $$
    select public.respond_to_roster_invite(
      (
        select id from public.assignor_rosters
        where assignor_id = '11111111-1111-4111-8111-111111111101'::uuid
          and ref_id = '22222222-2222-4222-8222-222222222200'::uuid
      ),
      true
    )
  $$,
  array['accepted'::text],
  'the invited referee can consent through the roster RPC'
);

select results_eq(
  $$
    select status from public.assignor_rosters
    where assignor_id = '11111111-1111-4111-8111-111111111101'::uuid
      and ref_id = '22222222-2222-4222-8222-222222222200'::uuid
  $$,
  array['accepted'::text],
  'accepted roster state is persisted'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select ok(
  public.offer_ref_to_game(
    '90000000-0000-4000-8000-000000000101'::uuid,
    '22222222-2222-4222-8222-222222222200'::uuid,
    'official'
  ) is not null,
  'the assignor can offer an open slot to an accepted roster referee'
);

select results_eq(
  $$
    select status from public.job_assignments
    where job_id = '90000000-0000-4000-8000-000000000101'::uuid
      and ref_id = '22222222-2222-4222-8222-222222222200'::uuid
  $$,
  array['offered'::text],
  'direct assignment creates an offer rather than acceptance'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);

select is_empty(
  $$
    update public.job_assignments
    set status = 'accepted'
    where job_id = '90000000-0000-4000-8000-000000000101'::uuid
      and ref_id = '22222222-2222-4222-8222-222222222200'::uuid
    returning status
  $$,
  'the second referee also cannot bypass the response RPC'
);

select results_eq(
  $$select public.respond_to_job('90000000-0000-4000-8000-000000000101'::uuid, true)$$,
  array['accepted'::text],
  'the second referee can accept their own offer'
);

select results_eq(
  $$select status from public.jobs where id = '90000000-0000-4000-8000-000000000101'::uuid$$,
  array['staffed'::text],
  'the game becomes staffed exactly at crew capacity'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select throws_ok(
  $$select public.set_assignor_staffing_mode('90000000-0000-4000-8000-000000000101'::uuid, 'self_assign')$$,
  'P0001',
  'Remove active offers and assignments before changing staffing mode',
  'staffing mode cannot change while assignments are active'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);

select throws_ok(
  $$
    select public.remove_ref_from_assignor_game(
      (
        select id from public.job_assignments
        where job_id = '90000000-0000-4000-8000-000000000101'::uuid
          and ref_id = '22222222-2222-4222-8222-222222222200'::uuid
      )
    )
  $$,
  'P0001',
  'Active assignment not found',
  'an unrelated referee cannot remove another referee from a game'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select lives_ok(
  $$
    select public.remove_ref_from_assignor_game(
      (
        select id from public.job_assignments
        where job_id = '90000000-0000-4000-8000-000000000101'::uuid
          and ref_id = '22222222-2222-4222-8222-222222222200'::uuid
      )
    )
  $$,
  'the assigned assignor can remove an active assignment'
);

select results_eq(
  $$
    select status from public.job_assignments
    where job_id = '90000000-0000-4000-8000-000000000101'::uuid
      and ref_id = '22222222-2222-4222-8222-222222222200'::uuid
  $$,
  array['removed'::text],
  'removal uses a truthful assignment state'
);

select results_eq(
  $$select status from public.jobs where id = '90000000-0000-4000-8000-000000000101'::uuid$$,
  array['open'::text],
  'removing an accepted referee reopens the game'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);

select is_empty(
  $$
    update public.assignor_rosters
    set assignor_id = '22222222-2222-4222-8222-222222222201'::uuid
    where assignor_id = '11111111-1111-4111-8111-111111111101'::uuid
      and ref_id = '22222222-2222-4222-8222-222222222200'::uuid
    returning id
  $$,
  'a referee cannot rewrite roster ownership'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);

select results_eq(
  $$
    select count(*)::bigint from public.assignor_rosters
    where assignor_id = '11111111-1111-4111-8111-111111111101'::uuid
      and ref_id = '22222222-2222-4222-8222-222222222200'::uuid
  $$,
  array[0::bigint],
  'an unrelated referee cannot read another referee roster relationship'
);

reset role;

select * from finish();
rollback;

