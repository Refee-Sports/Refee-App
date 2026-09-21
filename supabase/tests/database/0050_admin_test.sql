begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

-- Staff, and an ordinary referee who is not staff.
--   admin  22222222-2222-4222-8222-222222222203
--   ref    22222222-2222-4222-8222-222222222201
insert into public.admins (user_id, note)
values ('22222222-2222-4222-8222-222222222203', 'test staff');

-- ── The door ────────────────────────────────────────────────────────────────

select ok(public.is_admin('22222222-2222-4222-8222-222222222203'), 'staff are staff');
select ok(not public.is_admin('22222222-2222-4222-8222-222222222201'), 'a referee is not');
select ok(not public.is_admin(null), 'and neither is nobody');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- ── A non-admin is refused everything ───────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);

select throws_ok($$ select * from public.admin_identity_queue() $$, '42501', null,
  'a referee cannot read the verification queue');
select throws_ok(
  $$ select public.admin_set_identity_status('22222222-2222-4222-8222-222222222200','approved',null) $$,
  '42501', null, 'nor decide someone''s identity');
select throws_ok($$ select * from public.admin_user_search('a') $$, '42501', null,
  'nor search accounts');
select throws_ok($$ select public.admin_user_detail('22222222-2222-4222-8222-222222222200') $$,
  '42501', null, 'nor open one');
select throws_ok(
  $$ select public.admin_set_suspended('22222222-2222-4222-8222-222222222200', true, 'x') $$,
  '42501', null, 'nor suspend anyone');
select throws_ok($$ select * from public.admin_payment_issues() $$, '42501', null,
  'nor look at the money');
select throws_ok($$ select public.admin_metrics() $$, '42501', null, 'nor the metrics');

-- The table itself is closed, so nobody can promote themselves into it.
select throws_ok($$ select count(*) from public.admins $$, '42501', null,
  'and the staff list is unreadable from the app');
select throws_ok(
  $$ insert into public.admins (user_id) values ('22222222-2222-4222-8222-222222222201') $$,
  '42501', null, 'so no one can make themselves staff');

-- ── Staff can ───────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222203', true);

select lives_ok($$ select public.admin_metrics() $$, 'staff read the metrics');
select lives_ok($$ select * from public.admin_identity_queue() $$, 'and the verification queue');

-- ── Suspension ──────────────────────────────────────────────────────────────
select ok(
  public.is_identity_verified('22222222-2222-4222-8222-222222222201'),
  'an approved referee can work'
);

select lives_ok(
  $$ select public.admin_set_suspended('22222222-2222-4222-8222-222222222201', true, 'Conduct report') $$,
  'staff suspend an account'
);

select ok(
  not public.is_identity_verified('22222222-2222-4222-8222-222222222201'),
  'which closes every gate that asks whether they are verified'
);

-- A suspension needs a reason on the record, or it cannot be answered for later.
select throws_ok(
  $$ select public.admin_set_suspended('22222222-2222-4222-8222-222222222200', true, '  ') $$,
  '22023', null, 'and a suspension without a reason is refused'
);

-- ── The guard ───────────────────────────────────────────────────────────────
-- This is the one that matters most. The guard decides what to do by reading
-- current_user, so declaring it SECURITY DEFINER makes current_user the owner
-- and silently turns the whole thing off — for suspension AND for every
-- identity and payout column it has protected since 0041.
select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'guard_private_profile_backend_columns'),
  false,
  'the private-profile guard is not security definer (it would disable itself)'
);

-- Put the referee somewhere that isn't approved, so the self-approval below is
-- a real change rather than a no-op write the guard would ignore anyway.
select public.admin_set_identity_status(
  '22222222-2222-4222-8222-222222222201', 'in_review', 'Test: sent to review'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);
select throws_ok(
  $$ update public.private_profiles set suspended_at = null
      where id = '22222222-2222-4222-8222-222222222201' $$,
  '42501', null, 'a suspended person cannot lift their own suspension'
);
select throws_ok(
  $$ update public.private_profiles set identity_status = 'approved'
      where id = '22222222-2222-4222-8222-222222222201' $$,
  '42501', null, 'and someone in review cannot approve themselves'
);

reset role;

select * from finish();

rollback;
