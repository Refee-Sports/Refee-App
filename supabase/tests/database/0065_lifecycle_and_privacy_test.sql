begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

-- Lifecycle and privacy fixes (migration 0065), from the referee and director
-- simulations:
--   * games auto-complete 1 hour after their scheduled end (was 2)
--   * no withdrawing once a game has started
--   * an event's accepted assignor can complete and cancel its games
--   * cancelling tells pending applicants too; a whole tournament can be cancelled
--   * confirming a ref clears their overlapping pending applications
--   * ratings, certifications (license numbers) and avatar listings are no
--     longer readable by every signed-in user
--
-- Seeded users: refs A …200, B …201, C …202 (assignor here); directors D …101, E …203.

insert into public.user_roles (user_id, role)
values ('22222222-2222-4222-8222-222222222202'::uuid, 'assignor')
on conflict do nothing;

insert into public.tournaments (
  id, hirer_id, name, sport_id, starts_on, ends_on, venue_city, venue_state,
  staffing_model, assignor_id, assignor_status, status
)
select '96500000-0000-4000-8000-000000000001'::uuid, h.id, 'Rainout Classic', 'basketball',
       current_date + 5, current_date + 6, 'Austin', 'TX',
       'assignor_managed', '22222222-2222-4222-8222-222222222202'::uuid, 'accepted', 'open'
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101';

insert into public.jobs (id, hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at, duration_minutes,
                         venue_name, venue_city, venue_state, job_type, status, num_games, tournament_id)
select v.id::uuid, h.id, 'basketball', v.title, 'high_school', 2, 70, now() + v.starts_in, 120,
       'Life Gym', 'Austin', 'TX', 'single', 'open', 1, v.tournament_id::uuid
from public.hirers h,
     (values
       -- ended 30 minutes ago: inside the 1-hour grace, stays open
       ('96500000-0000-4000-8000-000000000101', 'Just Ended',   interval '-150 minutes', null),
       -- ended 70 minutes ago: auto-completes
       ('96500000-0000-4000-8000-000000000102', 'Long Ended',   interval '-190 minutes', null),
       -- underway
       ('96500000-0000-4000-8000-000000000103', 'Underway',     interval '-30 minutes',  null),
       -- tournament games run by assignor C
       ('96500000-0000-4000-8000-000000000201', 'Pool A',       interval '-30 minutes',  '96500000-0000-4000-8000-000000000001'),
       ('96500000-0000-4000-8000-000000000202', 'Pool B',       interval '5 days',       '96500000-0000-4000-8000-000000000001'),
       ('96500000-0000-4000-8000-000000000203', 'Pool C',       interval '5 days 3 hours','96500000-0000-4000-8000-000000000001'),
       -- single games for the overlap check
       ('96500000-0000-4000-8000-000000000301', 'Overlap One',  interval '10 days',      null),
       ('96500000-0000-4000-8000-000000000302', 'Overlap Two',  interval '10 days 1 hour', null),
       ('96500000-0000-4000-8000-000000000303', 'Later Same Day', interval '10 days 4 hours', null)
     ) as v(id, title, starts_in, tournament_id)
where h.user_id = '11111111-1111-4111-8111-111111111101';

insert into public.job_assignments (job_id, ref_id, status) values
  ('96500000-0000-4000-8000-000000000101', '22222222-2222-4222-8222-222222222200', 'accepted'),
  ('96500000-0000-4000-8000-000000000102', '22222222-2222-4222-8222-222222222200', 'accepted'),
  ('96500000-0000-4000-8000-000000000103', '22222222-2222-4222-8222-222222222200', 'accepted'),
  ('96500000-0000-4000-8000-000000000201', '22222222-2222-4222-8222-222222222200', 'accepted'),
  ('96500000-0000-4000-8000-000000000202', '22222222-2222-4222-8222-222222222200', 'accepted'),
  ('96500000-0000-4000-8000-000000000202', '22222222-2222-4222-8222-222222222201', 'pending'),
  ('96500000-0000-4000-8000-000000000203', '22222222-2222-4222-8222-222222222201', 'pending'),
  ('96500000-0000-4000-8000-000000000301', '22222222-2222-4222-8222-222222222201', 'pending'),
  ('96500000-0000-4000-8000-000000000302', '22222222-2222-4222-8222-222222222201', 'pending'),
  ('96500000-0000-4000-8000-000000000303', '22222222-2222-4222-8222-222222222201', 'pending');

-- ── Auto-complete 1 hour after the scheduled end ────────────────────────────
select public.sweep_game_lifecycle();
select is((select status from public.jobs where id = '96500000-0000-4000-8000-000000000101'),
  'open', 'a game that ended 30 minutes ago is not completed yet');
select is((select status from public.jobs where id = '96500000-0000-4000-8000-000000000102'),
  'completed', 'a game that ended over an hour ago is completed');
select is((select status from public.job_assignments
           where job_id = '96500000-0000-4000-8000-000000000102' and ref_id = '22222222-2222-4222-8222-222222222200'),
  'completed', 'and its confirmed ref is locked in');

-- A finished game with a rating on it, for the privacy checks below.
insert into public.ratings (job_id, ref_id, hirer_id, on_time, professionalism, game_management, comment)
select '96500000-0000-4000-8000-000000000102', '22222222-2222-4222-8222-222222222200', h.id, 5, 4, 3, 'Candid note for the director only'
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101';

insert into public.certifications (ref_id, org_name, license_number)
values ('22222222-2222-4222-8222-222222222200', 'iaabo', 'LIC-PRIVATE-1');

