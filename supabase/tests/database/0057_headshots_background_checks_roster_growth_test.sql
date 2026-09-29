begin;

create extension if not exists pgtap with schema extensions;

select plan(38);

-- Stable local seed identities:
--   111...101  assignor + director
--   111...100  referee
--   222...200  referee
--   222...201  referee
--   222...203  director (made a second assignor below)

insert into public.user_roles (user_id, role)
values
  ('11111111-1111-4111-8111-111111111101'::uuid, 'assignor'),
  ('22222222-2222-4222-8222-222222222203'::uuid, 'assignor')
on conflict do nothing;

update auth.users
set email = 'known.ref@example.com', email_confirmed_at = now()
where id = '22222222-2222-4222-8222-222222222200'::uuid;

update auth.users
set email = 'late.ref@example.com', email_confirmed_at = now()
where id = '22222222-2222-4222-8222-222222222201'::uuid;

insert into public.tournaments (
  id, hirer_id, name, sport_id, starts_on, ends_on, venue_city, venue_state,
  staffing_model, assignor_id, assignor_status, status
)
select
  '90000000-0000-4000-8000-000000000201'::uuid, h.id, 'Growth Test Tournament',
  'basketball', current_date + 30, current_date + 31, 'Austin', 'TX',
  'assignor_managed', '11111111-1111-4111-8111-111111111101'::uuid, 'accepted', 'open'
from public.hirers h
where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

insert into public.jobs (
  id, hirer_id, sport_id, title, level, starts_at, duration_minutes, venue_name,
  venue_city, venue_state, pay_per_game, crew_size, status, tournament_id,
  assignor_staffing_mode
)
select
  '90000000-0000-4000-8000-000000000202'::uuid, h.id, 'basketball', 'Growth Game',
  'high_school', now() + interval '30 days', 90, 'Growth Gym', 'Austin', 'TX',
  100, 2, 'open', '90000000-0000-4000-8000-000000000201'::uuid, 'self_assign'
from public.hirers h
where h.user_id = '11111111-1111-4111-8111-111111111101'::uuid;

-- 1. Headshot required at sign-up -------------------------------------------

insert into auth.users (id, aud, role, email, phone)
values ('33333333-3333-4333-8333-333333333300'::uuid, 'authenticated', 'authenticated', null, '+15555550199');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333300', true);

select throws_ok(
  $$
    insert into public.public_profiles (id, first_name, last_initial, city, state)
    values ('33333333-3333-4333-8333-333333333300'::uuid, 'New', 'P', 'Austin', 'TX')
  $$,
  '23514',
  'Upload a headshot to finish signing up.',
  'a profile cannot be created without a headshot'
);

select throws_ok(
  $$
    insert into public.public_profiles (id, first_name, last_initial, city, state, avatar_url)
    values ('33333333-3333-4333-8333-333333333300'::uuid, 'New', 'P', 'Austin', 'TX', '   ')
  $$,
  '23514',
  'Upload a headshot to finish signing up.',
  'a blank headshot url does not count'
);

select lives_ok(
  $$
    insert into public.public_profiles (id, first_name, last_initial, city, state, avatar_url)
    values (
      '33333333-3333-4333-8333-333333333300'::uuid, 'New', 'P', 'Austin', 'TX',
      'https://example.com/avatars/33333333/avatar.jpg'
    )
  $$,
  'a profile with a headshot is created'
);

-- Editing an existing profile (an upsert) must not demand a new photo, e.g. a
-- second role or the edit-profile screen.
select lives_ok(
  $$
    insert into public.public_profiles (id, first_name, last_initial, city, state)
    values ('33333333-3333-4333-8333-333333333300'::uuid, 'New', 'P', 'Dallas', 'TX')
    on conflict (id) do update set city = excluded.city
  $$,
  'upserting an existing profile does not require a headshot again'
);

-- 2. Background checks last one year ----------------------------------------

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111100', true);

select lives_ok(
  $$
    insert into public.background_check_documents (user_id, file_path, file_name, expires_at)
    values (
      '11111111-1111-4111-8111-111111111100'::uuid,
      '11111111-1111-4111-8111-111111111100/check.pdf', 'check.pdf',
      now() + interval '10 years'
    )
  $$,
  'a referee can upload their own background check'
);

