begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

set local role anon;
select throws_ok($$ select count(*) from public.private_profiles $$, '42501', null,
  'a signed-out visitor cannot read identity data at all');
select throws_ok($$ insert into public.private_profiles (id) values (gen_random_uuid()) $$, '42501', null,
  'nor write to it');
select throws_ok($$ select count(*) from public.ai_events $$, '42501', null,
  'nor read the AI usage log');
reset role;

-- The people who do need it still have it.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222202', true);
select is(
  (select count(*)::int from public.private_profiles),
  1,
  'a signed-in person still reads their own row, and only their own'
);
reset role;

select lives_ok(
  $$ select count(*) from public.private_profiles $$,
  'and the backend is unaffected'
);

select * from finish();
rollback;