insert into storage.objects (bucket_id, name, owner)
values ('avatars', '22222222-2222-4222-8222-222222222200/avatar.jpg', '22222222-2222-4222-8222-222222222200');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- ── No withdrawing once the game has started ────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select matches(public.withdraw_from_job('96500000-0000-4000-8000-000000000103')->>'error', 'started',
  'a ref cannot withdraw from a game that is underway');
select is((select status from public.job_assignments
           where job_id = '96500000-0000-4000-8000-000000000103' and ref_id = '22222222-2222-4222-8222-222222222200'),
  'accepted', 'they stay on the crew');

-- ── The event's assignor can complete and cancel ────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select throws_ok($$ select public.complete_game('96500000-0000-4000-8000-000000000201') $$, null, null,
  'a ref on the crew cannot complete the game');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222202', true);
select lives_ok($$ select public.complete_game('96500000-0000-4000-8000-000000000201') $$,
  'the accepted assignor can complete a game in their event');
select is((select status from public.jobs where id = '96500000-0000-4000-8000-000000000201'),
  'completed', 'and it is completed');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222203', true);
select throws_ok($$ select public.cancel_game('96500000-0000-4000-8000-000000000202') $$, null, null,
  'another director cannot cancel the game');

-- ── Cancelling tells pending applicants too ─────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222202', true);
create temp table cancel_result on commit drop as
  select public.cancel_game('96500000-0000-4000-8000-000000000202') as r;
select ok((select r->'ref_ids' ? '22222222-2222-4222-8222-222222222200' from cancel_result),
  'confirmed refs are returned to be told');
select ok((select r->'pending_ref_ids' ? '22222222-2222-4222-8222-222222222201' from cancel_result),
  'pending applicants are returned to be told as well');

-- ── Cancelling a whole tournament ───────────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select throws_ok($$ select public.cancel_tournament('96500000-0000-4000-8000-000000000001') $$, '42501', null,
  'a ref cannot cancel a tournament');

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
create temp table tournament_result on commit drop as
  select public.cancel_tournament('96500000-0000-4000-8000-000000000001') as r;
select is((select jsonb_array_length(r->'games') from tournament_result), 1,
  'only games still open are cancelled (one completed, one already cancelled)');
select is((select status from public.jobs where id = '96500000-0000-4000-8000-000000000203'),
  'cancelled', 'the remaining game is cancelled');
select ok((select r->'games'->0->'pending_ref_ids' ? '22222222-2222-4222-8222-222222222201' from tournament_result),
  'each cancelled game says who to tell');
select is((select status from public.tournaments where id = '96500000-0000-4000-8000-000000000001'),
  'cancelled', 'the tournament is cancelled');
select is((select status from public.jobs where id = '96500000-0000-4000-8000-000000000201'),
  'completed', 'a game already played is left completed');

-- ── Confirming a ref clears their overlapping applications ──────────────────
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
select is(public.director_respond_to_application(
  '96500000-0000-4000-8000-000000000301', '22222222-2222-4222-8222-222222222201', true), 'accepted',
  'the director confirms ref B on Overlap One');
select is((select status from public.job_assignments
           where job_id = '96500000-0000-4000-8000-000000000302' and ref_id = '22222222-2222-4222-8222-222222222201'),
  'declined', 'their application to an overlapping game is closed');
select is((select status from public.job_assignments
           where job_id = '96500000-0000-4000-8000-000000000303' and ref_id = '22222222-2222-4222-8222-222222222201'),
  'pending', 'an application to a game that does not overlap stays open');

-- ── Ratings ─────────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);
select is((select count(*)::int from public.ratings where ref_id = '22222222-2222-4222-8222-222222222200'), 0,
  'another ref cannot read a ref''s ratings');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222203', true);
select is((select count(*)::int from public.ratings where ref_id = '22222222-2222-4222-8222-222222222200'), 0,
  'another director cannot read ratings they did not write');

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
select is((select count(*)::int from public.ratings where ref_id = '22222222-2222-4222-8222-222222222200'), 1,
  'the director who wrote a rating can still read it');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select is((select count(*)::int from public.my_ratings()), 1, 'a ref can list the ratings they received');
select is((select on_time::int || '/' || professionalism::int || '/' || game_management::int from public.my_ratings()),
  '5/4/3', 'with the category scores');
select ok(not exists (
  select 1 from information_schema.routines r
  join information_schema.parameters p on p.specific_name = r.specific_name
  where r.routine_schema = 'public' and r.routine_name = 'my_ratings' and p.parameter_name = 'comment'),
  'the director''s comment is not part of what a ref sees');

-- ── Certifications (license numbers) ────────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);
select is((select count(*)::int from public.certifications where ref_id = '22222222-2222-4222-8222-222222222200'), 0,
  'another ref cannot read a ref''s license numbers');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222203', true);
select is((select count(*)::int from public.certifications where ref_id = '22222222-2222-4222-8222-222222222200'), 0,
  'a director with no game involving the ref cannot either');

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
select is((select license_number from public.certifications where ref_id = '22222222-2222-4222-8222-222222222200'),
  'LIC-PRIVATE-1', 'a director the ref has worked or applied for can');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select is((select count(*)::int from public.certifications where ref_id = '22222222-2222-4222-8222-222222222200'), 1,
  'the ref can read their own');

-- ── Avatars can't be listed ─────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 0,
  'other users cannot list the avatars bucket');

select * from finish();
rollback;
