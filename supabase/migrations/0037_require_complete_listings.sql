-- 0037 · Games and tournaments are posted complete.
--
-- Referees need the full address (street and ZIP, which also gives the map
-- pin), the game format, ruleset and uniform before they can take a game. The
-- web and mobile forms require all of it; this makes the backend refuse an
-- incomplete game or tournament as well, so no screen, app version or import
-- can post one.
--
--  * Writes from the apps (role "authenticated") are checked. An update is
--    checked only when it changes these details, so older incomplete listings
--    still take status, pay and note changes; editing their details means
--    completing them.
--  * Backend writes (seed data, security-definer RPCs, scheduled jobs) skip
--    the triggers. The schedule import is one of those, so it checks the same
--    details itself, below.

create or replace function public.require_complete_game()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_missing text[] := array[]::text[];
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'UPDATE' and (
    new.home_team, new.away_team, new.venue_name, new.venue_address, new.venue_zip, new.venue_city,
    new.venue_state, new.level, new.age_group, new.game_format, new.period_minutes, new.ruleset,
    new.uniform_requirements
  ) is not distinct from (
    old.home_team, old.away_team, old.venue_name, old.venue_address, old.venue_zip, old.venue_city,
    old.venue_state, old.level, old.age_group, old.game_format, old.period_minutes, old.ruleset,
    old.uniform_requirements
  ) then
    return new;
  end if;

  if coalesce(btrim(new.home_team), '') = '' then v_missing := v_missing || 'home team'::text; end if;
  if coalesce(btrim(new.away_team), '') = '' then v_missing := v_missing || 'away team'::text; end if;
  if coalesce(btrim(new.venue_name), '') = '' then v_missing := v_missing || 'venue name'::text; end if;
  if coalesce(btrim(new.venue_address), '') = '' then v_missing := v_missing || 'street address'::text; end if;
  if coalesce(new.venue_zip, '') !~ '^[0-9]{5}$' then v_missing := v_missing || 'ZIP code'::text; end if;
  if coalesce(btrim(new.venue_city), '') = '' then v_missing := v_missing || 'city'::text; end if;
  if coalesce(new.venue_state, '') !~ '^[A-Z]{2}$' then v_missing := v_missing || 'state'::text; end if;
  if new.level = 'youth_rec' and coalesce(btrim(new.age_group), '') = '' then
    v_missing := v_missing || 'age group'::text;
  end if;
  if coalesce(new.game_format, '') not in ('quarters', 'halves') then v_missing := v_missing || 'game format'::text; end if;
  if coalesce(new.period_minutes, 0) <= 0 then v_missing := v_missing || 'minutes per period'::text; end if;
  if coalesce(btrim(new.ruleset), '') = '' then v_missing := v_missing || 'ruleset'::text; end if;
  if coalesce(btrim(new.uniform_requirements), '') = '' then v_missing := v_missing || 'uniform'::text; end if;

  if cardinality(v_missing) > 0 then
    raise exception 'Missing game details: %', array_to_string(v_missing, ', ')
      using errcode = 'check_violation',
            hint = 'Referees need the full address, format, ruleset and uniform to take a game.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_jobs_require_complete on public.jobs;
create trigger trg_jobs_require_complete
  before insert or update on public.jobs
  for each row execute function public.require_complete_game();

