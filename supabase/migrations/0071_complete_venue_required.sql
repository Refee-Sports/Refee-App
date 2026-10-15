-- A game is never staffed without its full venue address.
--
-- 0037 makes the apps post every game with a street, city, state and ZIP. Two
-- kinds of game still slipped through: ones posted before that rule, and ones
-- written by the backend (imports, seed data), which skip that trigger. Rather
-- than trust every writer, the places a referee meets a game now check it:
--
--   * applying, being offered, or being confirmed on a game with an incomplete
--     address is refused, whichever path does it (the app, an RPC, an import);
--   * new-game alerts skip it (matching_referees_for_job, otherwise 0066's);
--   * the feed hides it (packages/core jobs/queries.ts).
--
-- Declining, withdrawing and completing are never blocked, so nobody is stuck on
-- a game because its address is missing. Backend writes with no signed-in
-- person (seed data, scheduled jobs) aren't checked here.

create or replace function public.venue_is_complete(
  p_address text, p_zip text, p_city text, p_state text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(btrim(p_address), '') <> ''
     and coalesce(p_zip, '') ~ '^[0-9]{5}$'
     and coalesce(btrim(p_city), '') <> ''
     and upper(btrim(coalesce(p_state, ''))) ~ '^[A-Z]{2}$'
$$;

create or replace function public.guard_assignment_complete_venue()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.status not in ('pending', 'offered', 'accepted') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  if exists (
    select 1 from public.jobs j
    where j.id = new.job_id
      and not public.venue_is_complete(j.venue_address, j.venue_zip, j.venue_city, j.venue_state)
  ) then
    raise exception 'This game is missing its full venue address, so it can''t be staffed yet. The organizer needs to add the street, city, state and ZIP.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_job_assignments_complete_venue on public.job_assignments;
create trigger trg_job_assignments_complete_venue
  before insert or update of status on public.job_assignments
  for each row execute function public.guard_assignment_complete_venue();

-- New-game alerts: as 0066, plus the address check.
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
      upper(trim(jb.venue_state)) as venue_state,
      lower(trim(jb.venue_city)) as venue_city,
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
      and public.venue_is_complete(jb.venue_address, jb.venue_zip, jb.venue_city, jb.venue_state)
  ),
  candidates as (
    select
      p.id as ref_id,
      j.*,
      coalesce(a.travel_radius_miles, 25) as radius,
      coalesce(a.min_pay_per_game, 0) as min_pay,
      coalesce(a.available_days, 0) as day_mask,
      upper(trim(p.state)) as ref_state,
      lower(trim(p.city)) as ref_city,
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
    -- the referee's own city, exactly as the feed does. (The whole state was
    -- too wide: a 25-mile referee was told about games 500 miles away.)
    (
      case
        when c.miles is not null then c.miles <= c.radius
        else c.ref_city <> '' and c.ref_city = c.venue_city
             and c.ref_state is not null and c.ref_state = c.venue_state
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
