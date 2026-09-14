begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

-- Refs A, B, C; director D; assignor X.
--   A 22222222-2222-4222-8222-222222222200   B ...201   C ...202
--   D 11111111-1111-4111-8111-111111111101   X 6193817b-5cf4-4901-b529-e456182f48be

insert into public.jobs (id, hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at, duration_minutes,
                         venue_name, venue_city, venue_state, job_type, status, num_games)
select v.id::uuid, h.id, 'basketball', v.title, 'high_school', 3, 70, now() + v.starts_in, v.minutes,
       'Crew Gym', 'Austin', 'TX', 'single', v.status, 1
from public.hirers h,
     (values ('98100000-0000-4000-8000-0000000000a1', 'Crew Test Game', interval '3 days', 60, 'open'),
             ('98100000-0000-4000-8000-0000000000a2', 'Tonight Game', interval '2 hours', 60, 'open'),
             ('98100000-0000-4000-8000-0000000000a3', 'Finished Game', interval '-3 days', 60, 'completed'),
             ('98100000-0000-4000-8000-0000000000b1', 'Overdue Game', interval '-30 hours', 60, 'open'),
             ('98100000-0000-4000-8000-0000000000b2', 'Recent Game', interval '-20 hours', 60, 'open'),
             ('98100000-0000-4000-8000-0000000000b3', 'No Length Game', interval '-25 hours', null, 'open'))
       as v(id, title, starts_in, minutes, status)
where h.user_id = '11111111-1111-4111-8111-111111111101';

insert into public.job_assignments (job_id, ref_id, status, amount_due) values
  ('98100000-0000-4000-8000-0000000000a1', '22222222-2222-4222-8222-222222222200', 'accepted', null),
  ('98100000-0000-4000-8000-0000000000a1', '22222222-2222-4222-8222-222222222201', 'accepted', null),
  ('98100000-0000-4000-8000-0000000000a1', '22222222-2222-4222-8222-222222222202', 'pending', null),
  ('98100000-0000-4000-8000-0000000000a2', '22222222-2222-4222-8222-222222222200', 'accepted', null),
  ('98100000-0000-4000-8000-0000000000a3', '22222222-2222-4222-8222-222222222200', 'accepted', null),
  ('98100000-0000-4000-8000-0000000000b1', '22222222-2222-4222-8222-222222222200', 'accepted', null),
  ('98100000-0000-4000-8000-0000000000b1', '22222222-2222-4222-8222-222222222201', 'needs_reconfirm', 50),
  ('98100000-0000-4000-8000-0000000000b1', '22222222-2222-4222-8222-222222222202', 'withdrawn', null),
  ('98100000-0000-4000-8000-0000000000b2', '22222222-2222-4222-8222-222222222200', 'accepted', null),
  ('98100000-0000-4000-8000-0000000000b3', '22222222-2222-4222-8222-222222222200', 'accepted', null);

-- The seed may already have A on X's roster; make it an active entry either way.
insert into public.assignor_rosters (assignor_id, ref_id, status)
values ('6193817b-5cf4-4901-b529-e456182f48be', '22222222-2222-4222-8222-222222222200', 'accepted')
on conflict (assignor_id, ref_id) do update set status = 'accepted', removed_at = null;
select set_config('test.roster_id', (
  select id::text from public.assignor_rosters
  where assignor_id = '6193817b-5cf4-4901-b529-e456182f48be' and ref_id = '22222222-2222-4222-8222-222222222200'), true);

insert into public.tournaments (id, hirer_id, name, sport_id, starts_on, ends_on, venue_city, venue_state, status,
                                assignor_id, assignor_status)
select '98100000-0000-4000-8000-0000000000d1'::uuid, h.id, 'Proposal Cup', 'basketball', current_date + 30,
       current_date + 31, 'Austin', 'TX', 'open', '6193817b-5cf4-4901-b529-e456182f48be', 'inviting'
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101';
insert into public.assignor_proposals (tournament_id, assignor_id, status)
values ('98100000-0000-4000-8000-0000000000d1', '6193817b-5cf4-4901-b529-e456182f48be', 'submitted');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- ── Crew chat ───────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select isnt(public.get_or_create_crew_thread('98100000-0000-4000-8000-0000000000a1'), null,
  'a confirmed ref opens the crew chat');