create or replace function public.require_complete_tournament()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_missing text[] := array[]::text[];
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'UPDATE' and (
    new.name, new.venue_name, new.venue_address, new.venue_zip, new.venue_city, new.venue_state,
    new.game_format, new.period_minutes, new.ruleset, new.uniform_requirements
  ) is not distinct from (
    old.name, old.venue_name, old.venue_address, old.venue_zip, old.venue_city, old.venue_state,
    old.game_format, old.period_minutes, old.ruleset, old.uniform_requirements
  ) then
    return new;
  end if;

  if coalesce(btrim(new.name), '') = '' then v_missing := v_missing || 'name'::text; end if;
  if coalesce(btrim(new.venue_name), '') = '' then v_missing := v_missing || 'venue name'::text; end if;
  if coalesce(btrim(new.venue_address), '') = '' then v_missing := v_missing || 'street address'::text; end if;
  if coalesce(new.venue_zip, '') !~ '^[0-9]{5}$' then v_missing := v_missing || 'ZIP code'::text; end if;
  if coalesce(btrim(new.venue_city), '') = '' then v_missing := v_missing || 'city'::text; end if;
  if coalesce(new.venue_state, '') !~ '^[A-Z]{2}$' then v_missing := v_missing || 'state'::text; end if;
  if coalesce(new.game_format, '') not in ('quarters', 'halves') then v_missing := v_missing || 'game format'::text; end if;
  if coalesce(new.period_minutes, 0) <= 0 then v_missing := v_missing || 'minutes per period'::text; end if;
  if coalesce(btrim(new.ruleset), '') = '' then v_missing := v_missing || 'ruleset'::text; end if;
  if coalesce(btrim(new.uniform_requirements), '') = '' then v_missing := v_missing || 'uniform'::text; end if;

  if cardinality(v_missing) > 0 then
    raise exception 'Missing tournament details: %', array_to_string(v_missing, ', ')
      using errcode = 'check_violation',
            hint = 'Games in this tournament take these details, and referees need them.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tournaments_require_complete on public.tournaments;
create trigger trg_tournaments_require_complete
  before insert or update on public.tournaments
  for each row execute function public.require_complete_tournament();

