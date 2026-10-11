begin;

create extension if not exists pgtap with schema extensions;

select plan(38);

-- New-game alerts (migration 0062).
--
-- When a game is posted, the backend works out which referees should hear about
-- it: the same people who would see it in their feed (distance, available day,
-- minimum rate), who can actually take it (verified, not suspended, no clash with
-- a confirmed game, on the roster when an assignor runs the event), and who have
-- not turned new-game alerts off. The caller never names recipients.
--
-- Seed people (see supabase/seed.sql):
--   Alex   111…100  Austin TX      min $75   40 mi   Mon–Fri (mask 62)
--   Devon  222…202  San Antonio TX min $60   30 mi   any day (127)
--   Marcus 222…201  Houston TX     min $120  50 mi   Sat+Sun (65)
--   Sam    222…200  Denver CO      no preferences row (defaults: 25 mi, any rate, any day)
--   Jordan 111…101  director, the hirer

-- The next given weekday (0 = Sunday) at a given hour, Texas time: always a
-- week or so ahead, so these never depend on what day the test runs.
create function pg_temp.next_local(p_dow int, p_hour int) returns timestamptz
language sql as $$
  select (
    date_trunc('day', now() at time zone 'America/Chicago')
    + ((((p_dow - extract(dow from now() at time zone 'America/Chicago')::int) + 7) % 7 + 7) * interval '1 day')
    + make_interval(hours => p_hour)
  ) at time zone 'America/Chicago'
$$;

create function pg_temp.mk_job(
  p_id text, p_title text, p_starts timestamptz, p_pay int,
  p_lat numeric, p_lng numeric, p_state text,
  p_status text default 'open', p_tournament uuid default null, p_mode text default null
) returns void language sql as $$
  insert into public.jobs (id, hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at, duration_minutes,
                           venue_name, venue_city, venue_state, venue_lat, venue_lng, timezone,
                           job_type, status, num_games, tournament_id, assignor_staffing_mode)
  select ('98300000-0000-4000-8000-' || p_id)::uuid, h.id, 'basketball', p_title, 'high_school', 2, p_pay, p_starts, 60,
         'Alert Gym', 'Somewhere', p_state, p_lat, p_lng, 'America/Chicago',
         'single', p_status, 1, p_tournament, p_mode
  from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101'
$$;

-- Who would be alerted about a game, as first names.
create function pg_temp.who(p_id text) returns text language sql as $$
  select coalesce(string_agg(p.first_name, ',' order by p.first_name), '')
  from public.matching_referees_for_job(('98300000-0000-4000-8000-' || p_id)::uuid) m
  join public.public_profiles p on p.id = m.user_id
$$;

-- Austin 30.2672,-97.7431 · San Antonio 29.4241,-98.4936 · Houston 29.7604,-95.3698 · Denver 39.7392,-104.9903
select pg_temp.mk_job('000000000001', 'Austin Tue $100',  pg_temp.next_local(2, 18), 100, 30.2672, -97.7431, 'TX');
select pg_temp.mk_job('000000000002', 'Austin Tue $50',   pg_temp.next_local(2, 18),  50, 30.2672, -97.7431, 'TX');
select pg_temp.mk_job('000000000003', 'Austin Sat $100',  pg_temp.next_local(6, 18), 100, 30.2672, -97.7431, 'TX');
select pg_temp.mk_job('000000000004', 'SA Sun $130',      pg_temp.next_local(0, 18), 130, 29.4241, -98.4936, 'TX');
select pg_temp.mk_job('000000000005', 'Houston Sat $200', pg_temp.next_local(6, 18), 200, 29.7604, -95.3698, 'TX');
select pg_temp.mk_job('000000000006', 'Austin Tue $100 (Alex has this)', pg_temp.next_local(2, 18), 100, 30.2672, -97.7431, 'TX');
select pg_temp.mk_job('000000000007', 'Austin Wed $100',  pg_temp.next_local(3, 18), 100, 30.2672, -97.7431, 'TX');
select pg_temp.mk_job('000000000008', 'Denver Tue $100',  pg_temp.next_local(2, 18), 100, 39.7392, -104.9903, 'CO');

-- ── Who is alerted: distance, day, rate ─────────────────────────────────────
select is(pg_temp.who('000000000001'), 'Alex',   'an Austin weekday game at $100 reaches Alex, who is in range, free that day, and above his $75 floor');
select is(pg_temp.who('000000000002'), '',       'a game paying less than a referee''s minimum rate reaches no one');
select is(pg_temp.who('000000000003'), '',       'a Saturday game does not reach Alex, who works weekdays; Marcus is too far away');
select is(pg_temp.who('000000000004'), 'Devon',  'a San Antonio Sunday game reaches Devon, who is local and works any day');
select is(pg_temp.who('000000000005'), 'Marcus', 'a Houston Saturday game at $200 reaches Marcus, who works weekends and clears his $120 floor');
select is(pg_temp.who('000000000008'), 'Sam',    'a referee with no preferences row is held to the defaults, so Sam hears about a game in Denver');