select is(public.get_or_create_crew_thread('98100000-0000-4000-8000-0000000000a1'),
  (select id from public.conversations where job_id = '98100000-0000-4000-8000-0000000000a1' and kind = 'game_crew'),
  'opening it again returns the same chat');
select is(
  (select count(*)::int from public.conversation_participants cp join public.conversations c on c.id = cp.conversation_id
   where c.job_id = '98100000-0000-4000-8000-0000000000a1' and c.kind = 'game_crew'),
  2, 'only confirmed refs are in the crew chat, not applicants or the director');
select lives_ok(
  $$ insert into public.messages (conversation_id, sender_id, body)
     select id, '22222222-2222-4222-8222-222222222200', 'Running 5 late'
     from public.conversations where job_id = '98100000-0000-4000-8000-0000000000a1' and kind = 'game_crew' $$,
  'refs can message each other in the crew chat');
select throws_ok($$ select public.post_crew_note('98100000-0000-4000-8000-0000000000a1', 'hello') $$,
  'P0001', 'Not your game', 'a ref cannot post a director note');
select throws_ok($$ select public.get_crew_thread('98100000-0000-4000-8000-0000000000a1') $$,
  'P0001', 'Not your game', 'or read the director''s note thread');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222202', true);
select throws_ok($$ select public.get_or_create_crew_thread('98100000-0000-4000-8000-0000000000a1') $$,
  'P0001', 'Not on this crew', 'an applicant cannot open the crew chat');
select is(public.withdraw_from_job('98100000-0000-4000-8000-0000000000a1')->>'error',
  'You are not confirmed on this game.', 'an applicant has nothing to withdraw from');

-- ── Director notes ──────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
select throws_ok($$ select public.post_crew_note('98100000-0000-4000-8000-0000000000a1', '   ') $$,
  'P0001', 'Note is empty', 'a blank director note is refused');
select isnt(public.post_crew_note('98100000-0000-4000-8000-0000000000a1', repeat('x', 5000)), null,
  'the director posts a note to the crew');
select lives_ok($$ select public.post_crew_note('98100000-0000-4000-8000-0000000000a1', 'Second note') $$,
  'and a second one');
select is(json_array_length(public.get_crew_thread('98100000-0000-4000-8000-0000000000a1')->'messages'), 2,
  'both notes land in one thread');
select is(
  (select max(length(m->>'body')) from json_array_elements(
     public.get_crew_thread('98100000-0000-4000-8000-0000000000a1')->'messages') m),
  4000, 'an overlong note is cut at 4,000 characters');
select is(json_array_length(public.get_crew_thread('98100000-0000-4000-8000-0000000000a1')->'receipts'), 2,
  'the note thread tracks reads for each confirmed ref');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select throws_ok(
  $$ insert into public.messages (conversation_id, sender_id, body)
     select id, '22222222-2222-4222-8222-222222222200', 'Reply?'
     from public.conversations where job_id = '98100000-0000-4000-8000-0000000000a1' and kind = 'director_crew_note' $$,
  '42501', null, 'refs cannot reply to a director note; it is one-way');

-- ── Withdrawing ─────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);
select is(public.withdraw_from_job('98100000-0000-4000-8000-0000000000a1')->>'late', 'false',
  'withdrawing three days out is not late');

reset role;
select is(
  (select status || '/' || withdrew_late from public.job_assignments
   where job_id = '98100000-0000-4000-8000-0000000000a1' and ref_id = '22222222-2222-4222-8222-222222222201'),
  'withdrawn/false', 'the ref is off the crew');
select is(
  (select count(*)::int from public.messages m join public.conversations c on c.id = m.conversation_id
   where c.job_id = '98100000-0000-4000-8000-0000000000a1' and c.kind = 'game_crew'
     and m.sender_id = '22222222-2222-4222-8222-222222222201'),
  1, 'the crew chat is told the slot is open');
