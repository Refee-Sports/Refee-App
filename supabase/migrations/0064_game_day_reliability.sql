-- 0064 · Game-day reliability. Four gaps found by walking a referee and a
-- director through the app:
--
--  1. A ref who dropped out of a game the organizer had changed left the game
--     "staffed": the slot never reopened. respond_to_job now treats that decline
--     as a withdrawal (not late) and reopens the game.
--  2. Nobody could be told when a ref's status changed. job_notify_targets
--     tells a ref on a game who to notify (the director and the assignor).
--  3. No running-late or no-show path. report_running_late stores a delay on the
--     assignment and returns who to tell; mark_no_show lets the director (or the
--     game's assignor) record a no-show, and the completion paths already skip it
--     because they only pay accepted / needs_reconfirm assignments.
--  4. Any director could rate any ref on any game. A rating now needs a game the
--     director ran, that is completed, with the rated ref completed on it.

alter table public.job_assignments
  add column if not exists late_reported_at timestamptz,
  add column if not exists late_minutes integer
    check (late_minutes is null or late_minutes between 1 and 180);

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

    -- Dropping out of a game the organizer changed (needs_reconfirm) frees a
    -- confirmed slot, exactly like withdrawing: the game must reopen, or it stays
    -- "staffed" and invisible to every other ref. Not the ref's fault, so never late.
    if v_existing.status = 'needs_reconfirm' then
      update public.job_assignments
      set status = 'withdrawn', withdrawn_at = now(), withdrew_late = false, responded_at = now()
      where job_id = p_job_id and ref_id = v_ref;

      update public.jobs set status = 'open' where id = p_job_id and status = 'staffed';

      return 'withdrawn';
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
    if v_ref is distinct from v_job.assignor_id and not exists (
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

-- Who to tell when a ref's status on a game changes: the director, plus the
-- assignor when one runs the event. Only someone with an assignment on the game
-- may ask.
create or replace function public.job_notify_targets(p_job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_title text;
  v_ids jsonb;
begin
  if v_caller is null or not exists (
    select 1 from public.job_assignments a where a.job_id = p_job_id and a.ref_id = v_caller
  ) then
    raise exception 'You are not on this game.' using errcode = '42501';
  end if;

  select j.title,
         coalesce(jsonb_agg(distinct u.id) filter (where u.id is not null and u.id <> v_caller), '[]'::jsonb)
  into v_title, v_ids
  from public.jobs j
  join public.hirers h on h.id = j.hirer_id
  left join public.tournaments t on t.id = j.tournament_id and t.assignor_status = 'accepted'
  left join lateral (values (h.user_id), (t.assignor_id)) as u(id) on true
  where j.id = p_job_id
  group by j.title;

  return jsonb_build_object('title', v_title, 'user_ids', coalesce(v_ids, '[]'::jsonb));
end;
$$;

-- A confirmed ref tells the organizer they are running late. Stores the delay so
-- the director sees it, and returns who to notify.
create or replace function public.report_running_late(p_job_id uuid, p_minutes integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_job record;
  v_name text;
begin
  if v_caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 180 then
    raise exception 'Enter a delay between 1 and 180 minutes.' using errcode = '22023';
  end if;

  select j.id, j.title, j.status, j.starts_at, coalesce(j.duration_minutes, 120) as duration_minutes
  into v_job from public.jobs j where j.id = p_job_id;

  if v_job.id is null or not exists (
    select 1 from public.job_assignments a
    where a.job_id = p_job_id and a.ref_id = v_caller and a.status = 'accepted'
  ) then
    raise exception 'You are not confirmed on this game.';
  end if;
  if v_job.status in ('completed', 'cancelled')
     or now() < v_job.starts_at - interval '3 hours'
     or now() > v_job.starts_at + make_interval(mins => v_job.duration_minutes) then
    raise exception 'You can only report running late in the hours around tip-off.';
  end if;

  update public.job_assignments
  set late_reported_at = now(), late_minutes = p_minutes
  where job_id = p_job_id and ref_id = v_caller;

  select p.display_name into v_name from public.public_profiles p where p.id = v_caller;

  return jsonb_build_object(
    'title', v_job.title,
    'ref_name', coalesce(v_name, 'A referee'),
    'minutes', p_minutes
  ) || jsonb_build_object('user_ids', public.job_notify_targets(p_job_id)->'user_ids');
end;
$$;

-- The director (or the game's assignor) records that a confirmed ref never showed.
-- No pay is locked in for them: complete_game and the sweep only pay accepted /
-- needs_reconfirm assignments.
create or replace function public.mark_no_show(p_job_id uuid, p_ref_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_job record;
begin
  if v_caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select j.id, j.title, j.status, j.starts_at, h.user_id as director_id,
         case when t.assignor_status = 'accepted' then t.assignor_id end as assignor_id
  into v_job
  from public.jobs j
  join public.hirers h on h.id = j.hirer_id
  left join public.tournaments t on t.id = j.tournament_id
  where j.id = p_job_id
  for update of j;

  if v_job.id is null or v_caller not in (v_job.director_id, coalesce(v_job.assignor_id, v_job.director_id)) then
    raise exception 'Only the organizer of this game can record a no-show.' using errcode = '42501';
  end if;
  if v_job.status in ('completed', 'cancelled') then
    raise exception 'This game is already closed.';
  end if;
  if v_job.starts_at > now() then
    raise exception 'A no-show can only be recorded once the game has started.';
  end if;

  update public.job_assignments
  set status = 'no_show', amount_due = 0
  where job_id = p_job_id and ref_id = p_ref_id and status in ('accepted', 'needs_reconfirm');

  if not found then
    raise exception 'That referee is not confirmed on this game.';
  end if;

  return jsonb_build_object('title', v_job.title, 'ref_id', p_ref_id);
end;
$$;

revoke all on function public.job_notify_targets(uuid) from public, anon;
revoke all on function public.report_running_late(uuid, integer) from public, anon;
revoke all on function public.mark_no_show(uuid, uuid) from public, anon;
grant execute on function public.job_notify_targets(uuid) to authenticated;
grant execute on function public.report_running_late(uuid, integer) to authenticated;
grant execute on function public.mark_no_show(uuid, uuid) to authenticated;

-- A rating needs a game the rater ran, that is finished, with the rated ref
-- completed on it (was: any hirer, any job, any ref).
drop policy if exists "hirers can rate refs after their job" on public.ratings;
create policy "hirers can rate refs who worked their finished game"
  on public.ratings for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.hirers h
      join public.jobs j on j.hirer_id = h.id
      join public.job_assignments a on a.job_id = j.id
      where h.id = ratings.hirer_id
        and h.user_id = (select auth.uid())
        and j.id = ratings.job_id
        and j.status = 'completed'
        and a.ref_id = ratings.ref_id
        and a.status = 'completed'
    )
  );
