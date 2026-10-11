-- 0062 · New-game alerts, and the switches that control notifications.
--
-- 1. notification_preferences: each person can turn three kinds of push on or
--    off — new games, crew messages, and game updates. No row means everything
--    is on. Only the owner can read or change their row.
--
-- 2. new_game_alerts: remembers who was told about which game, so asking twice
--    never notifies twice.
--
-- 3. Four backend-only functions (the apps cannot call them; the edge functions
--    use the service role):
--      matching_referees_for_job     who should hear about a game
--      claim_new_game_alerts         the same, minus anyone already told, recorded
--      can_alert_for_job             whether a caller may announce a game
--      notification_enabled_user_ids who has a given kind of notification on
--
-- Who hears about a game is decided here, never by the caller, so nobody can
-- name recipients or push to people their game would not reach. The rules are
-- the feed's (distance, available day, minimum rate) plus the ones that decide
-- whether a referee can actually take the game: verified and not suspended, no
-- clash with a game they have confirmed, not already answered, on the roster
-- when an assignor runs the event, and new-game alerts not turned off.
--
-- Like the feed, it does not look at the sport (basketball only for now) or at
-- the on-duty switch, which starts off for everyone.

-- ── 1. Preferences ──────────────────────────────────────────────────────────
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  new_games boolean not null default true,
  crew_messages boolean not null default true,
  game_updates boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is
  'Which kinds of push a person wants. No row = all on. Owner-only.';

alter table public.notification_preferences enable row level security;
revoke all on table public.notification_preferences from anon, authenticated;
grant select, insert, update on table public.notification_preferences to authenticated;

create policy "owners read their notification preferences"
  on public.notification_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "owners add their notification preferences"
  on public.notification_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "owners change their notification preferences"
  on public.notification_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.touch_notification_preferences()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_notification_preferences on public.notification_preferences;
create trigger trg_touch_notification_preferences
  before update on public.notification_preferences
  for each row execute function public.touch_notification_preferences();

-- ── 2. Who has been told about which game ───────────────────────────────────
create table if not exists public.new_game_alerts (
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (job_id, user_id)
);

comment on table public.new_game_alerts is
  'One row per referee told about a new game. Backend only.';

alter table public.new_game_alerts enable row level security;
revoke all on table public.new_game_alerts from anon, authenticated;

-- ── 3. Backend functions ────────────────────────────────────────────────────

-- Which of these people have this kind of notification on. Unknown kinds are an
-- error, so a typo can never quietly mean "send to everyone".
create or replace function public.notification_enabled_user_ids(p_targets uuid[], p_kind text)
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_kind is null or p_kind not in ('new_games', 'crew_messages', 'game_updates') then
    raise exception 'Unknown notification kind.' using errcode = '22023';
  end if;

  return query
    select t.id
    from unnest(coalesce(p_targets, array[]::uuid[])) as t(id)
    where not exists (
      select 1 from public.notification_preferences np
      where np.user_id = t.id
        and (
          (p_kind = 'new_games' and not np.new_games)
          or (p_kind = 'crew_messages' and not np.crew_messages)
          or (p_kind = 'game_updates' and not np.game_updates)
        )
    );
end;
$$;

