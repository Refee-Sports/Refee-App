begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, phone, aud, role, created_at, updated_at)
values
  ('33333333-3333-4333-8333-333333333301', '15555550301', 'authenticated', 'authenticated', now(), now()),
  ('33333333-3333-4333-8333-333333333302', '15555550302', 'authenticated', 'authenticated', now(), now());

insert into public.public_profiles (id, first_name, last_initial, city, state)
values
  ('33333333-3333-4333-8333-333333333301', 'Delete', 'M', 'Austin', 'TX'),
  ('33333333-3333-4333-8333-333333333302', 'Active', 'R', 'Austin', 'TX');

insert into public.user_roles (user_id, role)
values
  ('33333333-3333-4333-8333-333333333301', 'referee'),
  ('33333333-3333-4333-8333-333333333302', 'referee');

insert into public.conversations (id, kind, created_by)
values ('33333333-3333-4333-8333-333333333310', 'dm', '33333333-3333-4333-8333-333333333301');

insert into public.messages (conversation_id, sender_id, body)
values ('33333333-3333-4333-8333-333333333310', '33333333-3333-4333-8333-333333333301', 'personal message');

select has_function('public', 'prepare_account_deletion', array['uuid', 'text'],
  'backend deletion preparation exists');
select has_function('public', 'account_deletion_blocker', array['uuid'],
  'backend deletion preflight exists');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$ select public.prepare_account_deletion('33333333-3333-4333-8333-333333333301', 'fingerprint') $$,
  '42501', null, 'the app cannot call the privileged preparation RPC directly'
);
select throws_ok(
  $$ select public.account_deletion_blocker('33333333-3333-4333-8333-333333333301') $$,
  '42501', null, 'the app cannot call the privileged deletion preflight directly'
);
reset role;

select is(
  public.account_deletion_blocker('33333333-3333-4333-8333-333333333301'),
  null::text, 'an eligible account has no deletion blocker'
);

select lives_ok(
  $$ select public.prepare_account_deletion('33333333-3333-4333-8333-333333333301', 'fixture-fingerprint') $$,
  'the backend can prepare an eligible account'
);
select is(
  (select body from public.messages where conversation_id = '33333333-3333-4333-8333-333333333310'),
  '[Account deleted]', 'message content is redacted'
);
select ok(
  exists(select 1 from public.account_deletion_receipts where user_fingerprint = 'fixture-fingerprint'),
  'a non-PII deletion receipt is retained'
);

select lives_ok(
  $$ delete from auth.users where id = '33333333-3333-4333-8333-333333333301' $$,
  'auth deletion is not blocked by historical conversations'
);
select ok(
  not exists(select 1 from public.public_profiles where id = '33333333-3333-4333-8333-333333333301'),
  'the personal profile cascades away'
);
select is(
  (select sender_id from public.messages where conversation_id = '33333333-3333-4333-8333-333333333310'),
  null::uuid, 'the retained redacted message is anonymous'
);
select is(
  (select created_by from public.conversations where id = '33333333-3333-4333-8333-333333333310'),
  null::uuid, 'the retained conversation is anonymous'
);
select ok(
  exists(select 1 from public.account_deletion_receipts where user_fingerprint = 'fixture-fingerprint'),
  'the deletion receipt survives auth removal'
);

insert into public.job_assignments (job_id, ref_id, status, amount_due, payout_status)
select id, '33333333-3333-4333-8333-333333333302', 'accepted', 85, 'pending'
  from public.jobs
 where status not in ('completed', 'cancelled')
 limit 1;

select is(
  public.account_deletion_blocker('33333333-3333-4333-8333-333333333302'),
  'Finish or withdraw from active games and resolve pending payouts before deleting your account.',
  'preflight explains an active-work or payout blocker'
);

select throws_ok(
  $$ select public.prepare_account_deletion('33333333-3333-4333-8333-333333333302', 'active-fingerprint') $$,
  'P0001',
  'Finish or withdraw from active games and resolve pending payouts before deleting your account.',
  'active work or unpaid money blocks destructive deletion'
);

select * from finish();
rollback;
