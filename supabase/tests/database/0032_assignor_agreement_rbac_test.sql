begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into public.user_roles (user_id, role)
values ('22222222-2222-4222-8222-222222222200'::uuid, 'assignor')
on conflict do nothing;

-- Bidding to staff a tournament needs a verified identity (0042). Both people
-- here are verified; what's under test is the agreement lifecycle.
insert into public.private_profiles (id, identity_status, identity_verified_at)
values
  ('11111111-1111-4111-8111-111111111101'::uuid, 'approved', now()),
  ('22222222-2222-4222-8222-222222222200'::uuid, 'approved', now())
on conflict (id) do update
  set identity_status = 'approved', identity_verified_at = now();

insert into public.tournaments (
  id, hirer_id, name, sport_id, starts_on, ends_on,
  venue_city, venue_state, staffing_model, status
)
select
  '92000000-0000-4000-8000-000000000001'::uuid,
  h.id,
  'Agreement RBAC Tournament',
  'basketball',
  current_date + 50,
  current_date + 51,
  'Austin',
  'TX',
  'assignor_managed',
  'open'
from public.hirers h
where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select lives_ok(
  $$
    select public.director_invite_assignor(
      '92000000-0000-4000-8000-000000000001'::uuid,
      '22222222-2222-4222-8222-222222222200'::uuid,
      'percentage',
      null,
      10
    )
  $$,
  'the owning director can create the invitation and proposal atomically'
);

select results_eq(
  $$
    select status from public.assignor_proposals
    where tournament_id = '92000000-0000-4000-8000-000000000001'::uuid
  $$,
  array['invited'::text],
  'the server creates an invited proposal'
);

select results_eq(
  $$
    select assignor_status from public.tournaments
    where id = '92000000-0000-4000-8000-000000000001'::uuid
  $$,
  array['inviting'::text],
  'the invitation lifecycle is synchronized on the tournament'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);

select is_empty(
  $$
    update public.assignor_proposals
    set status = 'accepted', fee_pct = 99
    where tournament_id = '92000000-0000-4000-8000-000000000001'::uuid
    returning id
  $$,
  'an assignor cannot directly accept or rewrite a proposal'
);

select lives_ok(
  $$
    select public.submit_assignor_proposal(
      '92000000-0000-4000-8000-000000000001'::uuid,
      'percentage',
      null,
      12.5,
      'Ready to staff'
    )
  $$,
  'the invited assignor can submit terms through the narrow RPC'
);

select results_eq(
  $$
    select status || ':' || fee_pct::text
    from public.assignor_proposals
    where tournament_id = '92000000-0000-4000-8000-000000000001'::uuid
  $$,
  array['submitted:12.50'::text],
  'the submitted terms are stored by the server'
);

select is_empty(
  $$
    update public.tournaments
    set assignor_status = 'accepted'
    where id = '92000000-0000-4000-8000-000000000001'::uuid
    returning id
  $$,
  'an assignor cannot directly accept their own proposal on the tournament'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select is_empty(
  $$
    update public.assignor_proposals
    set status = 'accepted', fee_pct = 1
    where tournament_id = '92000000-0000-4000-8000-000000000001'::uuid
    returning id
  $$,
  'a director cannot bypass the proposal decision RPC or rewrite submitted terms'
);

select results_eq(
  $$
    select public.director_respond_to_assignor_proposal(
      (
        select id from public.assignor_proposals
        where tournament_id = '92000000-0000-4000-8000-000000000001'::uuid
      ),
      true
    )
  $$,
  array['accepted'::text],
  'the owning director can accept the locked proposal row'
);

select results_eq(
  $$
    select assignor_status || ':' || assignor_id::text || ':' || assignor_fee_pct::text
    from public.tournaments
    where id = '92000000-0000-4000-8000-000000000001'::uuid
  $$,
  array['accepted:22222222-2222-4222-8222-222222222200:12.50'::text],
  'the accepted tournament uses server-read assignor and fee terms'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222203', true);

select throws_ok(
  $$
    select public.director_respond_to_assignor_proposal(
      (
        select id from public.assignor_proposals
        where tournament_id = '92000000-0000-4000-8000-000000000001'::uuid
      ),
      false
    )
  $$,
  'P0001',
  'Director proposal not found',
  'another director cannot operate the agreement lifecycle'
);

reset role;

select * from finish();
rollback;
