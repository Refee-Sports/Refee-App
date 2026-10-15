begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

-- Names and photos once an ID is verified (0068).
--
--   * The last initial everyone sees comes from the legal last name.
--   * After verification a person can still change their name (an ID that
--     scanned badly, a nickname, a marriage), but only once every 60 days;
--     edits within an hour of each other count as one change. Each change is
--     logged for admins.
--   * The birthday stays locked; the photo can only change through the
--     face-matched set-headshot function, not the app.
--
-- Seed: Alex 111…100 (verified, Alex Rivera), Jordan 111…101 (director),
--       Sam 222…200 (made unverified here).

update public.private_profiles
   set identity_status = 'unstarted', legal_first_name = 'Sam', legal_last_name = 'Okafor'
 where id = '22222222-2222-4222-8222-222222222200';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- ── Before verification ─────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
update public.public_profiles set last_initial = 'Z' where id = '22222222-2222-4222-8222-222222222200';
select is((select last_initial from public.public_profiles where id = '22222222-2222-4222-8222-222222222200'),
  'O', 'the last initial always comes from the legal last name, whatever the app sends');

update public.public_profiles set first_name = 'Sammy' where id = '22222222-2222-4222-8222-222222222200';
update public.public_profiles set first_name = 'Samuel' where id = '22222222-2222-4222-8222-222222222200';
select is((select first_name from public.public_profiles where id = '22222222-2222-4222-8222-222222222200'),
  'Samuel', 'before verification, the first name can change as often as needed');

select lives_ok(
  $$update public.public_profiles set avatar_url = 'https://example.com/sam.jpg' where id = '22222222-2222-4222-8222-222222222200'$$,
  'before verification, the app can set the photo');

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner) values ('avatars', '22222222-2222-4222-8222-222222222200/avatar.jpg', '22222222-2222-4222-8222-222222222200')$$,
  'and upload it straight to the avatar file');

-- ── After verification ──────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111100', true);

select lives_ok(
  $$update public.public_profiles set first_name = 'Alexander' where id = '11111111-1111-4111-8111-111111111100'$$,
  'a verified referee can change their first name');
select lives_ok(
  $$update public.private_profiles set legal_first_name = 'Alexander' where id = '11111111-1111-4111-8111-111111111100'$$,
  'and fix their legal name in the same sitting');

reset role;
select is((select count(*)::int from public.name_changes where user_id = '11111111-1111-4111-8111-111111111100'),
  2, 'both edits are logged for admins');
select ok((select name_changed_at > now() - interval '1 minute' from public.private_profiles where id = '11111111-1111-4111-8111-111111111100'),
  'and the change is dated');

-- Two hours later the sitting is over: the next change waits 60 days.
update public.private_profiles set name_changed_at = now() - interval '2 hours' where id = '11111111-1111-4111-8111-111111111100';
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111100', true);
select throws_like(
  $$update public.public_profiles set first_name = 'Al' where id = '11111111-1111-4111-8111-111111111100'$$,
  'You can change your name again on %',
  'a second name change soon after is refused');
select throws_like(
  $$update public.private_profiles set legal_last_name = 'Smith' where id = '11111111-1111-4111-8111-111111111100'$$,
  'You can change your name again on %',
  'for the legal name too');

reset role;
update public.private_profiles set name_changed_at = now() - interval '61 days' where id = '11111111-1111-4111-8111-111111111100';
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111100', true);
select lives_ok(
  $$update public.private_profiles set legal_last_name = 'Delgado' where id = '11111111-1111-4111-8111-111111111100'$$,
  'after 60 days, the name can change again');
select is((select last_initial from public.public_profiles where id = '11111111-1111-4111-8111-111111111100'),
  'D', 'and a new legal last name moves the public initial with it');

select throws_ok(
  $$update public.private_profiles set date_of_birth = '1980-01-01' where id = '11111111-1111-4111-8111-111111111100'$$,
  '42501', null, 'the date of birth stays locked after verification');

select throws_ok(
  $$update public.public_profiles set avatar_url = 'https://example.com/someone-else.jpg' where id = '11111111-1111-4111-8111-111111111100'$$,
  '42501', null, 'a verified person can''t swap their photo from the app');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner) values ('avatars', '11111111-1111-4111-8111-111111111100/avatar.jpg', '11111111-1111-4111-8111-111111111100')$$,
  '42501', null, 'or overwrite the photo file directly');
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner) values ('avatars', '11111111-1111-4111-8111-111111111100/pending.jpg', '11111111-1111-4111-8111-111111111100')$$,
  'they upload a candidate photo for the face match instead');

select throws_ok($$select count(*) from public.name_changes$$, '42501', null, 'people can''t read the name-change log');

-- ── Directors: the organization's contact name follows the profile ──────────
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
update public.hirers set contact_first_name = 'Someone', contact_last_initial = 'Q'
 where user_id = '11111111-1111-4111-8111-111111111101';
select is((select contact_first_name || ' ' || contact_last_initial from public.hirers where user_id = '11111111-1111-4111-8111-111111111101'),
  (select first_name || ' ' || last_initial from public.public_profiles where id = '11111111-1111-4111-8111-111111111101'),
  'an organization''s contact name can''t drift from the director''s own name');

reset role;
update public.private_profiles set identity_status = 'unstarted' where id = '11111111-1111-4111-8111-111111111101';
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
update public.public_profiles set first_name = 'Jo' where id = '11111111-1111-4111-8111-111111111101';
select is((select contact_first_name from public.hirers where user_id = '11111111-1111-4111-8111-111111111101'),
  'Jo', 'renaming the director renames the organization''s contact');

-- In review: Didit is checking against these right now.
reset role;
update public.private_profiles set identity_status = 'in_review' where id = '22222222-2222-4222-8222-222222222200';
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select throws_ok(
  $$update public.private_profiles set legal_last_name = 'Other' where id = '22222222-2222-4222-8222-222222222200'$$,
  '42501', null, 'while the ID is in review, the legal name is locked');

select * from finish();
rollback;