select is((select status from public.jobs where id = '98100000-0000-4000-8000-0000000000a1'), 'open',
  'the game reopens for applications');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select is(public.withdraw_from_job('98100000-0000-4000-8000-0000000000a2')->>'late', 'true',
  'withdrawing inside 24 hours is marked late');
select is(public.withdraw_from_job('98100000-0000-4000-8000-0000000000a3')->>'error', 'This game is already closed.',
  'no withdrawing from a finished game');
select is(public.withdraw_from_job('98100000-0000-4000-8000-0000000000ff')->>'error', 'Game not found',
  'or from a game that does not exist');

-- ── Assignor rosters ────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
select throws_ok($$ select public.remove_ref_from_roster(current_setting('test.roster_id')::uuid) $$,
  'P0001', 'Active roster relationship not found', 'only the assignor can remove a ref from their roster');
select set_config('request.jwt.claim.sub', '6193817b-5cf4-4901-b529-e456182f48be', true);
select lives_ok($$ select public.remove_ref_from_roster(current_setting('test.roster_id')::uuid) $$,
  'the assignor removes a ref from their roster');
select throws_ok($$ select public.remove_ref_from_roster(current_setting('test.roster_id')::uuid) $$,
  'P0001', 'Active roster relationship not found', 'removing the same ref twice is refused');

-- ── Assignor proposals ──────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select throws_ok($$ select public.withdraw_assignor_proposal('98100000-0000-4000-8000-0000000000d1') $$,
  'P0001', 'Tournament invitation not available', 'only the invited assignor can withdraw a proposal');
select set_config('request.jwt.claim.sub', '6193817b-5cf4-4901-b529-e456182f48be', true);
select isnt(public.withdraw_assignor_proposal('98100000-0000-4000-8000-0000000000d1'), null,
  'the assignor withdraws their proposal');
select throws_ok($$ select public.withdraw_assignor_proposal('98100000-0000-4000-8000-0000000000d1') $$,
  'P0001', 'Proposal not available', 'withdrawing twice is refused');
reset role;
select is(
  (select p.status || '/' || t.assignor_status from public.assignor_proposals p
   join public.tournaments t on t.id = p.tournament_id where t.id = '98100000-0000-4000-8000-0000000000d1'),
  'withdrawn/declined', 'the proposal is withdrawn and the tournament shows the assignor declined');

-- ── Game lifecycle sweep (runs on a schedule, as the backend) ──────────────
select public.sweep_game_lifecycle();
select is((select status from public.jobs where id = '98100000-0000-4000-8000-0000000000b1'), 'completed',
  'a game 24 hours past its end is completed automatically');
select ok((select completed_at is not null from public.jobs where id = '98100000-0000-4000-8000-0000000000b1'),
  'and records when');
select is(
  (select status || '/' || amount_due::int from public.job_assignments
   where job_id = '98100000-0000-4000-8000-0000000000b1' and ref_id = '22222222-2222-4222-8222-222222222200'),
  'completed/70', 'a confirmed ref is owed the game''s pay');
select is(
  (select status || '/' || amount_due::int from public.job_assignments
   where job_id = '98100000-0000-4000-8000-0000000000b1' and ref_id = '22222222-2222-4222-8222-222222222201'),
  'completed/50', 'a ref asked to reconfirm still gets paid, and an amount already set is kept');
select is(
  (select status from public.job_assignments
   where job_id = '98100000-0000-4000-8000-0000000000b1' and ref_id = '22222222-2222-4222-8222-222222222202'),
  'withdrawn', 'a ref who withdrew is not paid');
select is((select status from public.jobs where id = '98100000-0000-4000-8000-0000000000b2'), 'open',
  'a game that ended less than a day ago is left alone');
select is((select status from public.jobs where id = '98100000-0000-4000-8000-0000000000b3'), 'open',
  'a game with no length on file is assumed to run 2 hours before the 24-hour wait');

select * from finish();
rollback;
