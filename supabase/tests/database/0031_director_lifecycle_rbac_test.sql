begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

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
  status
)
select
  job_id,
  h.id,
  'basketball',
  title,
  'high_school',
  starts_at,
  90,
  'Director RBAC Gym',
  'Austin',
  'TX',
  pay,
  1,
  'open'
from public.hirers h
cross join (
  values
    ('91000000-0000-4000-8000-000000000101'::uuid, 'Lifecycle Complete', now() + interval '40 days', 100),
    ('91000000-0000-4000-8000-000000000102'::uuid, 'Lifecycle Cancel', now() + interval '30 minutes', 100)
) as games(job_id, title, starts_at, pay)
where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

insert into public.job_assignments (job_id, ref_id, status)
values
  (
    '91000000-0000-4000-8000-000000000101'::uuid,
    '11111111-1111-4111-8111-111111111100'::uuid,
    'pending'
  ),
  (
    '91000000-0000-4000-8000-000000000102'::uuid,
    '22222222-2222-4222-8222-222222222200'::uuid,
    'accepted'
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select is_empty(
  $$
    update public.job_assignments
    set status = 'accepted'
    where job_id = '91000000-0000-4000-8000-000000000101'::uuid
    returning status
  $$,
  'a director cannot directly approve an application row'
);

select is_empty(
  $$
    update public.job_assignments
    set amount_due = 999999, payout_status = 'paid'
    where job_id = '91000000-0000-4000-8000-000000000102'::uuid
    returning id
  $$,
  'a director cannot directly author pay or payout state'
);

select results_eq(
  $$
    select public.director_respond_to_application(
      '91000000-0000-4000-8000-000000000101'::uuid,
      '11111111-1111-4111-8111-111111111100'::uuid,
      true
    )
  $$,
  array['accepted'::text],
  'the owning director can approve through the narrow RPC'
);

select results_eq(
  $$
    select status from public.job_assignments
    where job_id = '91000000-0000-4000-8000-000000000101'::uuid
  $$,
  array['accepted'::text],
  'director approval persists accepted state'
);

select lives_ok(
  $$
    update public.jobs
    set pay_per_game = 120
    where id = '91000000-0000-4000-8000-000000000101'::uuid
  $$,
  'the owning director can edit authoritative game pay'
);

select results_eq(
  $$
    select status from public.job_assignments
    where job_id = '91000000-0000-4000-8000-000000000101'::uuid
  $$,
  array['needs_reconfirm'::text],
  'a material server-side edit requires referee reconfirmation'
);

update public.jobs
set starts_at = now() - interval '1 hour'
where id = '91000000-0000-4000-8000-000000000101'::uuid;

select ok(
  (public.complete_game('91000000-0000-4000-8000-000000000101'::uuid)->>'amount_due')::integer = 120,
  'completion calculates full referee pay on the server'
);

select results_eq(
  $$
    select status from public.jobs
    where id = '91000000-0000-4000-8000-000000000101'::uuid
  $$,
  array['completed'::text],
  'completion closes the game atomically'
);

select results_eq(
  $$
    select amount_due from public.job_assignments
    where job_id = '91000000-0000-4000-8000-000000000101'::uuid
  $$,
  array[120::integer],
  'completion locks the server-calculated amount due'
);

select ok(
  (public.cancel_game('91000000-0000-4000-8000-000000000102'::uuid)->>'fee_amount')::integer = 50,
  'late cancellation calculates the 50 percent bust fee on the server'
);

select results_eq(
  $$
    select status from public.jobs
    where id = '91000000-0000-4000-8000-000000000102'::uuid
  $$,
  array['cancelled'::text],
  'cancellation closes the game atomically'
);

select results_eq(
  $$
    select amount_due from public.job_assignments
    where job_id = '91000000-0000-4000-8000-000000000102'::uuid
  $$,
  array[50::integer],
  'late cancellation locks the server-calculated bust fee'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222203', true);

select throws_ok(
  $$select public.complete_game('91000000-0000-4000-8000-000000000101'::uuid)$$,
  'P0001',
  'Director game not found',
  'another director cannot operate the game lifecycle'
);

reset role;

select * from finish();
rollback;

