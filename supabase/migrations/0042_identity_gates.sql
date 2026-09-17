-- 0042 · Verified identity gates the work, not the looking.
--
-- 0041 records whether Didit has confirmed who someone is. This puts that
-- answer in front of every action that creates an obligation to another person:
-- taking a game, staffing one, posting one, importing a schedule, joining a
-- roster. Browsing, editing your own profile, messaging, declining and
-- withdrawing all stay open — someone waiting on a check can look around, and
-- nobody is ever trapped in a commitment they can't back out of.
--
-- Enforcement lives here rather than in the apps, so no screen, old app version
-- or direct API call can skip it.
--
-- Each function below is its current definition (0030 for the staffing RPCs,
-- 0037 for the import and the completeness triggers) with the gate added, so
-- the diff against those migrations is only the new check.

create or replace function public.respond_to_job(
  p_job_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref uuid := (select auth.uid());
  v_job record;
  v_existing record;
  v_next_status text;
  v_accepted_count integer;
begin
  if v_ref is null then
    raise exception 'Authentication required';
  end if;

  -- Declining and withdrawing stay open to everyone; taking work does not.
  if p_accept and not public.is_identity_verified(v_ref) then
    raise exception 'Verify your ID before applying to games.'
      using errcode = '42501';
  end if;

  select
    j.id,
    j.status,
    j.starts_at,
    coalesce(j.duration_minutes, 120) as duration_minutes,
    j.crew_size,
    coalesce(j.auto_accept, false) as auto_accept,
    j.assignor_staffing_mode,
    t.assignor_id,
    t.assignor_status
  into v_job
  from public.jobs j
  left join public.tournaments t on t.id = j.tournament_id
  where j.id = p_job_id
  for update of j;

  if v_job.id is null then
    raise exception 'Game not found';
  end if;
  if v_job.status in ('completed', 'cancelled') or v_job.starts_at <= now() then
    raise exception 'This game is no longer accepting responses';
  end if;

  select a.* into v_existing
  from public.job_assignments a
  where a.job_id = p_job_id and a.ref_id = v_ref
  for update;

  if not exists (
    select 1 from public.public_profiles p
    where p.id = v_ref
      and p.is_active = true
      and (
        p.primary_role = 'referee'
        or exists (
          select 1 from public.user_roles ur
          where ur.user_id = p.id and ur.role = 'referee'
        )
      )
  ) then
    raise exception 'Active referee profile required';
  end if;

  if not p_accept then
    if v_existing.status in ('accepted', 'completed', 'cancelled') then
      raise exception 'Withdraw from an accepted game instead';
    end if;

    insert into public.job_assignments (
      job_id, ref_id, status, applied_at, responded_at
    )
    values (p_job_id, v_ref, 'declined', now(), now())
    on conflict (job_id, ref_id) do update
      set status = 'declined', responded_at = now();

    return 'declined';
  end if;

  if v_existing.status in ('accepted', 'completed') then
    return v_existing.status;
  end if;

  if v_job.assignor_id is not null and v_job.assignor_status = 'accepted' then
    if not exists (
      select 1 from public.assignor_rosters r
      where r.assignor_id = v_job.assignor_id
        and r.ref_id = v_ref
        and r.status = 'accepted'
    ) then
      raise exception 'This game is limited to the assignor roster';
    end if;

    if v_job.assignor_staffing_mode = 'assignor_direct'
       and coalesce(v_existing.status, '') not in ('offered', 'needs_reconfirm') then
      raise exception 'An assignment offer is required for this game';
    end if;
  end if;

  if exists (
    select 1
    from public.job_assignments a
    join public.jobs other on other.id = a.job_id
    where a.ref_id = v_ref
      and a.job_id <> p_job_id
      and a.status in ('accepted', 'needs_reconfirm')
      and v_job.starts_at
          < other.starts_at + make_interval(mins => coalesce(other.duration_minutes, 120))
      and other.starts_at
          < v_job.starts_at + make_interval(mins => v_job.duration_minutes)
  ) then
    raise exception 'Schedule conflict with another accepted game';
  end if;

  select count(*) into v_accepted_count
  from public.job_assignments a
  where a.job_id = p_job_id
    and a.ref_id <> v_ref
    and a.status in ('accepted', 'needs_reconfirm');

  if v_accepted_count >= v_job.crew_size then
    raise exception 'Crew is already full';
  end if;

  v_next_status := case
    when v_existing.status in ('offered', 'needs_reconfirm') then 'accepted'
    when v_job.assignor_staffing_mode = 'self_assign' then 'accepted'
    when v_job.auto_accept then 'accepted'
    else 'pending'
  end;

  insert into public.job_assignments (
    job_id, ref_id, status, applied_at, responded_at
  )
  values (p_job_id, v_ref, v_next_status, now(), now())
  on conflict (job_id, ref_id) do update
    set status = excluded.status,
        responded_at = excluded.responded_at;

  if v_next_status = 'accepted' then
    select count(*) into v_accepted_count
    from public.job_assignments a
    where a.job_id = p_job_id
      and a.status in ('accepted', 'needs_reconfirm');

    update public.jobs
    set status = case when v_accepted_count >= v_job.crew_size then 'staffed' else 'open' end
    where id = p_job_id;
  end if;

  return v_next_status;
end;
$$;

create or replace function public.offer_ref_to_game(
  p_job_id uuid,
  p_ref_id uuid,
  p_role text default 'official'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_job record;
  v_assignment_id uuid;
  v_active_count integer;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_identity_verified(v_actor) then
    raise exception 'Verify your ID before staffing games.'
      using errcode = '42501';
  end if;
  if p_role not in ('crew_chief', 'official', 'official_2') then
    raise exception 'Invalid crew role';
  end if;

  select
    j.id,
    j.status,
    j.starts_at,
    coalesce(j.duration_minutes, 120) as duration_minutes,
    j.crew_size,
    j.assignor_staffing_mode
  into v_job
  from public.jobs j
  join public.tournaments t on t.id = j.tournament_id
  where j.id = p_job_id
    and t.assignor_id = v_actor
    and t.assignor_status = 'accepted'
  for update of j;

  if v_job.id is null then
    raise exception 'Assigned game not found';
  end if;
  if v_job.status in ('completed', 'cancelled') or v_job.starts_at <= now() then
    raise exception 'This game is no longer open for staffing';
  end if;
  if v_job.assignor_staffing_mode is distinct from 'assignor_direct' then
    raise exception 'Game is not configured for direct assignment';
  end if;

  if not exists (
    select 1 from public.assignor_rosters r
    where r.assignor_id = v_actor
      and r.ref_id = p_ref_id
      and r.status = 'accepted'
  ) then
    raise exception 'Referee must accept the roster invitation first';
  end if;

  if not exists (
    select 1 from public.public_profiles p
    where p.id = p_ref_id
      and p.is_active = true
      and (
        p.primary_role = 'referee'
        or exists (
          select 1 from public.user_roles ur
          where ur.user_id = p.id and ur.role = 'referee'
        )
      )
  ) then
    raise exception 'Eligible referee not found';
  end if;

  if exists (
    select 1
    from public.job_assignments a
    join public.jobs other on other.id = a.job_id
    where a.ref_id = p_ref_id
      and a.job_id <> p_job_id
      and a.status in ('accepted', 'needs_reconfirm')
      and v_job.starts_at
          < other.starts_at + make_interval(mins => coalesce(other.duration_minutes, 120))
      and other.starts_at
          < v_job.starts_at + make_interval(mins => v_job.duration_minutes)
  ) then
    raise exception 'Referee has a schedule conflict';
  end if;

  select count(*) into v_active_count
  from public.job_assignments a
  where a.job_id = p_job_id
    and a.ref_id <> p_ref_id
    and a.status in ('offered', 'accepted', 'needs_reconfirm');

  if v_active_count >= v_job.crew_size then
    raise exception 'Crew is already full';
  end if;

  if exists (
    select 1 from public.job_assignments a
    where a.job_id = p_job_id
      and a.ref_id = p_ref_id
      and a.status in ('accepted', 'needs_reconfirm', 'completed', 'cancelled')
  ) then
    raise exception 'Referee already has an active or closed assignment';
  end if;

  insert into public.job_assignments (
    job_id, ref_id, role, status, applied_at, offered_at, offered_by, responded_at
  )
  values (p_job_id, p_ref_id, p_role, 'offered', now(), now(), v_actor, null)
  on conflict (job_id, ref_id) do update
    set role = excluded.role,
        status = 'offered',
        offered_at = now(),
        offered_by = v_actor,
        responded_at = null,
        withdrawn_at = null,
        withdrew_late = false
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$$;

create or replace function public.invite_existing_ref_to_roster(p_ref_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_roster_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;
  if p_ref_id is null or p_ref_id = v_actor then
    raise exception 'Choose another referee';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_actor and ur.role = 'assignor'
  ) then
    raise exception 'Assignor role required';
  end if;

  if not public.is_identity_verified(v_actor) then
    raise exception 'Verify your ID before staffing games.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.public_profiles p
    where p.id = p_ref_id
      and p.is_active = true
      and (
        p.primary_role = 'referee'
        or exists (
          select 1 from public.user_roles ur
          where ur.user_id = p.id and ur.role = 'referee'
        )
      )
  ) then
    raise exception 'Eligible referee not found';
  end if;

  insert into public.assignor_rosters (
    assignor_id, ref_id, status, invited_at, responded_at, removed_at
  )
  values (v_actor, p_ref_id, 'invited', now(), null, null)
  on conflict (assignor_id, ref_id) do update
    set status = 'invited',
        invited_at = now(),
        responded_at = null,
        removed_at = null
    where public.assignor_rosters.status in ('declined', 'removed')
  returning id into v_roster_id;

  if v_roster_id is null then
    select r.id into v_roster_id
    from public.assignor_rosters r
    where r.assignor_id = v_actor and r.ref_id = p_ref_id;
  end if;

  return v_roster_id;
end;
$$;

create or replace function public.respond_to_roster_invite(
  p_roster_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := case when p_accept then 'accepted' else 'declined' end;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  -- Declining an invitation is always allowed; joining a roster is work.
  if p_accept and not public.is_identity_verified((select auth.uid())) then
    raise exception 'Verify your ID before joining a roster.'
      using errcode = '42501';
  end if;

  update public.assignor_rosters r
  set status = v_status,
      responded_at = now(),
      removed_at = null
  where r.id = p_roster_id
    and r.ref_id = (select auth.uid())
    and r.status = 'invited';

  if not found then
    raise exception 'Pending roster invitation not found';
  end if;

  return v_status;
end;
$$;

create or replace function public.submit_assignor_proposal(
  p_tournament_id uuid,
  p_fee_type text,
  p_fee_amount integer default null,
  p_fee_pct numeric default null,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_proposal_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.is_identity_verified((select auth.uid())) then
    raise exception 'Verify your ID before staffing games.'
      using errcode = '42501';
  end if;
  if p_fee_type not in ('flat', 'percentage') then raise exception 'Invalid fee type'; end if;
  if p_fee_type = 'flat' and (p_fee_amount is null or p_fee_amount <= 0) then raise exception 'Invalid flat fee'; end if;
  if p_fee_type = 'percentage' and (p_fee_pct is null or p_fee_pct <= 0 or p_fee_pct > 100) then raise exception 'Invalid fee percentage'; end if;

  perform 1 from public.tournaments
  where id = p_tournament_id
    and assignor_id = (select auth.uid())
    and assignor_status in ('inviting', 'reviewing')
  for update;
  if not found then raise exception 'Tournament invitation not available'; end if;

  update public.assignor_proposals
  set fee_type = p_fee_type,
      fee_amount = case when p_fee_type = 'flat' then p_fee_amount else null end,
      fee_pct = case when p_fee_type = 'percentage' then p_fee_pct else null end,
      message = nullif(left(trim(p_message), 2000), ''),
      status = 'submitted', submitted_at = now(), responded_at = null
  where tournament_id = p_tournament_id
    and assignor_id = (select auth.uid())
    and status in ('invited', 'submitted')
  returning id into v_proposal_id;
  if v_proposal_id is null then raise exception 'Proposal not available'; end if;

  update public.tournaments set assignor_status = 'reviewing' where id = p_tournament_id;
  return v_proposal_id;
end;
$$;

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
  if not public.is_identity_verified(v_actor) then
    raise exception 'Verify your ID before posting games.'
      using errcode = '42501';
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

  if not public.is_identity_verified((select auth.uid())) then
    raise exception 'Verify your ID before posting games.'
      using errcode = '42501';
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

  if not public.is_identity_verified((select auth.uid())) then
    raise exception 'Verify your ID before posting games.'
      using errcode = '42501';
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
