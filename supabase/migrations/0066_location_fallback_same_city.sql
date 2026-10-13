-- Location fallback: same city, not the whole state.
--
-- When a referee's home or a venue couldn't be put on the map, the feed and the
-- new-game alerts fell back to "same state", so a referee with a 25-mile radius
-- could be offered a game 500 miles away. Both now fall back to the referee's own
-- city and state instead. Only the location clause changes; the rest of the
-- function is 0062's.

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

revoke all on function public.matching_referees_for_job(uuid) from public, anon, authenticated;
grant execute on function public.matching_referees_for_job(uuid) to service_role;