-- ── Who is not: clashes, answers already given ──────────────────────────────
insert into public.job_assignments (job_id, ref_id, status)
values ('98300000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111100', 'accepted');

select is(pg_temp.who('000000000001'), '',
  'a game that overlaps one Alex has confirmed no longer reaches him');
select is(pg_temp.who('000000000006'), '',
  'and neither does the game he is already on');
select is(pg_temp.who('000000000007'), 'Alex',
  'a game the next day, with no overlap, still does');

insert into public.job_assignments (job_id, ref_id, status)
values ('98300000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111100', 'declined');
select is(pg_temp.who('000000000007'), '',
  'a game a referee has already declined is not offered again');

-- ── Who is eligible at all ──────────────────────────────────────────────────
select pg_temp.mk_job('000000000011', 'Austin Thu $100', pg_temp.next_local(4, 18), 100, 30.2672, -97.7431, 'TX');
select is(pg_temp.who('000000000011'), 'Alex', 'baseline: an Austin Thursday game reaches Alex');

update public.private_profiles set suspended_at = now() where id = '11111111-1111-4111-8111-111111111100';
select is(pg_temp.who('000000000011'), '', 'a suspended referee is not alerted');
update public.private_profiles set suspended_at = null where id = '11111111-1111-4111-8111-111111111100';

update public.private_profiles set identity_status = 'in_review' where id = '11111111-1111-4111-8111-111111111100';
select is(pg_temp.who('000000000011'), '', 'a referee whose ID is not approved is not alerted');
update public.private_profiles set identity_status = 'approved' where id = '11111111-1111-4111-8111-111111111100';

select pg_temp.mk_job('000000000012', 'Austin yesterday', now() - interval '1 day', 100, 30.2672, -97.7431, 'TX');
select pg_temp.mk_job('000000000013', 'Austin cancelled', pg_temp.next_local(4, 18), 100, 30.2672, -97.7431, 'TX', 'cancelled');
select is(pg_temp.who('000000000012'), '', 'a game that has already started is not announced');
select is(pg_temp.who('000000000013'), '', 'a cancelled game is not announced');

-- No home coordinates: fall back to the same state, as the feed does.
update public.private_profiles set home_lat = null, home_lng = null where id = '11111111-1111-4111-8111-111111111100';
select pg_temp.mk_job('000000000014', 'San Antonio Tue $100', pg_temp.next_local(2, 20), 100, 29.4241, -98.4936, 'TX');
select pg_temp.mk_job('000000000015', 'Denver Tue late $100', pg_temp.next_local(2, 22), 100, 39.7392, -104.9903, 'CO');
select is(pg_temp.who('000000000014'), 'Alex,Devon',
  'with no home pin, Alex is matched by state, so a game two hours away in his state still reaches him');
select is(pg_temp.who('000000000015'), 'Sam',
  'and a game in another state does not');
update public.private_profiles set home_lat = 30.2672, home_lng = -97.7431 where id = '11111111-1111-4111-8111-111111111100';

-- ── Alerts the referee turned off ───────────────────────────────────────────
insert into public.notification_preferences (user_id, new_games) values ('11111111-1111-4111-8111-111111111100', false);
select is(pg_temp.who('000000000011'), '', 'turning new-game alerts off silences them');
update public.notification_preferences set new_games = true, crew_messages = false, game_updates = false
where user_id = '11111111-1111-4111-8111-111111111100';
select is(pg_temp.who('000000000011'), 'Alex', 'turning off crew messages and game updates leaves new-game alerts alone');

-- ── Roster-only games ───────────────────────────────────────────────────────
insert into public.tournaments (id, hirer_id, name, sport_id, starts_on, ends_on, venue_city, venue_state, status, assignor_id, assignor_status)
select '98300000-0000-4000-8000-0000000000d1'::uuid, h.id, 'Assignor Cup', 'basketball', current_date + 30, current_date + 31,
       'Austin', 'TX', 'open', '22222222-2222-4222-8222-222222222202', 'accepted'
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101';
select pg_temp.mk_job('000000000021', 'Assignor game', pg_temp.next_local(5, 18), 100, 30.2672, -97.7431, 'TX',
                       'open', '98300000-0000-4000-8000-0000000000d1', 'self_assign');

