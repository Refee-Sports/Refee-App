begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

-- Staff account tools (migration 0074): the full account list, edits, and the
-- money behind one account.
--   admin     22222222-2222-4222-8222-222222222203
--   referee   22222222-2222-4222-8222-222222222201 (Marcus J, Houston)
--   director  11111111-1111-4111-8111-111111111101
insert into public.admins (user_id, note)
values ('22222222-2222-4222-8222-222222222203', 'test staff');

-- Two games for the referee's ledger: one paid, one still owed.
insert into public.jobs (id, hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at, duration_minutes,
                         venue_name, venue_address, venue_zip, venue_city, venue_state, job_type, status, num_games,
                         prepaid_at, prepaid_crew_cents, prepaid_fee_cents, refunded_amount_cents)
select v.id::uuid, h.id, 'basketball', v.title, 'high_school', 1, 70, now() - v.ago, 60,
       'Ledger Gym', '1 South Ave', '78701', 'Austin', 'TX', 'single', 'completed', 1,
       now() - v.ago, 7000, 350, v.refunded
from public.hirers h,
     (values ('98740000-0000-4000-8000-000000000001', 'Paid Game',  interval '10 days', 0),
             ('98740000-0000-4000-8000-000000000002', 'Owed Game',  interval '2 days',  2000))
       as v(id, title, ago, refunded)
where h.user_id = '11111111-1111-4111-8111-111111111101';

insert into public.job_assignments (job_id, ref_id, role, status, amount_due, payout_status, paid_at, stripe_transfer_id)
values ('98740000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222201', 'referee', 'accepted',
        70, 'paid', now() - interval '9 days', 'tr_test_paid'),
       ('98740000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222201', 'referee', 'accepted',
        50, 'pending', null, null);

-- How many accounts there are, read as the owner (RLS would show staff only
-- their own row).
create temp table baseline as
  select count(*) as accounts from public.private_profiles p join public.public_profiles pub on pub.id = p.id;
grant select on baseline to authenticated;
create temp table director_baseline as
  select coalesce(sum(j.refunded_amount_cents), 0)::bigint as refunded
    from public.jobs j join public.hirers h on h.id = j.hirer_id
   where h.user_id = '11111111-1111-4111-8111-111111111101';
grant select on director_baseline to authenticated;

-- One settled game and one under dispute, for the payments list.
update public.jobs set payment_status = 'paid', payment_dispute_status = 'none'
 where id = '98740000-0000-4000-8000-000000000001';
update public.jobs set payment_status = 'paid', payment_dispute_status = 'open'
 where id = '98740000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- ── A non-admin is refused ──────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);

select throws_ok($$ select * from public.admin_list_accounts() $$, '42501', null,
  'a referee cannot list accounts');
select throws_ok(
  $$ select public.admin_update_profile('22222222-2222-4222-8222-222222222200', '{"city":"Nowhere"}'::jsonb) $$,
  '42501', null, 'nor edit anyone');
select throws_ok(
  $$ select public.admin_user_finances('22222222-2222-4222-8222-222222222200') $$,
  '42501', null, 'nor read anyone''s money');

-- ── The list ────────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222203', true);

select is(
  (select count(*) from public.admin_list_accounts(p_limit => 500)),
  (select accounts from baseline),
  'with no search, every account is listed'
);
select is(
  (select max(total_count) from public.admin_list_accounts(p_limit => 2)),
  (select accounts from baseline),
  'and each page says how many there are in all'
);
select is((select count(*) from public.admin_list_accounts(p_limit => 2))::int, 2, 'a page holds the limit');
select isnt(
  (select array_agg(user_id) from public.admin_list_accounts(p_limit => 2, p_offset => 0)),
  (select array_agg(user_id) from public.admin_list_accounts(p_limit => 2, p_offset => 2)),
  'and the next page holds different people'
);
select ok(
  '22222222-2222-4222-8222-222222222201' in (select user_id from public.admin_list_accounts('marcus')),
  'search still finds someone by name'
);
select ok(
  (select bool_and('director' = any(roles)) from public.admin_list_accounts(p_role => 'director')),
  'the role filter keeps only people with that role'
);
select ok(
  '11111111-1111-4111-8111-111111111101' in (select user_id from public.admin_list_accounts(p_role => 'director')),
  'including a director'
);
select is(
  (select deactivated from public.admin_list_accounts('marcus') limit 1), false,
  'an account that can sign in is not deactivated'
);

-- ── Edits ───────────────────────────────────────────────────────────────────
select is(
  public.admin_update_profile('22222222-2222-4222-8222-222222222201',
    '{"city":"Dallas","state":"tx","home_zip":"75201"}'::jsonb, 'Moved')
    -> 'city' ->> 'to',
  'Dallas',
  'an edit reports what changed'
);
select public.admin_update_profile('22222222-2222-4222-8222-222222222201',
  '{"legal_last_name":"Washington"}'::jsonb, 'ID scanned badly');

