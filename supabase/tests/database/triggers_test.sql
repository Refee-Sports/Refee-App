begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

-- Director D's game with ref A confirmed and ref B already completed.
insert into public.jobs (id, hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at,
                         venue_name, venue_address, venue_zip, venue_city, venue_state, job_type, status, num_games)
select v.id::uuid, h.id, 'basketball', v.title, 'high_school', 2, 70, now() + interval '5 days',
       'Trigger Gym', '1 South Ave', '11530', 'Garden City', 'NY', 'single', 'open', 1
from public.hirers h,
     (values ('98200000-0000-4000-8000-0000000000a1', 'Trigger Game'),
             ('98200000-0000-4000-8000-0000000000a2', 'Second Trigger Game')) as v(id, title)
where h.user_id = '11111111-1111-4111-8111-111111111101';
insert into public.job_assignments (job_id, ref_id, status, responded_at) values
  ('98200000-0000-4000-8000-0000000000a1', '22222222-2222-4222-8222-222222222200', 'accepted', now()),
  ('98200000-0000-4000-8000-0000000000a1', '22222222-2222-4222-8222-222222222201', 'completed', now());

create temporary view a_status as
  select status || '/' || coalesce(responded_at::text, 'null') as s from public.job_assignments
  where job_id = '98200000-0000-4000-8000-0000000000a1' and ref_id = '22222222-2222-4222-8222-222222222200';

-- ── Refs reconfirm when what they agreed to changes ────────────────────────
update public.jobs set hirer_note = 'Bring a whistle' where id = '98200000-0000-4000-8000-0000000000a1';
select is((select left(s, 8) from a_status), 'accepted', 'a note change does not ask refs to reconfirm');

update public.jobs set pay_per_game = 80 where id = '98200000-0000-4000-8000-0000000000a1';
select is((select s from a_status), 'needs_reconfirm/null', 'a pay change asks confirmed refs to reconfirm');
select is(
  (select status from public.job_assignments where job_id = '98200000-0000-4000-8000-0000000000a1'
     and ref_id = '22222222-2222-4222-8222-222222222201'),
  'completed', 'refs who already worked the game are left alone');

update public.job_assignments set status = 'accepted', responded_at = now()
where job_id = '98200000-0000-4000-8000-0000000000a1' and ref_id = '22222222-2222-4222-8222-222222222200';
update public.jobs set starts_at = starts_at + interval '1 hour' where id = '98200000-0000-4000-8000-0000000000a1';
select is((select left(s, 15) from a_status), 'needs_reconfirm', 'a time change asks refs to reconfirm');

update public.job_assignments set status = 'accepted', responded_at = now()
where job_id = '98200000-0000-4000-8000-0000000000a1' and ref_id = '22222222-2222-4222-8222-222222222200';
update public.jobs set venue_address = '2 North Ave' where id = '98200000-0000-4000-8000-0000000000a1';
select is((select left(s, 15) from a_status), 'needs_reconfirm', 'a new street address asks refs to reconfirm');

update public.job_assignments set status = 'accepted', responded_at = now()
where job_id = '98200000-0000-4000-8000-0000000000a1' and ref_id = '22222222-2222-4222-8222-222222222200';
update public.jobs set venue_zip = '11501' where id = '98200000-0000-4000-8000-0000000000a1';
select is((select left(s, 15) from a_status), 'needs_reconfirm', 'so does a new ZIP');

-- ── Ratings roll up to the ref's profile ───────────────────────────────────
insert into public.ratings (job_id, ref_id, hirer_id, on_time, professionalism, game_management)
select '98200000-0000-4000-8000-0000000000a1', '22222222-2222-4222-8222-222222222202', h.id, 4, 4, 5
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101';
select is(
  (select rating from public.ratings where job_id = '98200000-0000-4000-8000-0000000000a1'
     and ref_id = '22222222-2222-4222-8222-222222222202'),
  4, 'the overall score is the rounded average of the three parts (4.33 → 4)');

insert into public.ratings (job_id, ref_id, hirer_id, on_time, professionalism, game_management)
select '98200000-0000-4000-8000-0000000000a2', '22222222-2222-4222-8222-222222222202', h.id, 5, 5, 5
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101';
select is(
  (select rating_count from public.public_profiles where id = '22222222-2222-4222-8222-222222222202'),
  (select count(*)::int from public.ratings where ref_id = '22222222-2222-4222-8222-222222222202'),
  'the profile counts every rating');
select is(
  (select rating from public.public_profiles where id = '22222222-2222-4222-8222-222222222202'),
  (select avg(rating)::numeric(3,2) from public.ratings where ref_id = '22222222-2222-4222-8222-222222222202'),
  'and shows their average');

insert into public.ratings (job_id, ref_id, hirer_id, rating)
select '98200000-0000-4000-8000-0000000000a2', '22222222-2222-4222-8222-222222222201', h.id, 3
from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101';
select is(
  (select rating from public.ratings where job_id = '98200000-0000-4000-8000-0000000000a2'
     and ref_id = '22222222-2222-4222-8222-222222222201'),
  3, 'a single overall score without parts is kept as given');
select ok(
  (select rating_count >= 1 from public.public_profiles where id = '22222222-2222-4222-8222-222222222201'),
  'and counted on that ref''s profile');

-- ── A new message moves its conversation to the top ────────────────────────
insert into public.conversations (id, kind, created_by)
values ('98200000-0000-4000-8000-0000000000c1', 'dm', '11111111-1111-4111-8111-111111111101');
insert into public.messages (conversation_id, sender_id, body)
values ('98200000-0000-4000-8000-0000000000c1', '11111111-1111-4111-8111-111111111101', 'See you Saturday');
select is(
  (select last_message_at from public.conversations where id = '98200000-0000-4000-8000-0000000000c1'),
  (select max(created_at) from public.messages where conversation_id = '98200000-0000-4000-8000-0000000000c1'),
  'a new message sets the conversation''s last-message time');

select * from finish();
rollback;