-- The schedule import, unchanged from 0036 apart from the completeness checks.
create or replace function public.import_tournament_schedule(
  p_tournament_id uuid,
  p_games jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_tournament record;
  v_game jsonb;
  v_index integer := 0;
  v_starts_at timestamptz;
  v_game_id uuid;
  v_ids jsonb := '[]'::jsonb;
  v_seen jsonb := '{}'::jsonb;
  v_key text;
  v_home text;
  v_away text;
  v_venue_name text;
  v_venue_city text;
  v_venue_state text;
  v_own_address text;
  v_address text;
  v_zip text;
  v_lat numeric;
  v_lng numeric;
  v_court text;
  v_arrival text;
  v_team_level text;
  v_level text;
  v_crew_size integer;
  v_pay integer;
  v_duration integer;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;
  if p_tournament_id is null then
    raise exception 'Tournament is required';
  end if;
  if jsonb_typeof(p_games) is distinct from 'array' then
    raise exception 'Games must be a JSON array';
  end if;
  if jsonb_array_length(p_games) < 1 or jsonb_array_length(p_games) > 500 then
    raise exception 'Import must contain between 1 and 500 games';
  end if;

  -- The tournament lock makes duplicate checking safe across concurrent imports.
  select t.*, h.user_id as director_user_id
  into v_tournament
  from public.tournaments t
  join public.hirers h on h.id = t.hirer_id
  where t.id = p_tournament_id
  for update of t;

  if v_tournament.id is null then
    raise exception 'Tournament not found';
  end if;
  if v_tournament.status in ('completed', 'cancelled') then
    raise exception 'Closed tournaments cannot import games';
  end if;
  -- coalesce: with no assignor on file the inner test is NULL, and NOT NULL would
  -- skip the raise and let anyone import (the pre-0036 version had this hole).
  if v_actor is distinct from v_tournament.director_user_id and not coalesce(
    v_actor = v_tournament.assignor_id and v_tournament.assignor_status = 'accepted', false
  ) then
    raise exception 'Only the director or accepted assignor can import this schedule';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = v_tournament.timezone) then
    raise exception 'Tournament timezone is invalid';
  end if;

  for v_game in select value from jsonb_array_elements(p_games)
  loop
    v_index := v_index + 1;
    if jsonb_typeof(v_game) is distinct from 'object' then
      raise exception 'Game % must be an object', v_index;
    end if;

    v_home := btrim(coalesce(v_game->>'home_team', ''));
    v_away := btrim(coalesce(v_game->>'away_team', ''));
    -- Blank venue fields come from the tournament's venue.
    v_venue_name := coalesce(nullif(btrim(v_game->>'venue_name'), ''), btrim(coalesce(v_tournament.venue_name, '')));
    v_venue_city := coalesce(nullif(btrim(v_game->>'venue_city'), ''), btrim(coalesce(v_tournament.venue_city, '')));
    v_venue_state := upper(coalesce(nullif(btrim(v_game->>'venue_state'), ''), btrim(coalesce(v_tournament.venue_state, ''))));
    v_own_address := nullif(btrim(v_game->>'venue_address'), '');
    if v_own_address is not null then
      v_address := v_own_address;
      v_zip := nullif(btrim(v_game->>'venue_zip'), '');
      v_lat := null;
      v_lng := null;
    else
      v_address := v_tournament.venue_address;
      v_zip := coalesce(nullif(btrim(v_game->>'venue_zip'), ''), v_tournament.venue_zip);
      v_lat := v_tournament.venue_lat;
      v_lng := v_tournament.venue_lng;
    end if;
    v_court := nullif(btrim(v_game->>'court'), '');
    v_arrival := coalesce(nullif(btrim(v_game->>'arrival_notes'), ''), v_tournament.arrival_notes);
    v_team_level := nullif(lower(btrim(v_game->>'team_level')), '');
    v_level := btrim(coalesce(v_game->>'level', ''));

    if v_home = '' or length(v_home) > 120 then raise exception 'Game % has an invalid home team', v_index; end if;
    if v_away = '' or length(v_away) > 120 then raise exception 'Game % has an invalid away team', v_index; end if;
    if lower(v_home) = lower(v_away) then raise exception 'Game % teams must differ', v_index; end if;
    if v_venue_name = '' or length(v_venue_name) > 160 then raise exception 'Game % has an invalid venue', v_index; end if;
    if v_venue_city = '' or length(v_venue_city) > 120 then raise exception 'Game % has an invalid city', v_index; end if;
    if v_venue_state !~ '^[A-Z]{2}$' then raise exception 'Game % has an invalid state', v_index; end if;
    if v_level = '' or length(v_level) > 80 then raise exception 'Game % has an invalid level', v_index; end if;
    -- 0037: an imported game must be as complete as one posted by hand.
    if coalesce(btrim(v_address), '') = '' or coalesce(v_zip, '') !~ '^[0-9]{5}$' then
      raise exception 'Add the tournament''s street address and ZIP before importing games';
    end if;
    if coalesce(nullif(btrim(v_game->>'ruleset'), ''), v_tournament.ruleset, '') = ''
       or coalesce(nullif(btrim(v_game->>'uniform_requirements'), ''), btrim(v_tournament.uniform_requirements), '') = '' then
      raise exception 'Add the tournament''s ruleset and uniform before importing games';
    end if;
    if coalesce(nullif(btrim(v_game->>'game_format'), ''), v_tournament.game_format, '') not in ('quarters', 'halves')
       or coalesce(nullif(v_game->>'period_minutes', '')::integer, v_tournament.period_minutes, 0) <= 0 then
      raise exception 'Game % needs a game format (quarters or halves) and minutes per period', v_index;
    end if;
    if v_level = 'youth_rec' and nullif(btrim(v_game->>'age_group'), '') is null then
      raise exception 'Game % is youth / rec and needs an age group', v_index;
    end if;
    if v_court is not null and length(v_court) > 80 then raise exception 'Game % has an invalid court', v_index; end if;
    if v_arrival is not null and length(v_arrival) > 280 then raise exception 'Game % arrival notes are over 280 characters', v_index; end if;
    if v_team_level is not null and v_team_level not in ('varsity', 'jv', 'freshman') then
      raise exception 'Game % team level must be varsity, jv or freshman', v_index;
    end if;
    if coalesce(v_game->>'crew_size', '') !~ '^[0-9]+$' then raise exception 'Game % has an invalid crew size', v_index; end if;
    if coalesce(v_game->>'pay_per_game', '') !~ '^[0-9]+$' then raise exception 'Game % has invalid pay', v_index; end if;
    if coalesce(v_game->>'duration_minutes', '') !~ '^[0-9]+$' then raise exception 'Game % has an invalid duration', v_index; end if;

    -- Start time: the venue-local wall clock, or an RFC 3339 instant.
    if coalesce(v_game->>'starts_local', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2})?$' then
      v_starts_at := ((v_game->>'starts_local')::timestamp) at time zone v_tournament.timezone;
    elsif coalesce(v_game->>'starts_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' then
      v_starts_at := (v_game->>'starts_at')::timestamptz;
    else
      raise exception 'Game % needs starts_local (YYYY-MM-DDTHH:MM) or an RFC 3339 starts_at', v_index;
    end if;

    v_crew_size := (v_game->>'crew_size')::integer;
    v_pay := (v_game->>'pay_per_game')::integer;
    v_duration := (v_game->>'duration_minutes')::integer;

    if v_crew_size not between 1 and 5 then raise exception 'Game % crew size must be from 1 to 5', v_index; end if;
    if v_pay not between 1 and 10000 then raise exception 'Game % pay must be from 1 to 10000', v_index; end if;
    if v_duration not between 15 and 480 then raise exception 'Game % duration must be from 15 to 480 minutes', v_index; end if;
    if (v_starts_at at time zone v_tournament.timezone)::date not between v_tournament.starts_on and v_tournament.ends_on then
      raise exception 'Game % is outside the tournament dates', v_index;
    end if;

    v_key := md5(lower(v_home) || '|' || lower(v_away) || '|' || v_starts_at::text || '|' || lower(v_venue_name));
    if v_seen ? v_key then raise exception 'Game % is duplicated in this import', v_index; end if;
    v_seen := v_seen || jsonb_build_object(v_key, true);

    if exists (
      select 1 from public.jobs j
      where j.tournament_id = p_tournament_id
        and lower(coalesce(j.home_team, '')) = lower(v_home)
        and lower(coalesce(j.away_team, '')) = lower(v_away)
        and j.starts_at = v_starts_at
        and lower(j.venue_name) = lower(v_venue_name)
    ) then
      raise exception 'Game % already exists in this tournament', v_index;
    end if;

    insert into public.jobs (
      hirer_id, tournament_id, sport_id, title, home_team, away_team,
      level, team_level, age_group, gender, ruleset, starts_at, duration_minutes,
      venue_name, venue_address, venue_zip, venue_city, venue_state, venue_lat, venue_lng,
      court, arrival_notes, pay_per_game, crew_size,
      uniform_requirements, ruleset_modifications, game_format, period_minutes,
      auto_accept, job_type, status, num_games
    ) values (
      v_tournament.hirer_id, p_tournament_id, v_tournament.sport_id,
      v_home || ' vs ' || v_away, v_home, v_away,
      v_level, v_team_level, nullif(btrim(v_game->>'age_group'), ''), nullif(btrim(v_game->>'gender'), ''),
      coalesce(nullif(btrim(v_game->>'ruleset'), ''), v_tournament.ruleset),
      v_starts_at, v_duration,
      v_venue_name, v_address, v_zip, v_venue_city, v_venue_state, v_lat, v_lng,
      v_court, v_arrival, v_pay, v_crew_size,
      coalesce(nullif(btrim(v_game->>'uniform_requirements'), ''), v_tournament.uniform_requirements),
      coalesce(nullif(btrim(v_game->>'ruleset_modifications'), ''), v_tournament.ruleset_modifications),
      coalesce(nullif(btrim(v_game->>'game_format'), ''), v_tournament.game_format),
      coalesce(nullif(v_game->>'period_minutes', '')::integer, v_tournament.period_minutes),
      false, 'tournament', 'open', 1
    ) returning id into v_game_id;

    v_ids := v_ids || jsonb_build_array(v_game_id);
  end loop;

  update public.tournaments t
  set total_games = (select count(*) from public.jobs j where j.tournament_id = p_tournament_id)
  where t.id = p_tournament_id;

  return jsonb_build_object('count', v_index, 'game_ids', v_ids);
end;
$$;
