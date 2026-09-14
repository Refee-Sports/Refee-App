begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

insert into public.listing_deletions (kind, job_id, title, deleted_by)
values ('game', gen_random_uuid(), 'Deleted Game', '11111111-1111-4111-8111-111111111101');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select throws_ok($$ select count(*) from public.listing_deletions $$, '42501', null,
  'even the director who deleted it cannot read the deletion log from the app');
select throws_ok(
  $$ insert into public.listing_deletions (kind, deleted_by) values ('game', '11111111-1111-4111-8111-111111111101') $$,
  '42501', null, 'or write to it');
reset role;

set local role anon;
select throws_ok($$ select count(*) from public.listing_deletions $$, '42501', null, 'nor can signed-out visitors');
reset role;

select is((select count(*)::int from public.listing_deletions where title = 'Deleted Game'), 1,
  'the backend keeps the record');

select * from finish();
rollback;