-- Who should hear about a game that has just been posted.
create or replace function public.matching_referees_for_job(p_job_id uuid)
returns table (user_id uuid, distance_miles numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with j as (
    select
      jb.id,
      jb.starts_at,
      jb.pay_per_game,
      coalesce(jb.duration_minutes, 120) as minutes,
      jb.venue_lat,
      jb.venue_lng,
      upper(jb.venue_state) as venue_state,
      coalesce(jb.timezone, 'America/Chicago') as tz,
      jb.assignor_staffing_mode as mode,
      t.assignor_id,
      t.assignor_status,
      h.user_id as hirer_user
    from public.jobs jb
    left join public.tournaments t on t.id = jb.tournament_id
    left join public.hirers h on h.id = jb.hirer_id
    where jb.id = p_job_id
      and jb.status = 'open'
      and jb.starts_at > now()
  ),
  candidates as (
    select
      p.id as ref_id,
      j.*,
      coalesce(a.travel_radius_miles, 25) as radius,
      coalesce(a.min_pay_per_game, 0) as min_pay,
      coalesce(a.available_days, 0) as day_mask,
      upper(p.state) as ref_state,
      case
        when pp.home_lat is not null and pp.home_lng is not null
         and j.venue_lat is not null and j.venue_lng is not null
        then 3958.8 * 2 * asin(least(1, sqrt(
               power(sin(radians(j.venue_lat - pp.home_lat) / 2), 2)
               + cos(radians(pp.home_lat)) * cos(radians(j.venue_lat))
                 * power(sin(radians(j.venue_lng - pp.home_lng) / 2), 2)
             )))
      end as miles
    from j
    join public.public_profiles p on p.is_active = true
    left join public.private_profiles pp on pp.id = p.id
    left join public.availability_prefs a on a.ref_id = p.id
    where (
        p.primary_role = 'referee'
        or exists (
          select 1 from public.user_roles ur
          where ur.user_id = p.id and ur.role = 'referee'
        )
      )
      and p.id is distinct from j.hirer_user
      and public.is_identity_verified(p.id)
  )
  select c.ref_id as user_id, round(c.miles::numeric, 1) as distance_miles
  from candidates c
  where
    -- Near enough: a true mile radius when both ends are on the map, otherwise
    -- the same state — exactly as the feed does.
    (
      case
        when c.miles is not null then c.miles <= c.radius
        else c.ref_state is not null and c.ref_state = c.venue_state
      end
    )
    -- At or above their minimum rate.
    and (c.min_pay = 0 or coalesce(c.pay_per_game, 0) >= c.min_pay)
    -- On a day they work, in the venue's time zone. No days set means any day.
    and (
      c.day_mask = 0
      or c.day_mask = 127
      or (c.day_mask & (1 << extract(dow from (c.starts_at at time zone c.tz))::int)) <> 0
    )
    -- Not already answered, and not on a game that overlaps this one.
    and not exists (
      select 1 from public.job_assignments x
      where x.job_id = c.id
        and x.ref_id = c.ref_id
        and x.status in ('offered', 'accepted', 'pending', 'declined', 'needs_reconfirm')
    )
    and not exists (
      select 1
      from public.job_assignments x
      join public.jobs o on o.id = x.job_id
      where x.ref_id = c.ref_id
        and x.job_id <> c.id
        and x.status in ('accepted', 'needs_reconfirm')
        and c.starts_at < o.starts_at + make_interval(mins => coalesce(o.duration_minutes, 120))
        and o.starts_at < c.starts_at + make_interval(mins => c.minutes)
    )
    -- An assignor's event goes only to their roster, and only when the roster
    -- can claim games; when the assignor places people, nothing is broadcast.
    and (
      c.assignor_id is null
      or c.assignor_status is distinct from 'accepted'
      or (
        coalesce(c.mode, 'self_assign') <> 'assignor_direct'
        and exists (
          select 1 from public.assignor_rosters r
          where r.assignor_id = c.assignor_id
            and r.ref_id = c.ref_id
            and r.status = 'accepted'
        )
      )
    )
    -- Not turned off.
    and not exists (
      select 1 from public.notification_preferences np
      where np.user_id = c.ref_id and not np.new_games
    )
  order by c.miles nulls last, c.ref_id;
$$;

-- The same list, minus anyone already told, and recorded as told. Asking twice
-- for the same game returns nobody the second time.
create or replace function public.claim_new_game_alerts(p_job_id uuid)
returns table (user_id uuid, distance_miles numeric)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  return query
    with matches as (
      select m.user_id, m.distance_miles
      from public.matching_referees_for_job(p_job_id) m
    ),
    claimed as (
      insert into public.new_game_alerts (job_id, user_id)
      select p_job_id, m.user_id from matches m
      on conflict do nothing
      returning public.new_game_alerts.user_id
    )
    select m.user_id, m.distance_miles
    from matches m
    join claimed c on c.user_id = m.user_id;
end;
$$;

-- Whether this person may announce this game: the director who posted it, or
-- the assignor running its tournament.
create or replace function public.can_alert_for_job(p_caller uuid, p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_caller is not null and exists (
    select 1
    from public.jobs j
    left join public.hirers h on h.id = j.hirer_id
    left join public.tournaments t on t.id = j.tournament_id
    where j.id = p_job_id
      and (
        h.user_id = p_caller
        or (t.assignor_id = p_caller and t.assignor_status = 'accepted')
      )
  );
$$;

revoke all on function public.notification_enabled_user_ids(uuid[], text) from public, anon, authenticated;
revoke all on function public.matching_referees_for_job(uuid) from public, anon, authenticated;
revoke all on function public.claim_new_game_alerts(uuid) from public, anon, authenticated;
revoke all on function public.can_alert_for_job(uuid, uuid) from public, anon, authenticated;
grant execute on function public.notification_enabled_user_ids(uuid[], text) to service_role;
grant execute on function public.matching_referees_for_job(uuid) to service_role;
grant execute on function public.claim_new_game_alerts(uuid) to service_role;
grant execute on function public.can_alert_for_job(uuid, uuid) to service_role;
