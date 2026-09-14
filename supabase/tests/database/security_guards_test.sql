begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

-- Guards that catch a future migration getting security wrong, not just the
-- functions and tables that exist today.

select is(
  array(
    select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
    order by 1),
  '{}'::text[],
  'every security-definer function pins its search_path');

select is(
  array(
    select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'execute')
    order by 1),
  '{}'::text[],
  'signed-out visitors cannot call any backend function');

select ok(not has_function_privilege('authenticated', 'public.sweep_game_lifecycle()', 'execute'),
  'the apps cannot run the lifecycle sweep');
select ok(not has_function_privilege('authenticated', 'public.invoke_run_payouts()', 'execute'),
  'or start a payout run');

select is(
  array(
    select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    order by 1),
  '{}'::text[],
  'row-level security is on for every table');

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select throws_ok($$ select public.sweep_game_lifecycle() $$, '42501', null,
  'a signed-out visitor calling the sweep is refused');
select throws_ok($$ select public.withdraw_from_job('00000000-0000-4000-8000-000000000000') $$, '42501', null,
  'or withdrawing from a game');
select lives_ok($$ select count(*) from public.conversations $$,
  'a signed-out visitor listing conversations gets nothing, not an error');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select throws_ok($$ select public.sweep_game_lifecycle() $$, '42501', null,
  'a signed-in user calling the sweep is refused');
reset role;

select * from finish();
rollback;
