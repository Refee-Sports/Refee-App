begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

-- Crew messaging closes 24 hours after the game's scheduled end (0077). After
-- that the director can still post a crew note only while the game has a
-- payment issue. Seeded: refs …200 and …201, director …101.
insert into public.jobs (id, hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at, duration_minutes,
                         venue_name, venue_city, venue_state, job_type, status, num_games, payment_status,
                         completed_at, payout_window_hours)
select v.id::uuid, h.id, 'basketball', v.title, 'high_school', 2, 70, now() + v.starts_in, 90,
       'Chat Gym', 'Austin', 'TX', 'single', 'completed', 1, 'paid', now() + v.starts_in + interval '90 minutes', 48
from public.hirers h,
     (values ('98770000-0000-4000-8000-000000000001', 'Last Night', interval '-10 hours'),
             ('98770000-0000-4000-8000-000000000002', 'Last Week',  interval '-7 days'),
             ('98770000-0000-4000-8000-000000000003', 'Owed Game',  interval '-7 days')) as v(id, title, starts_in)
where h.user_id = '11111111-1111-4111-8111-111111111101';

insert into public.job_assignments (job_id, ref_id, status, amount_due, payout_status)
select j, r, 'completed', 70, case when j = '98770000-0000-4000-8000-000000000003'::uuid then 'pending' else 'paid' end
from unnest(array['98770000-0000-4000-8000-000000000001', '98770000-0000-4000-8000-000000000002',
                  '98770000-0000-4000-8000-000000000003']::uuid[]) as j,
     unnest(array['22222222-2222-4222-8222-222222222200', '22222222-2222-4222-8222-222222222201']::uuid[]) as r;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
-- Threads first: a permission check can't see participants added in the same statement.
select public.get_or_create_crew_thread('98770000-0000-4000-8000-000000000001');
select public.get_or_create_crew_thread('98770000-0000-4000-8000-000000000002');

select lives_ok($$
  insert into public.messages (conversation_id, sender_id, body)
  values ((select id from public.conversations where job_id = '98770000-0000-4000-8000-000000000001' and kind = 'game_crew'),
          '22222222-2222-4222-8222-222222222200', 'good game')
$$, 'the crew can message each other the night after a game');

select throws_ok($$
  insert into public.messages (conversation_id, sender_id, body)
  values ((select id from public.conversations where job_id = '98770000-0000-4000-8000-000000000002' and kind = 'game_crew'),
          '22222222-2222-4222-8222-222222222200', 'hello?')
$$, '42501', null, 'but not once 24 hours have passed since it ended');

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);

select lives_ok($$ select public.post_crew_note('98770000-0000-4000-8000-000000000001', 'thanks all') $$,
  'the director can post a crew note inside the window');
select throws_like($$ select public.post_crew_note('98770000-0000-4000-8000-000000000002', 'one more thing') $$,
  '%closed%', 'and not after it when the crew was paid');
select lives_ok($$ select public.post_crew_note('98770000-0000-4000-8000-000000000003', 'about your pay') $$,
  'unless the game has a payment issue (a ref is still owed past the payout window)');

select * from finish();
rollback;
