begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

-- Taking on another role ("Also work games"). The app first re-saves the role
-- the person already holds. user_roles has no UPDATE policy, so that save has
-- to be ON CONFLICT DO NOTHING: an upsert that becomes an update is refused.
-- Seeded director D …101 holds "director".
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select lives_ok(
  $$ insert into public.user_roles (user_id, role) values ('11111111-1111-4111-8111-111111111101', 'director')
     on conflict (user_id, role) do nothing $$,
  're-saving a role they already hold is a no-op');

select throws_ok(
  $$ insert into public.user_roles (user_id, role) values ('11111111-1111-4111-8111-111111111101', 'director')
     on conflict (user_id, role) do update set role = excluded.role $$,
  '42501', null, 'the old insert-or-update is what RLS refused');

select lives_ok(
  $$ insert into public.user_roles (user_id, role) values ('11111111-1111-4111-8111-111111111101', 'referee')
     on conflict (user_id, role) do nothing $$,
  'and adding the new role works');

select throws_ok(
  $$ insert into public.user_roles (user_id, role) values ('22222222-2222-4222-8222-222222222200', 'director')
     on conflict (user_id, role) do nothing $$,
  '42501', null, 'nobody can give a role to someone else');

select * from finish();
rollback;
