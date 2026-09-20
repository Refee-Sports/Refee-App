begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

-- Who's who (seeded): refs A, B, C; director D (has a hirer profile); a
-- second director E.
--   A 22222222-2222-4222-8222-222222222200   B 22222222-2222-4222-8222-222222222201
--   D 11111111-1111-4111-8111-111111111101   E 22222222-2222-4222-8222-222222222203

insert into public.private_profiles (id, legal_first_name, legal_last_name, date_of_birth, street_address)
values ('22222222-2222-4222-8222-222222222200', 'Alex', 'Private', '1990-01-01', '1 Hidden St')
on conflict (id) do update set legal_first_name = excluded.legal_first_name, street_address = excluded.street_address;

insert into public.push_tokens (token, user_id, platform)
values ('ExponentPushToken[privacy-test-a]', '22222222-2222-4222-8222-222222222200', 'ios');

insert into public.ai_events (user_id, kind) values ('22222222-2222-4222-8222-222222222200', 'schedule_extract');

-- A private conversation between D and A.
insert into public.conversations (id, kind, created_by)
values ('98000000-0000-4000-8000-0000000000c1', 'dm', '11111111-1111-4111-8111-111111111101');
insert into public.conversation_participants (conversation_id, user_id) values
  ('98000000-0000-4000-8000-0000000000c1', '11111111-1111-4111-8111-111111111101'),
  ('98000000-0000-4000-8000-0000000000c1', '22222222-2222-4222-8222-222222222200');
insert into public.messages (conversation_id, sender_id, body)
values ('98000000-0000-4000-8000-0000000000c1', '11111111-1111-4111-8111-111111111101', 'Private note to Alex');

-- D's game: A is confirmed, B has applied.
insert into public.jobs (id, hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at,
                         venue_name, venue_city, venue_state, job_type, status, num_games)
select '98000000-0000-4000-8000-0000000000a1'::uuid, h.id, 'basketball', 'Privacy Game', 'high_school', 2, 70,
       now() + interval '5 days', 'Privacy Gym', 'Austin', 'TX', 'single', 'open', 1
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101';
insert into public.job_assignments (job_id, ref_id, status) values
  ('98000000-0000-4000-8000-0000000000a1', '22222222-2222-4222-8222-222222222200', 'accepted'),
  ('98000000-0000-4000-8000-0000000000a1', '22222222-2222-4222-8222-222222222201', 'pending');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- ── As ref B ────────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);

select is((select count(*)::int from public.private_profiles where id = '22222222-2222-4222-8222-222222222200'), 0,
  'a ref cannot read another ref''s private profile (legal name, birth date, home address)');
select throws_ok($$ insert into public.private_profiles (id) values ('22222222-2222-4222-8222-222222222200') $$,
  '42501', null, 'or create one in their name');
select is((select count(*)::int from public.push_tokens where user_id = '22222222-2222-4222-8222-222222222200'), 0,
  'a user cannot read someone else''s push tokens');
select is((select count(*)::int from public.ai_events where user_id = '22222222-2222-4222-8222-222222222200'), 0,
  'a user cannot see someone else''s AI import log');

select is((select count(*)::int from public.conversations where id = '98000000-0000-4000-8000-0000000000c1'), 0,
  'a non-participant cannot see a conversation');
select is((select count(*)::int from public.messages where conversation_id = '98000000-0000-4000-8000-0000000000c1'), 0,
  'or read its messages');
select throws_ok(
  $$ insert into public.messages (conversation_id, sender_id, body)
     values ('98000000-0000-4000-8000-0000000000c1', '22222222-2222-4222-8222-222222222201', 'hi') $$,
  '42501', null, 'or post into it');
select throws_ok(
  $$ insert into public.conversation_participants (conversation_id, user_id)
     values ('98000000-0000-4000-8000-0000000000c1', '22222222-2222-4222-8222-222222222201') $$,
  '42501', null, 'or add themselves to it');
select throws_ok(
  $$ insert into public.messages (conversation_id, sender_id, body)
     values ('98000000-0000-4000-8000-0000000000c1', '22222222-2222-4222-8222-222222222200', 'impersonation') $$,
  '42501', null, 'no one can post as someone else');

select is((select count(*)::int from public.job_assignments where job_id = '98000000-0000-4000-8000-0000000000a1'), 1,
  'an applicant sees only their own application on a game');
select throws_ok(
  $$ insert into public.job_assignments (job_id, ref_id, status)
     values ('98000000-0000-4000-8000-0000000000a1', '22222222-2222-4222-8222-222222222202', 'accepted') $$,
  '42501', null, 'refs cannot put anyone on a crew directly');
