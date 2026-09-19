begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

-- Referee 222...202 is seeded with an adult date of birth.
-- Director 111...101 owns the fixture game.

insert into public.jobs (
  id, hirer_id, sport_id, title, home_team, away_team, level,
  starts_at, duration_minutes, venue_name, venue_address, venue_zip, venue_city, venue_state,
  game_format, period_minutes, ruleset, uniform_requirements,
  pay_per_game, crew_size, job_type, status, num_games
)
select
  '99000000-0000-4000-8000-0000000000a1'::uuid, h.id, 'basketball', 'Age A vs Age B',
  'Age A', 'Age B', 'high_school',
  now() + interval '30 days', 90, 'Age Gym', '1301 Shoal Creek Blvd', '78701', 'Austin', 'TX',
  'halves', 20, 'NFHS', 'Stripes', 90, 3, 'single', 'open', 1
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

-- ── The arithmetic ───────────────────────────────────────────────────────────

select ok(public.is_adult((current_date - interval '18 years')::date), 'eighteen today is old enough');
select ok(not public.is_adult((current_date - interval '18 years' + interval '1 day')::date),
  'a day short of eighteen is not');
select ok(not public.is_adult(null), 'and an unknown date of birth is not "old enough"');

-- ── Signing up ───────────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222202', true);

select throws_ok(
  $$ update public.private_profiles set date_of_birth = null
     where id = '22222222-2222-4222-8222-222222222202' $$,
  '23514', 'Enter your date of birth.',
  'an app write has to carry a date of birth'
);

select throws_ok(
  format(
    $$ update public.private_profiles set date_of_birth = '%s'
       where id = '22222222-2222-4222-8222-222222222202' $$,
    (current_date - interval '17 years')::date
  ),
  '23514', 'You must be 18 or older to use Refee.',
  'and someone under 18 cannot sign up'
);

select lives_ok(
  $$ update public.private_profiles set date_of_birth = '1990-06-15'
     where id = '22222222-2222-4222-8222-222222222202' $$,
  'an adult can'
);

reset role;

-- ── What Didit read off the ID ───────────────────────────────────────────────
-- The webhook must be able to record a minor's real date of birth in order to
-- decline them; the trigger only applies to the apps.

select lives_ok(
  format(
    $$ update public.private_profiles
       set date_of_birth = '%s', identity_status = 'approved', identity_verified_at = now()
       where id = '22222222-2222-4222-8222-222222222202' $$,
    (current_date - interval '16 years')::date
  ),
  'the backend can record a date of birth the apps would have refused'
);

select ok(
  not public.is_identity_verified('22222222-2222-4222-8222-222222222202'),
  'and an approved account with a minor''s date of birth is not verified'
);

-- The gate in 0042 closes with it.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222202', true);
select throws_ok(
  $$ select public.respond_to_job('99000000-0000-4000-8000-0000000000a1'::uuid, true) $$,
  '42501', 'Verify your ID before applying to games.',
  'so they cannot take a game, approved or not'
);
reset role;

-- ── Nobody is locked out retroactively ───────────────────────────────────────

update public.private_profiles
set date_of_birth = null, identity_status = 'approved'
where id = '22222222-2222-4222-8222-222222222202';
select ok(
  public.is_identity_verified('22222222-2222-4222-8222-222222222202'),
  'an account approved before this rule, with no date on file, still works'
);

update public.private_profiles
set date_of_birth = '1990-06-15', identity_status = 'approved'
where id = '22222222-2222-4222-8222-222222222202';
select ok(
  public.is_identity_verified('22222222-2222-4222-8222-222222222202'),
  'and a verified adult is verified'
);

select * from finish();
rollback;
