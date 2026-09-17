begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- The seeded referee and director. Both start unverified: 0041 defaults every
-- existing account to 'unstarted', which is the whole point of the rollout.
-- 11111111-…-111101 is the director, and the seed gives that user the assignor
-- role as well.

-- Start the guarded columns at known values, so every attempt below is a real
-- change. The guard fires on changing a backend column, not on rewriting it
-- with the value it already has — a no-op write is not a breach, and the seed
-- already ships some of these set.
update public.public_profiles set is_verified = false
where id = '22222222-2222-4222-8222-222222222202';
update public.hirers set is_verified = false
where user_id = '11111111-1111-4111-8111-111111111101';
update public.private_profiles
set background_check_status = 'pending', stripe_account_id = null
where id = '22222222-2222-4222-8222-222222222202';

select is(
  (select identity_status from public.private_profiles where id = '11111111-1111-4111-8111-111111111100'),
  'unstarted',
  'existing accounts start unverified'
);
select ok(
  not public.is_identity_verified('11111111-1111-4111-8111-111111111100'),
  'and is_identity_verified says so'
);

-- ── The backend decides ──────────────────────────────────────────────────────

update public.private_profiles
set identity_status = 'approved', identity_verified_at = now(), identity_session_id = 'sess_backend_1'
where id = '11111111-1111-4111-8111-111111111100';

select ok(
  public.is_identity_verified('11111111-1111-4111-8111-111111111100'),
  'the backend can approve an identity'
);

update public.public_profiles set is_verified = true
where id = '11111111-1111-4111-8111-111111111100';
select ok(
  (select is_verified from public.public_profiles where id = '11111111-1111-4111-8111-111111111100'),
  'and can set the badge the apps show'
);

-- Taking the approval away closes it again.
update public.private_profiles set identity_status = 'expired' where id = '11111111-1111-4111-8111-111111111100';
select ok(
  not public.is_identity_verified('11111111-1111-4111-8111-111111111100'),
  'an approval that expires stops counting'
);
update public.private_profiles
set identity_status = 'approved' where id = '11111111-1111-4111-8111-111111111100';

-- ── A user cannot verify themselves ──────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222202', true);

select throws_ok(
  $$ update public.public_profiles set is_verified = true
     where id = '22222222-2222-4222-8222-222222222202' $$,
  '42501', null,
  'a user cannot mark their own profile verified'
);

select throws_ok(
  $$ update public.private_profiles set identity_status = 'approved'
     where id = '22222222-2222-4222-8222-222222222202' $$,
  '42501', null,
  'nor approve their own identity check'
);

select throws_ok(
  $$ update public.private_profiles set identity_verified_at = now()
     where id = '22222222-2222-4222-8222-222222222202' $$,
  '42501', null,
  'nor backdate when they were verified'
);

select throws_ok(
  $$ update public.private_profiles set background_check_status = 'cleared'
     where id = '22222222-2222-4222-8222-222222222202' $$,
  '42501', null,
  'nor clear their own background check'
);

select throws_ok(
  $$ update public.private_profiles set stripe_account_id = 'acct_someone_elses'
     where id = '22222222-2222-4222-8222-222222222202' $$,
  '42501', null,
  'nor point their payouts at another Stripe account'
);

-- Edits that are genuinely theirs still work.
select lives_ok(
  $$ update public.private_profiles set city = 'Brooklyn', state = 'NY'
     where id = '22222222-2222-4222-8222-222222222202' $$,
  'but they can still edit their own address'
);

select ok(
  not public.is_identity_verified('22222222-2222-4222-8222-222222222202'),
  'and none of that made them verified'
);

reset role;

-- ── A hirer cannot verify their organization ─────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select throws_ok(
  $$ update public.hirers set is_verified = true
     where user_id = '11111111-1111-4111-8111-111111111101' $$,
  '42501', null,
  'a director cannot mark their own organization verified'
);

select lives_ok(
  $$ update public.hirers set org_name = 'Hayes Basketball Classic'
     where user_id = '11111111-1111-4111-8111-111111111101' $$,
  'but can still rename it'
);

reset role;

-- ── The webhook ledger is backend-only ───────────────────────────────────────

insert into public.didit_webhook_events (event_id, event_type, session_id)
values ('evt_test_1', 'status.updated', 'sess_backend_1');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111100', true);
select throws_ok($$ select count(*) from public.didit_webhook_events $$, '42501', null,
  'the apps cannot read the Didit webhook ledger');
select throws_ok(
  $$ insert into public.didit_webhook_events (event_id, event_type) values ('evt_x', 'status.updated') $$,
  '42501', null, 'nor write to it');
reset role;

set local role anon;
select throws_ok($$ select count(*) from public.didit_webhook_events $$, '42501', null,
  'nor can signed-out visitors');
reset role;

select * from finish();
rollback;
