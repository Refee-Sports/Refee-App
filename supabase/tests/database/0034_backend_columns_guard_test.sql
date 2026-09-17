begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

-- Posting a game or tournament needs a verified identity (0042); this test is
-- about which columns the app may write, so its director is a verified person.
insert into public.private_profiles (id, identity_status, identity_verified_at)
values ('11111111-1111-4111-8111-111111111101'::uuid, 'approved', now())
on conflict (id) do update
  set identity_status = 'approved', identity_verified_at = now();

-- Director 111...101 (seeded hirer). A second organizer owns a tournament
-- the director must not be able to add games to.
insert into public.tournaments (id, hirer_id, name, sport_id, starts_on, ends_on, venue_city, venue_state, status,
                                venue_name, venue_address, venue_zip, ruleset, uniform_requirements, game_format,
                                period_minutes)
select '94000000-0000-4000-8000-000000000001'::uuid, h.id, 'Guard Test Cup', 'basketball',
       current_date + 20, current_date + 21, 'Austin', 'TX', 'open',
       'Guard Gym', '1301 Shoal Creek Blvd', '78701', 'NFHS', 'Stripes', 'quarters', 8
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

insert into public.jobs (id, hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at,
                         venue_name, venue_city, venue_state, job_type, status, num_games)
select '94000000-0000-4000-8000-0000000000a1'::uuid, h.id, 'basketball', 'Guard Game', 'high_school', 2, 70,
       now() + interval '10 days', 'Guard Gym', 'Austin', 'TX', 'single', 'open', 1
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

select set_config('guard.other_hirer', (
  select h.id::text from public.hirers h
  where h.user_id <> '11111111-1111-4111-8111-111111111101'::uuid limit 1), true);

insert into public.tournaments (id, hirer_id, name, sport_id, starts_on, ends_on, venue_city, venue_state, status)
select '94000000-0000-4000-8000-000000000002'::uuid, current_setting('guard.other_hirer')::uuid, 'Someone Else''s Cup',
       'basketball', current_date + 20, current_date + 21, 'Austin', 'TX', 'open'
where current_setting('guard.other_hirer', true) is not null
  and current_setting('guard.other_hirer', true) <> '';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

-- Games: details stay editable, backend fields don't.
select lives_ok(
  $$ update public.jobs set title = 'Guard Game (renamed)', auto_accept = true
     where id = '94000000-0000-4000-8000-0000000000a1' $$,
  'director can still edit game details'
);
select throws_ok(
  $$ update public.jobs set payment_status = 'paid' where id = '94000000-0000-4000-8000-0000000000a1' $$,
  '42501', 'Game status and payment fields are set by Refee, not the app.',
  'director cannot mark a game paid'
);
select throws_ok(
  $$ update public.jobs set prepay_required = false where id = '94000000-0000-4000-8000-0000000000a1' $$,
  '42501', 'Game status and payment fields are set by Refee, not the app.',
  'director cannot opt a game out of prepay'
);
select throws_ok(
  $$ update public.jobs set status = 'completed' where id = '94000000-0000-4000-8000-0000000000a1' $$,
  '42501', 'Game status and payment fields are set by Refee, not the app.',
  'director cannot complete a game without complete_game'
);
select throws_ok(
  $$ update public.jobs set payout_window_hours = 720 where id = '94000000-0000-4000-8000-0000000000a1' $$,
  '42501', 'Game status and payment fields are set by Refee, not the app.',
  'director cannot stretch the payout window'
);
select throws_ok(
  $$ delete from public.jobs where id = '94000000-0000-4000-8000-0000000000a1' $$,
  '42501', 'Games can''t be deleted. Cancel the game instead.',
  'director cannot delete a game'
);

-- A new game's backend fields start at their defaults whatever the client sends.
insert into public.jobs (id, hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at,
                         venue_name, venue_city, venue_state, job_type, num_games,
                         home_team, away_team, venue_address, venue_zip, game_format, period_minutes, ruleset,
                         uniform_requirements,
                         status, payment_status, prepay_required, prepaid_crew_cents, payout_window_hours)
select '94000000-0000-4000-8000-0000000000a2'::uuid, h.id, 'basketball', 'Guard Insert', 'high_school', 2, 70,
       now() + interval '12 days', 'Guard Gym', 'Austin', 'TX', 'single', 1,
       'Guard', 'Insert', '1301 Shoal Creek Blvd', '78701', 'quarters', 8, 'NFHS', 'Stripes',
       'completed', 'paid', false, 99999, 1
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