select throws_ok(
  $$ insert into public.user_roles (user_id, role) values ('22222222-2222-4222-8222-222222222200', 'director') $$,
  '42501', null, 'a user cannot give someone else a role');
select throws_ok(
  $$ insert into public.user_roles (user_id, role) values ('22222222-2222-4222-8222-222222222201', 'admin') $$,
  '23514', null, 'and there is no admin role to claim');
select throws_ok(
  $$ insert into public.ratings (job_id, ref_id, hirer_id, rating)
     select '98000000-0000-4000-8000-0000000000a1', '22222222-2222-4222-8222-222222222200', h.id, 1
     from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  '42501', null, 'a ref cannot rate someone on the director''s behalf');

-- Writes to other people's rows: row-level security turns these into no-ops,
-- checked below once we're back to the backend role.
update public.private_profiles set street_address = 'Changed' where id = '22222222-2222-4222-8222-222222222200';
delete from public.push_tokens where user_id = '22222222-2222-4222-8222-222222222200';
update public.job_assignments set status = 'accepted'
where job_id = '98000000-0000-4000-8000-0000000000a1' and ref_id = '22222222-2222-4222-8222-222222222201';
update public.hirers set org_name = 'Hijacked' where user_id = '11111111-1111-4111-8111-111111111101';
update public.tournaments set name = 'Hijacked';
update public.jobs set pay_per_game = 1 where id = '98000000-0000-4000-8000-0000000000a1';

-- ── As ref A ────────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select is((select count(*)::int from public.private_profiles where id = '22222222-2222-4222-8222-222222222200'), 1,
  'a ref can read their own private profile');
select is((select count(*)::int from public.messages where conversation_id = '98000000-0000-4000-8000-0000000000c1'), 1,
  'a participant reads their conversation');
select is((select count(*)::int from public.job_assignments where job_id = '98000000-0000-4000-8000-0000000000a1'), 1,
  'a confirmed ref does not see other people''s pending applications');

-- ── As director E (not this game's director) ────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222203', true);
select is((select count(*)::int from public.job_assignments where job_id = '98000000-0000-4000-8000-0000000000a1'), 0,
  'another director cannot see who applied to this game');

-- ── As director D ───────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
select is((select count(*)::int from public.job_assignments where job_id = '98000000-0000-4000-8000-0000000000a1'), 2,
  'the game''s director sees every application');
-- Starting a conversation, the way the apps do it: create it, then add both people.
insert into public.conversations (id, kind, created_by)
values ('98000000-0000-4000-8000-0000000000c2', 'dm', '11111111-1111-4111-8111-111111111101');
select lives_ok(
  $$ insert into public.conversation_participants (conversation_id, user_id) values
       ('98000000-0000-4000-8000-0000000000c2', '11111111-1111-4111-8111-111111111101'),
       ('98000000-0000-4000-8000-0000000000c2', '22222222-2222-4222-8222-222222222201') $$,
  'the person who starts a conversation can add both people to it');

-- ── Signed out ──────────────────────────────────────────────────────────────
reset role;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
-- Since 0049 this is stronger than 'no rows': the signed-out key has no grant
-- on these tables at all, so a request is refused before any policy is
-- consulted. Two locks, not one — a policy accidentally written without
-- `to authenticated` can no longer open a table to the public key.
select throws_ok($$ select count(*) from public.jobs $$, '42501', null,
  'signed-out visitors are refused games outright');
select throws_ok($$ select count(*) from public.public_profiles $$, '42501', null,
  'and profiles');
select throws_ok($$ select count(*) from public.private_profiles $$, '42501', null,
  'and identity data');
-- The reference lists a signed-out visitor legitimately reads stay open.
select lives_ok($$ select count(*) from public.sports $$,
  'but the sport list is still readable signed out');
reset role;

-- ── Nothing ref B tried to change changed ───────────────────────────────────
select is((select street_address from public.private_profiles where id = '22222222-2222-4222-8222-222222222200'),
  '1 Hidden St', 'ref B could not change ref A''s private profile');
select is((select count(*)::int from public.push_tokens where token = 'ExponentPushToken[privacy-test-a]'), 1,
  'or delete ref A''s push tokens');
select is(
  (select status from public.job_assignments
   where job_id = '98000000-0000-4000-8000-0000000000a1' and ref_id = '22222222-2222-4222-8222-222222222201'),
  'pending', 'or approve their own application');
select is((select count(*)::int from public.hirers where org_name = 'Hijacked'), 0,
  'or edit a director''s organization');
select is((select count(*)::int from public.tournaments where name = 'Hijacked'), 0, 'or anyone''s tournament');
select is((select pay_per_game::int from public.jobs where id = '98000000-0000-4000-8000-0000000000a1'), 70,
  'or a director''s game pay');

select * from finish();
rollback;