select is(pg_temp.who('000000000021'), '', 'a game an assignor runs is not announced to referees outside the assignor''s roster');
insert into public.assignor_rosters (assignor_id, ref_id, status)
values ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111100', 'accepted');
select is(pg_temp.who('000000000021'), 'Alex', 'a rostered referee hears about it when the roster can claim games');
update public.jobs set assignor_staffing_mode = 'assignor_direct' where id = '98300000-0000-4000-8000-000000000021';
select is(pg_temp.who('000000000021'), '', 'when the assignor places referees personally, nothing is broadcast');

-- ── One alert per game per referee ──────────────────────────────────────────
select pg_temp.mk_job('000000000031', 'Austin Fri $100', pg_temp.next_local(5, 12), 100, 30.2672, -97.7431, 'TX');
select is(
  (select count(*)::int from public.claim_new_game_alerts('98300000-0000-4000-8000-000000000031')),
  1, 'claiming a game''s alerts returns who to notify');
select is(
  (select count(*)::int from public.claim_new_game_alerts('98300000-0000-4000-8000-000000000031')),
  0, 'claiming it again returns no one, so a repeated request cannot notify twice');

-- ── Who may trigger alerts for a game ───────────────────────────────────────
select ok(public.can_alert_for_job('11111111-1111-4111-8111-111111111101', '98300000-0000-4000-8000-000000000031'),
  'the director who posted a game can announce it');
select ok(not public.can_alert_for_job('11111111-1111-4111-8111-111111111100', '98300000-0000-4000-8000-000000000031'),
  'a referee cannot announce someone else''s game');
select ok(public.can_alert_for_job('22222222-2222-4222-8222-222222222202', '98300000-0000-4000-8000-000000000021'),
  'the assignor running an event can announce its games');

-- ── Preferences: absent means on; kinds are checked ─────────────────────────
select is(
  (select count(*)::int from public.notification_enabled_user_ids(
     array['11111111-1111-4111-8111-111111111100','22222222-2222-4222-8222-222222222202']::uuid[], 'crew_messages')),
  1, 'crew messages skip a referee who turned them off, and still reach one with no preferences row');
select is(
  (select count(*)::int from public.notification_enabled_user_ids(
     array['11111111-1111-4111-8111-111111111100']::uuid[], 'new_games')),
  1, 'new-game alerts reach a referee who left them on');
select throws_ok(
  $$ select * from public.notification_enabled_user_ids(array['11111111-1111-4111-8111-111111111100']::uuid[], 'marketing') $$,
  '22023', null, 'an unknown kind of notification is refused');

-- ── The backend functions are closed to the apps ────────────────────────────
select is(
  (select count(*)::int from (values
     ('public.matching_referees_for_job(uuid)'), ('public.claim_new_game_alerts(uuid)'),
     ('public.can_alert_for_job(uuid,uuid)'), ('public.notification_enabled_user_ids(uuid[],text)')) f(sig)
   where has_function_privilege('authenticated', f.sig::regprocedure, 'execute')
      or has_function_privilege('anon', f.sig::regprocedure, 'execute')),
  0, 'no app role can run the alert functions directly');
select is(
  (select count(*)::int from (values
     ('public.matching_referees_for_job(uuid)'), ('public.claim_new_game_alerts(uuid)'),
     ('public.can_alert_for_job(uuid,uuid)'), ('public.notification_enabled_user_ids(uuid[],text)')) f(sig)
   where has_function_privilege('service_role', f.sig::regprocedure, 'execute')),
  4, 'the backend can');

-- ── Preferences belong to their owner ───────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222202', true);

select lives_ok(
  $$ insert into public.notification_preferences (user_id, game_updates) values ('22222222-2222-4222-8222-222222222202', false)
     on conflict (user_id) do update set game_updates = excluded.game_updates $$,
  'a person can save their own preferences');
select is(
  (select game_updates from public.notification_preferences where user_id = '22222222-2222-4222-8222-222222222202'),
  false, 'and read them back');
select is(
  (select count(*)::int from public.notification_preferences where user_id <> '22222222-2222-4222-8222-222222222202'),
  0, 'but cannot see anyone else''s');
select throws_ok(
  $$ insert into public.notification_preferences (user_id, new_games) values ('11111111-1111-4111-8111-111111111100', false) $$,
  '42501', null, 'or write for anyone else');

set local role anon;
select throws_ok($$ select * from public.notification_preferences $$, '42501', null, 'signed-out visitors get nothing');
reset role;

select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'notification_preferences'
     and column_name in ('user_id', 'new_games', 'crew_messages', 'game_updates')),
  4, 'the three kinds the apps expose are new games, crew messages and game updates');

select * from finish();
rollback;
