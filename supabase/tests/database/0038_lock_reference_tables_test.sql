begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

-- Signed-out visitors: read only.
set local role anon;
select ok((select count(*) from public.sports) > 0, 'signed-out visitors can read sports');
select throws_ok(
  $$ insert into public.sports (id, display_name) values ('quidditch', 'Quidditch') $$,
  '42501', null, 'signed-out visitors cannot add a sport'
);
select throws_ok($$ delete from public.levels $$, '42501', null, 'or delete levels');
reset role;

-- Signed-in users: read only too.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select ok((select count(*) from public.levels) > 0, 'signed-in users can read levels');
select ok((select count(*) from public.cert_bodies) > 0, 'and certification bodies');
select throws_ok(
  $$ update public.sports set display_name = 'Hacked' $$,
  '42501', null, 'signed-in users cannot rename a sport'
);
select throws_ok(
  $$ insert into public.cert_bodies (id, display_name, full_name) values ('fake', 'Fake', 'Fake Body') $$,
  '42501', null, 'or add a certification body'
);
select throws_ok($$ truncate public.cert_bodies cascade $$, '42501', null, 'or empty a table');
reset role;

select is((select count(*)::int from public.sports where display_name = 'Hacked'), 0, 'nothing was changed');

select * from finish();
rollback;
