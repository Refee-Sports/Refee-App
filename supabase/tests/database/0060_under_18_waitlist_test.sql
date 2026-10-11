begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

-- Refee is 18+. A 16 or 17 year old who tries to sign up can ask to be told when
-- a supervised option exists. We keep only what is needed to email them back:
-- the signed-in user, the email on their account (read here, never trusted from
-- the client), an age of 16 or 17, and an optional state. Never a date of birth.

insert into auth.users (id, aud, role, email)
values ('33333333-3333-4333-8333-333333333399'::uuid, 'authenticated', 'authenticated', 'teen@example.test');

-- ── The table is closed to every app role ───────────────────────────────────
select is(
  (select relrowsecurity from pg_class where oid = 'public.under_18_waitlist'::regclass),
  true,
  'waitlist table has row level security on'
);

-- ── Signed out: refused ─────────────────────────────────────────────────────
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$ select public.join_under_18_waitlist(17, 'NY') $$,
  '42501',
  null,
  'signed-out visitors cannot join'
);

-- ── Signed in ───────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333399', true);

select lives_ok(
  $$ select public.join_under_18_waitlist(17, 'ny') $$,
  'a 17 year old can join'
);

select throws_ok(
  $$ select public.join_under_18_waitlist(15, null) $$,
  '22023',
  'Only 16 and 17 year olds can join this list.',
  'under 16 is refused, so we never collect from younger children'
);

select throws_ok(
  $$ select public.join_under_18_waitlist(18, null) $$,
  '22023',
  'Only 16 and 17 year olds can join this list.',
  '18 and over is refused, because adults just sign up'
);

select throws_ok(
  $$ select public.join_under_18_waitlist(16, 'New York') $$,
  '22023',
  'State must be a two-letter code.',
  'a state that is not a two-letter code is refused'
);

select throws_ok(
  $$ select * from public.under_18_waitlist $$,
  '42501',
  null,
  'an app user cannot read the list'
);

select throws_ok(
  $$ insert into public.under_18_waitlist (user_id, email, age) values ('33333333-3333-4333-8333-333333333399', 'x@example.test', 17) $$,
  '42501',
  null,
  'an app user cannot write the list directly'
);

-- ── What was stored (read as the owner of the database) ─────────────────────
reset role;

select results_eq(
  $$ select email, age::int, state from public.under_18_waitlist where user_id = '33333333-3333-4333-8333-333333333399' $$,
  $$ values ('teen@example.test'::text, 17, 'NY'::text) $$,
  'email comes from the account, the state is upper-cased, and the age is kept'
);

-- Joining again updates the one row instead of adding another.
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333399', true);
select lives_ok(
  $$ select public.join_under_18_waitlist(16, null) $$,
  'joining twice is fine'
);
reset role;

select results_eq(
  $$ select count(*)::int, max(age)::int from public.under_18_waitlist where user_id = '33333333-3333-4333-8333-333333333399' $$,
  $$ values (1, 16) $$,
  'still one row, with the latest age'
);

select has_column('public', 'under_18_waitlist', 'age', 'age is stored');
select hasnt_column('public', 'under_18_waitlist', 'date_of_birth', 'a date of birth is never stored');

select * from finish();
rollback;
