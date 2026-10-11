begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

-- Game-day reliability (migration 0064).
--   * a ref who drops out of a changed game frees the slot (it used to stay "staffed")
--   * job_notify_targets: who to tell when a ref's status on a game changes
--   * report_running_late / mark_no_show
--   * only the director of a finished game can rate a ref who worked it
--
-- Seeded users: refs A …200, B …201, C …202 (no assignment); directors D …101, E …203.
insert into public.jobs (id, hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at, duration_minutes,
                         venue_name, venue_city, venue_state, job_type, status, num_games)
select v.id::uuid, h.id, 'basketball', v.title, 'high_school', 2, 70, now() + v.starts_in, 60,
       'Rel Gym', 'Austin', 'TX', 'single', v.status, 1
from public.hirers h,
     (values ('98400000-0000-4000-8000-000000000001', 'Changed Game',  interval '3 days',    'staffed'),
             ('98400000-0000-4000-8000-000000000002', 'Underway Game', interval '-30 minutes', 'staffed'),
             ('98400000-0000-4000-8000-000000000003', 'Finished Game', interval '-3 days',   'completed')) as v(id, title, starts_in, status)
where h.user_id = '11111111-1111-4111-8111-111111111101';

insert into public.job_assignments (job_id, ref_id, status, amount_due) values
  ('98400000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222200', 'accepted', null),
  ('98400000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222201', 'needs_reconfirm', null),
  ('98400000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222200', 'accepted', null),
  ('98400000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222201', 'accepted', null),
  ('98400000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222200', 'completed', 70);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- ── Declining a changed game reopens the slot ───────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);
select is(public.respond_to_job('98400000-0000-4000-8000-000000000001', false), 'withdrawn',
  'dropping out of a changed game reports a withdrawal');
select is((select status from public.job_assignments
           where job_id = '98400000-0000-4000-8000-000000000001' and ref_id = '22222222-2222-4222-8222-222222222201'),
  'withdrawn', 'the ref is recorded as withdrawn');
select is((select withdrew_late from public.job_assignments
           where job_id = '98400000-0000-4000-8000-000000000001' and ref_id = '22222222-2222-4222-8222-222222222201'),
  false, 'it does not count against the ref: the organizer changed the game');
select is((select status from public.jobs where id = '98400000-0000-4000-8000-000000000001'),
  'open', 'the game reopens so other refs can take the slot');

-- ── Who to tell ─────────────────────────────────────────────────────────────
select ok(
  '11111111-1111-4111-8111-111111111101' = any (
    select jsonb_array_elements_text(public.job_notify_targets('98400000-0000-4000-8000-000000000001')->'user_ids')::text),
  'a ref on the game gets the director back as the person to tell');
select is(public.job_notify_targets('98400000-0000-4000-8000-000000000001')->>'title', 'Changed Game',
  'and the game title');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222202', true);
select throws_ok($$ select public.job_notify_targets('98400000-0000-4000-8000-000000000001') $$, '42501', null,
  'someone with no assignment on the game cannot look up who to notify');

-- ── Running late ────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select lives_ok($$ select public.report_running_late('98400000-0000-4000-8000-000000000002', 15) $$,
  'a confirmed ref can report running late once the game is close');
select is((select late_minutes from public.job_assignments
           where job_id = '98400000-0000-4000-8000-000000000002' and ref_id = '22222222-2222-4222-8222-222222222200'),
  15, 'the delay is stored for the director to see');
select ok(
  '11111111-1111-4111-8111-111111111101' = any (
    select jsonb_array_elements_text(public.report_running_late('98400000-0000-4000-8000-000000000002', 20)->'user_ids')::text),
  'it returns the director to notify');
select throws_ok($$ select public.report_running_late('98400000-0000-4000-8000-000000000002', 500) $$, '22023', null,
  'an absurd delay is refused');
select throws_ok($$ select public.report_running_late('98400000-0000-4000-8000-000000000001', 10) $$, 'P0001', null,
  'running late cannot be reported for a game days away');
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222202', true);
select throws_ok($$ select public.report_running_late('98400000-0000-4000-8000-000000000002', 10) $$, 'P0001', null,
  'a ref who is not on the game cannot report running late');

-- ── No-show ─────────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select throws_ok($$ select public.mark_no_show('98400000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222201') $$,
  '42501', null, 'a ref cannot mark another ref a no-show');
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222203', true);
select throws_ok($$ select public.mark_no_show('98400000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222201') $$,
  '42501', null, 'another director cannot mark a no-show on this game');
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
select throws_ok($$ select public.mark_no_show('98400000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222200') $$,
  'P0001', null, 'a no-show cannot be recorded before the game starts');
select lives_ok($$ select public.mark_no_show('98400000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222201') $$,
  'the director marks a no-show once the game has started');
select public.complete_game('98400000-0000-4000-8000-000000000002');
select is((select status from public.job_assignments
           where job_id = '98400000-0000-4000-8000-000000000002' and ref_id = '22222222-2222-4222-8222-222222222201'),
  'no_show', 'completing the game does not pay out the no-show');
select is((select status from public.job_assignments
           where job_id = '98400000-0000-4000-8000-000000000002' and ref_id = '22222222-2222-4222-8222-222222222200'),
  'completed', 'while the ref who showed up is paid');

-- ── Ratings ─────────────────────────────────────────────────────────────────
select lives_ok($$
  insert into public.ratings (job_id, ref_id, hirer_id, on_time, professionalism, game_management)
  select '98400000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222200', h.id, 5, 5, 5
  from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  'the director rates a ref who worked their finished game');
select throws_ok($$
  insert into public.ratings (job_id, ref_id, hirer_id, on_time, professionalism, game_management)
  select '98400000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222201', h.id, 1, 1, 1
  from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  '42501', null, 'but not a ref who was never on that game');
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222203', true);
select throws_ok($$
  insert into public.ratings (job_id, ref_id, hirer_id, on_time, professionalism, game_management)
  select '98400000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222200', h.id, 1, 1, 1
  from public.hirers h where h.user_id = '22222222-2222-4222-8222-222222222203' $$,
  '42501', null, 'and another director cannot rate refs on a game that is not theirs');

select * from finish();
rollback;