select ok(
  (select expires_at from public.background_check_documents
    where user_id = '11111111-1111-4111-8111-111111111100'::uuid)
    between now() + interval '364 days' and now() + interval '366 days',
  'the expiry is one year out no matter what the client sent'
);

select throws_ok(
  $$
    insert into public.background_check_documents (user_id, file_path)
    values (
      '22222222-2222-4222-8222-222222222200'::uuid,
      '22222222-2222-4222-8222-222222222200/check.pdf'
    )
  $$,
  '42501',
  null,
  'nobody can upload a background check for someone else'
);

select throws_ok(
  $$
    insert into public.background_check_documents (user_id, file_path)
    values (
      '11111111-1111-4111-8111-111111111100'::uuid,
      '22222222-2222-4222-8222-222222222200/other.pdf'
    )
  $$,
  '42501',
  null,
  'the file must live in the uploader''s own folder'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);

select is_empty(
  $$select 1 from public.background_check_documents
     where user_id = '11111111-1111-4111-8111-111111111100'::uuid$$,
  'another referee cannot read the document row'
);

select results_eq(
  $$select is_valid from public.background_check_status
     where user_id = '11111111-1111-4111-8111-111111111100'::uuid$$,
  array[true],
  'anyone signed in can see that the check is current'
);

reset role;
update public.background_check_documents
set expires_at = now() - interval '1 day'
where user_id = '11111111-1111-4111-8111-111111111100'::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);

select results_eq(
  $$select is_valid from public.background_check_status
     where user_id = '11111111-1111-4111-8111-111111111100'::uuid$$,
  array[false],
  'an expired check reads as not valid'
);

select is(
  (select count(*)::int from public.background_check_status
    where user_id = '22222222-2222-4222-8222-222222222200'::uuid),
  0,
  'someone with no upload has no status row'
);

-- 3. Email invites -----------------------------------------------------------

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111100', true);

select throws_ok(
  $$select public.invite_to_roster_by_email(array['a@example.com'])$$,
  'P0001',
  'Assignor role required',
  'a plain referee cannot send email invites'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select results_eq(
  $$
    select r->>'result'
    from jsonb_array_elements(
      public.invite_to_roster_by_email(array[
        'Known.Ref@Example.com', 'new.person@example.com', 'not-an-email',
        'new.person@example.com', 'late.ref@example.com'
      ])
    ) as r
  $$,
  array['invited', 'pending', 'invalid', 'invited'],
  'existing referees are invited, unknown emails pending, junk rejected, duplicates dropped'
);

select results_eq(
  $$select status from public.assignor_rosters
     where assignor_id = '11111111-1111-4111-8111-111111111101'::uuid
       and ref_id = '22222222-2222-4222-8222-222222222200'::uuid$$,
  array['invited'::text],
  'an existing referee gets a normal pending roster invite'
);

select is(
  (select count(*)::int from public.roster_email_invites
    where assignor_id = '11111111-1111-4111-8111-111111111101'::uuid and status = 'pending'),
  1,
  'only the unknown address is stored as a pending email invite'
);

select throws_ok(
  $$select public.invite_to_roster_by_email(array[]::text[])$$,
  'P0001',
  'Add at least one email',
  'an empty list is refused'
);

reset role;
insert into auth.users (id, aud, role, email, email_confirmed_at, phone)
values (
  '33333333-3333-4333-8333-333333333301'::uuid, 'authenticated', 'authenticated',
  'new.person@example.com', now(), '+15555550198'
);
insert into public.public_profiles (id, first_name, last_initial, city, state, primary_role, avatar_url)
values ('33333333-3333-4333-8333-333333333301'::uuid, 'Late', 'J', 'Austin', 'TX', 'referee', 'https://example.com/a.jpg');
insert into public.user_roles (user_id, role)
values ('33333333-3333-4333-8333-333333333301'::uuid, 'referee');
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333301', true);

select is(
  public.claim_roster_invites(), 1,
  'signing in with the invited email turns the pending invite into a roster invite'
);

select results_eq(
  $$select status from public.assignor_rosters
     where assignor_id = '11111111-1111-4111-8111-111111111101'::uuid
       and ref_id = '33333333-3333-4333-8333-333333333301'::uuid$$,
  array['invited'::text],
  'the claimed invite waits for the referee to accept'
);

select is(public.claim_roster_invites(), 0, 'claiming twice does nothing');

-- 4. QR / code, multiple rosters, leaving -----------------------------------

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select ok(
  length(public.my_roster_invite_code()) = 8,
  'an assignor gets an 8-character join code'
);

select is(
  public.my_roster_invite_code(), public.my_roster_invite_code(),
  'the code is stable until rotated'
);

create temp table first_code as select public.my_roster_invite_code() as code;
grant all on first_code to authenticated;

select isnt(
  public.rotate_roster_invite_code(), (select code from first_code),
  'rotating the code replaces it'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);

select throws_ok(
  $$select public.join_roster_by_code((select code from first_code))$$,
  'P0001',
  'That invite code is not valid',
  'an old code stops working after rotation'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
create temp table live_code as select public.my_roster_invite_code() as code;
grant all on live_code to authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);

select results_eq(
  $$select display_name from public.preview_roster_invite_code((select lower(code) from live_code))$$,
  $$select display_name from public.public_profiles
     where id = '11111111-1111-4111-8111-111111111101'::uuid$$,
  'a code can be previewed (case-insensitively) before joining'
);

select ok(
  public.join_roster_by_code((select code from live_code)) is not null,
  'a referee joins a roster by scanning the code'
);

select results_eq(
  $$select status from public.assignor_rosters
     where assignor_id = '11111111-1111-4111-8111-111111111101'::uuid
       and ref_id = '22222222-2222-4222-8222-222222222201'::uuid$$,
  array['accepted'::text],
  'joining by code puts the referee on the roster straight away'
);

reset role;
insert into public.assignor_invite_codes (assignor_id, code)
values ('22222222-2222-4222-8222-222222222203'::uuid, 'TESTCODE');
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);
select public.join_roster_by_code('TESTCODE');