-- What landed, read as the owner.
reset role;
select is(
  (select city || ',' || state from public.public_profiles where id = '22222222-2222-4222-8222-222222222201'),
  'Dallas,TX', 'the public city and state change, state upper-cased'
);
select is(
  (select home_zip from public.private_profiles where id = '22222222-2222-4222-8222-222222222201'),
  '75201', 'the home ZIP changes'
);
select is(
  (select home_lat from public.private_profiles where id = '22222222-2222-4222-8222-222222222201'),
  null, 'and the old map point is cleared so it can''t place them in the old city'
);
select is(
  (select last_initial from public.public_profiles where id = '22222222-2222-4222-8222-222222222201'),
  'W', 'a new legal last name moves the public initial'
);
select ok(
  exists (select 1 from public.name_changes
           where user_id = '22222222-2222-4222-8222-222222222201'
             and field = 'legal_last_name' and new_value = 'Washington'),
  'and lands in the name-change log like any other name change'
);
select is(
  (select detail -> 'changes' -> 'city' ->> 'from' from public.admin_actions
    where action = 'account.edit' and subject_user_id = '22222222-2222-4222-8222-222222222201'
      and detail -> 'changes' ? 'city'),
  'Houston', 'every edit is recorded with the value it replaced'
);
set local role authenticated;

select is(
  public.admin_update_profile('22222222-2222-4222-8222-222222222201', '{"city":"Dallas"}'::jsonb),
  '{}'::jsonb, 'saving the same value changes nothing'
);

select throws_ok(
  $$ select public.admin_update_profile('22222222-2222-4222-8222-222222222201', '{"identity_status":"approved"}'::jsonb) $$,
  '22023', null, 'fields staff can''t edit here are refused, not ignored');
select throws_ok(
  $$ select public.admin_update_profile('22222222-2222-4222-8222-222222222201', '{"state":"Texas"}'::jsonb) $$,
  '22023', null, 'a state must be two letters');
select throws_ok(
  $$ select public.admin_update_profile('22222222-2222-4222-8222-222222222201', '{"home_zip":"7520"}'::jsonb) $$,
  '22023', null, 'a ZIP must be five digits');
select throws_ok(
  format($$ select public.admin_update_profile('22222222-2222-4222-8222-222222222201', '{"date_of_birth":"%s"}'::jsonb) $$,
         (current_date - interval '10 years')::date),
  '23514', null, 'staff cannot make someone under 18');

-- ── Money ───────────────────────────────────────────────────────────────────
-- Asked as staff, checked against the tables as the owner.
select ok(
  '98740000-0000-4000-8000-000000000001' not in (select job_id from public.admin_payment_issues()),
  'a paid game with no dispute isn''t a payment issue ("none" is not a dispute)'
);
select is(
  (select dispute_status from public.admin_payment_issues() where job_id = '98740000-0000-4000-8000-000000000002'),
  'open', 'a game under dispute is'
);

create temp table fin as
  select public.admin_user_finances('22222222-2222-4222-8222-222222222201') as ref,
         public.admin_user_finances('11111111-1111-4111-8111-111111111101') as dir;
reset role;

select is(
  (select (ref -> 'referee' ->> 'paid_total')::numeric from fin),
  (select coalesce(sum(amount_due), 0) from public.job_assignments
    where ref_id = '22222222-2222-4222-8222-222222222201' and payout_status = 'paid')::numeric,
  'a referee''s paid total is what was paid out to them'
);
select is(
  (select (ref -> 'referee' ->> 'pending_total')::numeric from fin),
  (select coalesce(sum(amount_due), 0) from public.job_assignments
    where ref_id = '22222222-2222-4222-8222-222222222201' and payout_status = 'pending')::numeric,
  'and what''s still owed is separate'
);
select ok(
  (select bool_or(l ->> 'stripe_transfer_id' = 'tr_test_paid')
     from fin, jsonb_array_elements(ref -> 'referee' -> 'lines') l),
  'each payout line carries the Stripe transfer to trace it'
);
select is(
  (select (dir -> 'director' ->> 'refunded_cents')::bigint from fin),
  (select refunded from director_baseline),
  'a director''s refunds add up across their games'
);
select is(
  (select (dir -> 'director' ->> 'disputes')::int from fin),
  (select count(*)::int from public.jobs j join public.hirers h on h.id = j.hirer_id
    where h.user_id = '11111111-1111-4111-8111-111111111101' and j.payment_dispute_status <> 'none'),
  'and only real disputes are counted'
);

select * from finish();

rollback;
