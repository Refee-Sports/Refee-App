-- =============================================================================
-- REFEE — MIGRATION 0031: ATOMIC TOURNAMENT SCHEDULE IMPORT
-- =============================================================================

alter table public.tournaments
  add column if not exists timezone text not null default 'America/Chicago';

comment on column public.tournaments.timezone is
  'IANA timezone used to display and validate the tournament schedule.';

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
  if v_actor <> v_tournament.director_user_id and not (
    v_actor = v_tournament.assignor_id and v_tournament.assignor_status = 'accepted'
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
    v_venue_name := btrim(coalesce(v_game->>'venue_name', ''));
    v_venue_city := btrim(coalesce(v_game->>'venue_city', ''));
    v_venue_state := upper(btrim(coalesce(v_game->>'venue_state', '')));
    v_level := btrim(coalesce(v_game->>'level', ''));

    if v_home = '' or length(v_home) > 120 then raise exception 'Game % has an invalid home team', v_index; end if;
    if v_away = '' or length(v_away) > 120 then raise exception 'Game % has an invalid away team', v_index; end if;
    if lower(v_home) = lower(v_away) then raise exception 'Game % teams must differ', v_index; end if;
    if v_venue_name = '' or length(v_venue_name) > 160 then raise exception 'Game % has an invalid venue', v_index; end if;
    if v_venue_city = '' or length(v_venue_city) > 120 then raise exception 'Game % has an invalid city', v_index; end if;
    if v_venue_state !~ '^[A-Z]{2}$' then raise exception 'Game % has an invalid state', v_index; end if;
    if v_level = '' or length(v_level) > 80 then raise exception 'Game % has an invalid level', v_index; end if;
    if coalesce(v_game->>'starts_at', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' then
      raise exception 'Game % starts_at must be RFC 3339 with an offset', v_index;
    end if;
    if coalesce(v_game->>'crew_size', '') !~ '^[0-9]+$' then raise exception 'Game % has an invalid crew size', v_index; end if;
    if coalesce(v_game->>'pay_per_game', '') !~ '^[0-9]+$' then raise exception 'Game % has invalid pay', v_index; end if;
    if coalesce(v_game->>'duration_minutes', '') !~ '^[0-9]+$' then raise exception 'Game % has an invalid duration', v_index; end if;

    v_starts_at := (v_game->>'starts_at')::timestamptz;
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
      level, age_group, gender, ruleset, starts_at, duration_minutes,
      venue_name, venue_city, venue_state, pay_per_game, crew_size,
      uniform_requirements, ruleset_modifications, game_format, period_minutes,
      auto_accept, job_type, status, num_games
    ) values (
      v_tournament.hirer_id, p_tournament_id, v_tournament.sport_id,
      v_home || ' vs ' || v_away, v_home, v_away,
      v_level, nullif(btrim(v_game->>'age_group'), ''), nullif(btrim(v_game->>'gender'), ''),
      coalesce(nullif(btrim(v_game->>'ruleset'), ''), v_tournament.ruleset),
      v_starts_at, v_duration, v_venue_name, v_venue_city, v_venue_state,
      v_pay, v_crew_size,
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

revoke all on function public.import_tournament_schedule(uuid, jsonb) from public, anon;
grant execute on function public.import_tournament_schedule(uuid, jsonb) to authenticated;