select is(
  (select count(*)::int from public.assignor_rosters
    where ref_id = '22222222-2222-4222-8222-222222222201'::uuid and status = 'accepted'),
  2,
  'a referee can be on several rosters at once'
);

select throws_ok(
  $$select public.join_roster_by_code('NOPE1234')$$,
  'P0001',
  'That invite code is not valid',
  'an unknown code is refused'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222203', true);

select throws_ok(
  $$select public.join_roster_by_code('TESTCODE')$$,
  'P0001',
  'Only referees can join a roster',
  'an assignor with no referee role cannot join'
);

-- 5. Roster blast: one-way ---------------------------------------------------

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select is(
  jsonb_array_length(public.post_roster_blast('Gym change: Court 2 tonight.')->'recipient_ids'),
  1,
  'a blast goes to the accepted roster only'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);

select is(
  (select count(*)::int from public.messages m
     join public.conversations c on c.id = m.conversation_id
    where c.kind = 'roster_blast'),
  1,
  'a roster referee can read the blast'
);

select throws_ok(
  $$
    insert into public.messages (conversation_id, sender_id, body)
    select id, '22222222-2222-4222-8222-222222222201'::uuid, 'reply'
    from public.conversations where kind = 'roster_blast'
  $$,
  '42501',
  null,
  'a referee cannot reply to a blast'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111100', true);

select is(
  (select count(*)::int from public.messages m
     join public.conversations c on c.id = m.conversation_id
    where c.kind = 'roster_blast'),
  0,
  'a referee who is not on the roster cannot read it'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);
select public.leave_roster(
  (select id from public.assignor_rosters
    where assignor_id = '11111111-1111-4111-8111-111111111101'::uuid
      and ref_id = '22222222-2222-4222-8222-222222222201'::uuid)
);

select is(
  (select count(*)::int from public.messages m
     join public.conversations c on c.id = m.conversation_id
    where c.kind = 'roster_blast'),
  0,
  'after leaving a roster its blasts are no longer readable'
);

-- 6. The assignor can message a game's crew ---------------------------------

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222203', true);

select throws_ok(
  $$select public.post_crew_note('90000000-0000-4000-8000-000000000202'::uuid, 'hi')$$,
  'P0001',
  'Not your game',
  'an unrelated assignor cannot post to a game''s crew'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select ok(
  public.post_crew_note('90000000-0000-4000-8000-000000000202'::uuid, 'Warm-ups at 6.') is not null,
  'the tournament''s assignor can post a note to a game''s crew'
);

select is(
  json_array_length((public.get_crew_thread('90000000-0000-4000-8000-000000000202'::uuid))->'messages'),
  1,
  'and read it back with receipts'
);

select * from finish();
rollback;