select is(
  (select row(status, payment_status, prepay_required, prepaid_crew_cents, payout_window_hours)::text
   from public.jobs where id = '94000000-0000-4000-8000-0000000000a2'),
  row('open', 'unpaid', true, 0, 48)::text,
  'a new game starts open, unpaid, prepay-required, whatever the client sent'
);

select throws_ok(
  $$ insert into public.jobs (hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at,
                              venue_name, venue_city, venue_state, job_type, num_games, tournament_id)
     select h.id, 'basketball', 'Sneaky', 'high_school', 2, 70, now() + interval '12 days',
            'Gym', 'Austin', 'TX', 'tournament', 1, '94000000-0000-4000-8000-000000000002'
     from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101' $$,
  '42501', 'That tournament belongs to another organizer.',
  'director cannot add a game to another organizer''s tournament'
);

-- Tournaments: details stay editable, the assignor agreement doesn't.
select lives_ok(
  $$ update public.tournaments set name = 'Guard Test Cup (renamed)', staffing_model = 'assignor_managed'
     where id = '94000000-0000-4000-8000-000000000001' $$,
  'director can still edit tournament details and staffing model'
);
select throws_ok(
  $$ update public.tournaments set assignor_status = 'accepted', assignor_id = '11111111-1111-4111-8111-111111111101'
     where id = '94000000-0000-4000-8000-000000000001' $$,
  '42501', 'Assignor agreements and fees are set by Refee, not the app.',
  'director cannot accept an assignor without their proposal'
);
select throws_ok(
  $$ update public.tournaments set platform_fee_pct = 0 where id = '94000000-0000-4000-8000-000000000001' $$,
  '42501', 'Assignor agreements and fees are set by Refee, not the app.',
  'director cannot change the platform fee'
);
select throws_ok(
  $$ delete from public.tournaments where id = '94000000-0000-4000-8000-000000000001' $$,
  '42501', 'Tournaments can''t be deleted. Cancel it instead.',
  'director cannot delete a tournament'
);

insert into public.tournaments (id, hirer_id, name, sport_id, starts_on, ends_on, venue_city, venue_state, status,
                                venue_name, venue_address, venue_zip, ruleset, uniform_requirements, game_format,
                                period_minutes,
                                assignor_id, assignor_status, assignor_fee, platform_fee_pct)
select '94000000-0000-4000-8000-000000000003'::uuid, h.id, 'Guard Insert Cup', 'basketball',
       current_date + 25, current_date + 26, 'Austin', 'TX', 'open',
       'Guard Gym', '1301 Shoal Creek Blvd', '78701', 'NFHS', 'Stripes', 'quarters', 8,
       '11111111-1111-4111-8111-111111111101', 'accepted', 1, 0
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

select is(
  (select row(assignor_id, assignor_status, assignor_fee, platform_fee_pct)::text
   from public.tournaments where id = '94000000-0000-4000-8000-000000000003'),
  row(null::uuid, null::text, null::numeric, 10.00::numeric)::text,
  'a new tournament starts with no assignor and the standard fee'
);

-- The backend (definer functions, service_role) still writes these columns.
reset role;
select lives_ok(
  $$ update public.jobs set payment_status = 'prepaid', prepaid_crew_cents = 14000
     where id = '94000000-0000-4000-8000-0000000000a1' $$,
  'the backend can record a booking charge'
);
set local role service_role;
select lives_ok(
  $$ update public.jobs set payment_status = 'paid' where id = '94000000-0000-4000-8000-0000000000a1' $$,
  'service_role (edge functions) can settle a game'
);
select lives_ok(
  $$ update public.tournaments set assignor_status = 'accepted' where id = '94000000-0000-4000-8000-000000000001' $$,
  'service_role can record an assignor agreement'
);
reset role;
select is(
  (select payment_status from public.jobs where id = '94000000-0000-4000-8000-0000000000a1'),
  'paid',
  'backend writes landed'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'trg_jobs_guard_backend_columns')
  and exists (select 1 from pg_trigger where tgname = 'trg_tournaments_guard_backend_columns'),
  'both guard triggers are installed'
);

select * from finish();
rollback;
