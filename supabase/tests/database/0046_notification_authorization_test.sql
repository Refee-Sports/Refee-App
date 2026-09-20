begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

-- A brand new account with no games, no roster and no conversations: exactly
-- the position an attacker signs up into.
insert into auth.users (id, phone, aud, role, created_at, updated_at)
values ('99999999-9999-4999-8999-999999999901', '15555559901', 'authenticated', 'authenticated', now(), now());
insert into public.public_profiles (id, first_name, last_initial, city, state, primary_role)
values ('99999999-9999-4999-8999-999999999901', 'Mallory', 'X', 'Brooklyn', 'NY', 'referee');

-- A ref and the director of a game that ref works.
create temporary table pair as
select ja.ref_id as ref, h.user_id as director
  from public.job_assignments ja
  join public.jobs j on j.id = ja.job_id
  join public.hirers h on h.id = j.hirer_id
 limit 1;

select isnt_empty($$ select * from pair $$, 'the seed has a ref working a game for a director');

select ok(
  public.can_notify((select ref from pair), (select director from pair)),
  'a ref may notify the director whose game they work'
);
select ok(
  public.can_notify((select director from pair), (select ref from pair)),
  'and that director may notify the ref'
);

-- The finding this migration closes.
select ok(
  not public.can_notify('99999999-9999-4999-8999-999999999901', (select ref from pair)),
  'a stranger may not notify a referee'
);
select ok(
  not public.can_notify('99999999-9999-4999-8999-999999999901', (select director from pair)),
  'nor a director'
);

select is(
  (select count(*)::int
     from public.notifiable_user_ids(
       '99999999-9999-4999-8999-999999999901',
       (select array_agg(id) from public.public_profiles))),
  1,
  'handed every id on the platform, a stranger can reach only themselves'
);

select ok(
  public.can_notify('99999999-9999-4999-8999-999999999901', '99999999-9999-4999-8999-999999999901'),
  'and that one is themselves — your own device is always reachable'
);

-- A relationship that starts as an invitation still carries a notification,
-- otherwise the invite itself could never be delivered.
insert into public.assignor_rosters (assignor_id, ref_id, status)
values ((select director from pair), '99999999-9999-4999-8999-999999999901', 'invited');
select ok(
  public.can_notify((select director from pair), '99999999-9999-4999-8999-999999999901'),
  'a roster invite reaches the ref it is addressed to'
);
select ok(
  public.can_notify('99999999-9999-4999-8999-999999999901', (select director from pair)),
  'and the ref can answer it'
);

-- Nulls must not open anything.
select ok(not coalesce(public.can_notify(null, (select ref from pair)), false),
  'a missing caller notifies nobody');
select ok(not coalesce(public.can_notify((select ref from pair), null), false),
  'and a missing target receives nothing');

select * from finish();

rollback;
