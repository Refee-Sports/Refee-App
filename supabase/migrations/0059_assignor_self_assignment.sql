-- =============================================================
-- REFEE — MIGRATION 0059: ASSIGNORS WHO ALSO REFEREE
-- ADR 0002, case C. One person can assign some days and referee others, and
-- may put themselves on a game they're assigning.
--
-- offer_ref_to_game: assigning yourself skips the roster requirement (you
--   can't be on your own roster) and is accepted immediately instead of
--   becoming an offer you'd have to accept from your other role. Identity,
--   referee role, schedule-conflict and crew-size checks are unchanged.
-- respond_to_job: in a roster-only tournament the assignor can claim their
--   own games like a roster member.
-- Both bodies are 0042's with only those changes.
-- =============================================================

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
  v_self boolean := p_ref_id = (select auth.uid());
  v_status text;
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

  -- Assigning yourself (ADR 0002, case C) needs no roster entry; everyone else does.
  if p_ref_id is distinct from v_actor and not exists (
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

  -- An offer to yourself would only wait for you to accept it from your other
  -- hat, so a self-assignment is accepted on the spot. The gates accepting
  -- applies (identity, referee role, schedule, crew size) were checked above.
  v_status := case when v_self then 'accepted' else 'offered' end;

  insert into public.job_assignments (
    job_id, ref_id, role, status, applied_at, offered_at, offered_by, responded_at
  )
  values (
    p_job_id, p_ref_id, p_role, v_status, now(), now(), v_actor,
    case when v_self then now() end
  )
  on conflict (job_id, ref_id) do update
    set role = excluded.role,
        status = excluded.status,
        offered_at = now(),
        offered_by = v_actor,
        responded_at = excluded.responded_at,
        withdrawn_at = null,
        withdrew_late = false
  returning id into v_assignment_id;

  if v_self then
    select count(*) into v_active_count
    from public.job_assignments a
    where a.job_id = p_job_id
      and a.status in ('accepted', 'needs_reconfirm');

    update public.jobs
    set status = case when v_active_count >= v_job.crew_size then 'staffed' else 'open' end
    where id = p_job_id;
  end if;

  return v_assignment_id;
end;
$$;

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
