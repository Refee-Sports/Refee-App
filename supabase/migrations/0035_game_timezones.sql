-- 0035 — every game knows its time zone, and the database converts the time
-- the director typed into the right instant.
--
-- Until now the apps built start times in the director's browser zone and
-- displayed every time in Central, so a 1:30 PM game in New York showed as
-- 12:30 PM CT. Now:
--
--   jobs.timezone      IANA zone of the venue (from the map pin when the app
--                      knows it, else the tournament's, else the venue state's)
--   jobs.starts_local  the wall-clock time at the venue ("2026-09-20 13:30").
--                      When a client sends it, starts_at is computed from it in
--                      jobs.timezone — Postgres' tz database handles DST.
--
-- Older app builds that only send starts_at keep working: starts_local is then
-- derived from starts_at. Tournaments no longer silently default to Central.

-- ── Region → zone (fallback when there's no map pin) ─────────────────────────
-- One zone per state/DC/PR. States split across two zones get the zone most
-- of their population is in; the map-pin lookup covers the exceptions.
create or replace function public.tz_for_region(p_state text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case upper(trim(coalesce(p_state, '')))
    when 'CT' then 'America/New_York' when 'DC' then 'America/New_York'
    when 'DE' then 'America/New_York' when 'FL' then 'America/New_York'
    when 'GA' then 'America/New_York' when 'KY' then 'America/New_York'
    when 'MA' then 'America/New_York' when 'MD' then 'America/New_York'
    when 'ME' then 'America/New_York' when 'NC' then 'America/New_York'
    when 'NH' then 'America/New_York' when 'NJ' then 'America/New_York'
    when 'NY' then 'America/New_York' when 'OH' then 'America/New_York'
    when 'PA' then 'America/New_York' when 'RI' then 'America/New_York'
    when 'SC' then 'America/New_York' when 'VA' then 'America/New_York'
    when 'VT' then 'America/New_York' when 'WV' then 'America/New_York'
    when 'MI' then 'America/Detroit'
    when 'IN' then 'America/Indiana/Indianapolis'
    when 'AL' then 'America/Chicago' when 'AR' then 'America/Chicago'
    when 'IA' then 'America/Chicago' when 'IL' then 'America/Chicago'
    when 'KS' then 'America/Chicago' when 'LA' then 'America/Chicago'
    when 'MN' then 'America/Chicago' when 'MO' then 'America/Chicago'
    when 'MS' then 'America/Chicago' when 'ND' then 'America/Chicago'
    when 'NE' then 'America/Chicago' when 'OK' then 'America/Chicago'
    when 'SD' then 'America/Chicago' when 'TN' then 'America/Chicago'
    when 'TX' then 'America/Chicago' when 'WI' then 'America/Chicago'
    when 'CO' then 'America/Denver' when 'MT' then 'America/Denver'
    when 'NM' then 'America/Denver' when 'UT' then 'America/Denver'
    when 'WY' then 'America/Denver' when 'ID' then 'America/Boise'
    when 'AZ' then 'America/Phoenix'
    when 'CA' then 'America/Los_Angeles' when 'NV' then 'America/Los_Angeles'
    when 'OR' then 'America/Los_Angeles' when 'WA' then 'America/Los_Angeles'
    when 'AK' then 'America/Anchorage'
    when 'HI' then 'Pacific/Honolulu'
    when 'PR' then 'America/Puerto_Rico'
    else null
  end
$$;

-- ── Columns + backfill (before the triggers exist) ───────────────────────────
alter table public.jobs
  add column if not exists timezone text,
  add column if not exists starts_local timestamp;

-- Tournaments were created with a Central default nobody chose; re-derive
-- from the venue where the state says otherwise.
update public.tournaments
set timezone = public.tz_for_region(venue_state)
where timezone = 'America/Chicago'
  and public.tz_for_region(venue_state) is not null
  and public.tz_for_region(venue_state) <> 'America/Chicago';

alter table public.tournaments alter column timezone drop default;

-- Existing games: zone from their tournament, else their state. Their
-- starts_at instants are kept as they are.
update public.jobs j
set timezone = coalesce(
      (select t.timezone from public.tournaments t where t.id = j.tournament_id),
      public.tz_for_region(j.venue_state),
      'America/Chicago'),
    starts_local = null
where j.timezone is null;

update public.jobs set starts_local = starts_at at time zone timezone where starts_local is null;

-- ── Triggers ─────────────────────────────────────────────────────────────────
create or replace function public.apply_game_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.timezone := coalesce(
      nullif(trim(new.timezone), ''),
      (select t.timezone from public.tournaments t where t.id = new.tournament_id),
      public.tz_for_region(new.venue_state),
      'America/Chicago');
  elsif new.timezone is null or trim(new.timezone) = '' then
    new.timezone := old.timezone;
  elsif new.venue_state is distinct from old.venue_state
        and new.timezone is not distinct from old.timezone then
    -- The venue moved to another state and nobody sent a zone: follow it.
    new.timezone := coalesce(public.tz_for_region(new.venue_state), old.timezone);
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = new.timezone) then
    raise exception 'Unknown time zone: %', new.timezone using errcode = '22023';
  end if;

  -- The wall-clock time wins when the client sent (or changed) it.
  if new.starts_local is not null and (
       tg_op = 'INSERT'
       or new.starts_local is distinct from old.starts_local
       or new.timezone is distinct from old.timezone) then
    new.starts_at := new.starts_local at time zone new.timezone;
  end if;
  new.starts_local := new.starts_at at time zone new.timezone;

  return new;
end;
$$;

drop trigger if exists trg_jobs_timezone on public.jobs;
create trigger trg_jobs_timezone
  before insert or update on public.jobs
  for each row execute function public.apply_game_timezone();

create or replace function public.apply_tournament_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.timezone := coalesce(nullif(trim(new.timezone), ''), public.tz_for_region(new.venue_state), 'America/Chicago');
  elsif new.timezone is null or trim(new.timezone) = '' then
    new.timezone := old.timezone;
  elsif new.venue_state is distinct from old.venue_state
        and new.timezone is not distinct from old.timezone then
    new.timezone := coalesce(public.tz_for_region(new.venue_state), old.timezone);
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = new.timezone) then
    raise exception 'Unknown time zone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tournaments_timezone on public.tournaments;
create trigger trg_tournaments_timezone
  before insert or update on public.tournaments
  for each row execute function public.apply_tournament_timezone();

comment on column public.jobs.timezone is 'IANA time zone of the venue; every time for this game is shown in it.';
comment on column public.jobs.starts_local is 'Wall-clock start at the venue. Send this (not starts_at) from clients; the trigger computes starts_at.';
