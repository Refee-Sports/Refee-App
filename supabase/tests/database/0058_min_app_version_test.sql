begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

set local role anon;

select is(
  public.get_min_app_version('ios'), '1.0.0',
  'a signed-out install can ask for the minimum iOS version'
);

select is(
  public.get_min_app_version('ANDROID'), '1.0.0',
  'the platform name is case-insensitive'
);

select is(
  public.get_min_app_version('windows'), null,
  'an unknown platform has no minimum'
);

select throws_ok(
  $$select * from public.app_min_versions$$,
  '42501', null,
  'the table itself is not readable by anonymous callers'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111100', true);

select throws_ok(
  $$update public.app_min_versions set min_version = '99.0.0'$$,
  '42501', null,
  'a signed-in user cannot raise the minimum'
);

select throws_ok(
  $$select * from public.app_min_versions$$,
  '42501', null,
  'a signed-in user cannot read the table directly either'
);

reset role;

select throws_ok(
  $$insert into public.app_min_versions (platform, min_version) values ('ios', '2.0.0')$$,
  '23505', null,
  'the platform is unique'
);

select throws_ok(
  $$insert into public.app_min_versions (platform, min_version) values ('web', '2.0.0')$$,
  '23514', null,
  'only ios and android are valid platforms'
);

select * from finish();
rollback;
