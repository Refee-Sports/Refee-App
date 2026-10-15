begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

-- When either end isn't on the map, new-game alerts match the referee's own city
-- and state (0066), never the whole state.
--
-- Seed: Alex 111…100 lives in Austin TX (40 mi radius, weekdays, min $75).

create function pg_temp.next_tue() returns timestamptz language sql as $$
  select (
    date_trunc('day', now() at time zone 'America/Chicago')
    + ((((2 - extract(dow from now() at time zone 'America/Chicago')::int) + 7) % 7 + 7) * interval '1 day')
    + interval '18 hours'
  ) at time zone 'America/Chicago'
$$;

create function pg_temp.mk_job(p_id text, p_city text, p_state text, p_lat numeric, p_lng numeric) returns void
language sql as $$
  insert into public.jobs (id, hirer_id, sport_id, title, level, crew_size, pay_per_game, starts_at, duration_minutes,
                           venue_name, venue_address, venue_zip, venue_city, venue_state, venue_lat, venue_lng, timezone, job_type, status, num_games)
  select ('98660000-0000-4000-8000-' || p_id)::uuid, h.id, 'basketball', p_city, 'high_school', 2, 100, pg_temp.next_tue(), 60,
         'Gym', '100 Test St', '78701', p_city, p_state, p_lat, p_lng, 'America/Chicago', 'single', 'open', 1
  from public.hirers h where h.user_id = '11111111-1111-4111-8111-111111111101'
$$;

create function pg_temp.reaches_alex(p_id text) returns boolean language sql as $$
  select exists (
    select 1 from public.matching_referees_for_job(('98660000-0000-4000-8000-' || p_id)::uuid)
    where user_id = '11111111-1111-4111-8111-111111111100'
  )
$$;

select pg_temp.mk_job('000000000001', ' austin ', 'tx', null, null);
select pg_temp.mk_job('000000000002', 'El Paso', 'TX', null, null);
select pg_temp.mk_job('000000000003', 'Austin', 'MN', null, null);

select ok(pg_temp.reaches_alex('000000000001'),
  'an unpinned venue in Alex''s own city reaches him, whatever the spacing or case');
select ok(not pg_temp.reaches_alex('000000000002'),
  'an unpinned venue elsewhere in Texas does not');
select ok(not pg_temp.reaches_alex('000000000003'),
  'nor does a same-named city in another state');

update public.private_profiles set home_lat = null, home_lng = null where id = '11111111-1111-4111-8111-111111111100';
select pg_temp.mk_job('000000000004', 'El Paso', 'TX', 31.7619, -106.485);
select ok(not pg_temp.reaches_alex('000000000004'),
  'with no home pin, a pinned venue 500 miles away in his state does not reach him');

select * from finish();
rollback;
