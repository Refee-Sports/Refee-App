begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

-- Home ZIP (migration 0070). Seeded ref A …200.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);

select lives_ok(
  $$ update public.private_profiles set home_zip = '77007' where id = '22222222-2222-4222-8222-222222222200' $$,
  'a referee can save a 5-digit home ZIP');
select throws_ok(
  $$ update public.private_profiles set home_zip = '7700' where id = '22222222-2222-4222-8222-222222222200' $$,
  '23514', null, 'anything but 5 digits is refused');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);
select is(
  (select count(*)::int from public.private_profiles where id = '22222222-2222-4222-8222-222222222200'),
  0, 'nobody else can read it');

select * from finish();
rollback;
