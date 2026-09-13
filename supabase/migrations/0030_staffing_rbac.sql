-- =============================================================================
-- REFEE — MIGRATION 0030: STAFFING AUTHORIZATION BOUNDARY
--
-- Moves referee/assignor roster and staffing mutations behind narrow,
-- concurrency-safe RPCs. A client can no longer self-author an accepted
-- assignment, rewrite roster relationships, overfill a crew, or use the broad
-- assignor UPDATE policies to mutate unrelated game fields.
-- =============================================================================

alter table public.job_assignments
  add column if not exists offered_at timestamptz,
  add column if not exists offered_by uuid references auth.users(id) on delete set null;

create index if not exists idx_assignments_active_crew
  on public.job_assignments(job_id, status)
  where status in ('offered', 'accepted', 'needs_reconfirm');

-- Views in an exposed schema must obey the caller's RLS policies.
alter view public.active_assignors set (security_invoker = true);
alter view public.assignor_roster_members set (security_invoker = true);

-- Remove direct mutation paths. SELECT policies remain in place.
drop policy if exists "refs can apply to jobs" on public.job_assignments;
drop policy if exists "refs can update their own assignment status" on public.job_assignments;
drop policy if exists "refs can see crew on jobs they are accepted to" on public.job_assignments;
drop policy if exists "assignors can directly assign roster refs to their games" on public.job_assignments;
drop policy if exists "assignors can update assignments on their games" on public.job_assignments;
drop policy if exists "hirers can update assignments on their jobs" on public.job_assignments;
drop policy if exists "assignors manage games on their assigned tournaments" on public.jobs;
drop policy if exists "assignors manage their own roster" on public.assignor_rosters;
drop policy if exists "refs can respond to their own roster invites" on public.assignor_rosters;
drop policy if exists "assignor updates own proposal" on public.assignor_proposals;
drop policy if exists "director updates proposals on their tournaments" on public.assignor_proposals;
drop policy if exists "assignors create proposals" on public.assignor_proposals;
drop policy if exists "assignors can update their assigned tournaments" on public.tournaments;

create policy "assignors can read their own roster"
  on public.assignor_rosters for select
  to authenticated
  using ((select auth.uid()) = assignor_id);

-- Existing referee SELECT policy from 0028 remains authoritative for invitees.

-- Confirmed referees may see confirmed crew, never other applicants/offers.
create or replace function public.is_accepted_crew_member(p_job_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.job_assignments a
    where a.job_id = p_job_id
      and a.ref_id = p_user_id
      and a.status in ('accepted', 'needs_reconfirm', 'completed')
  );
$$;

revoke all on function public.is_accepted_crew_member(uuid, uuid) from public, anon;
grant execute on function public.is_accepted_crew_member(uuid, uuid) to authenticated;

create policy "refs can see crew on jobs they are accepted to"
  on public.job_assignments for select
  to authenticated
  using (
    status in ('accepted', 'needs_reconfirm', 'completed')
    and public.is_accepted_crew_member(job_id, (select auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- ROSTER RPCS
-- -----------------------------------------------------------------------------

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

create or replace function public.remove_ref_from_roster(p_roster_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  update public.assignor_rosters r
  set status = 'removed', removed_at = now()
  where r.id = p_roster_id
    and r.assignor_id = (select auth.uid())
    and r.status <> 'removed';

  if not found then
    raise exception 'Active roster relationship not found';
  end if;
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

-- -----------------------------------------------------------------------------
-- ASSIGNOR STAFFING RPCS
-- -----------------------------------------------------------------------------

create or replace function public.set_assignor_staffing_mode(
  p_job_id uuid,
  p_mode text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if p_mode not in ('assignor_direct', 'self_assign') then
    raise exception 'Invalid staffing mode';
  end if;

  select j.id, j.status, j.assignor_staffing_mode
  into v_job
  from public.jobs j
  join public.tournaments t on t.id = j.tournament_id
  where j.id = p_job_id
    and t.assignor_id = (select auth.uid())
    and t.assignor_status = 'accepted'
  for update of j;

  if v_job.id is null then
    raise exception 'Assigned game not found';
  end if;
  if v_job.status in ('completed', 'cancelled') then
    raise exception 'Closed games cannot change staffing mode';
  end if;
  if v_job.assignor_staffing_mode is distinct from p_mode and exists (
    select 1 from public.job_assignments a
    where a.job_id = p_job_id
      and a.status in ('offered', 'pending', 'accepted', 'needs_reconfirm')
  ) then
    raise exception 'Remove active offers and assignments before changing staffing mode';
  end if;

  update public.jobs set assignor_staffing_mode = p_mode where id = p_job_id;
  return p_mode;
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

create or replace function public.remove_ref_from_assignor_game(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select a.job_id into v_job_id
  from public.job_assignments a
  join public.jobs j on j.id = a.job_id
  join public.tournaments t on t.id = j.tournament_id
  where a.id = p_assignment_id
    and a.status in ('offered', 'pending', 'accepted', 'needs_reconfirm')
    and j.status not in ('completed', 'cancelled')
    and t.assignor_id = (select auth.uid())
    and t.assignor_status = 'accepted'
  for update of j;

  if v_job_id is null then
    raise exception 'Active assignment not found';
  end if;

  update public.job_assignments
  set status = 'removed', responded_at = now()
  where id = p_assignment_id;

  update public.jobs set status = 'open' where id = v_job_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- REFEREE RESPONSE RPC
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- DIRECTOR STAFFING + LIFECYCLE RPCS
-- -----------------------------------------------------------------------------

create or replace function public.director_invite_assignor(
  p_tournament_id uuid,
  p_assignor_id uuid,
  p_fee_type text default 'flat',
  p_fee_amount integer default null,
  p_fee_pct numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_proposal_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_fee_type not in ('flat', 'percentage') then raise exception 'Invalid fee type'; end if;
  if p_fee_type = 'flat' and p_fee_amount is not null and p_fee_amount < 0 then raise exception 'Invalid flat fee'; end if;
  if p_fee_type = 'percentage' and (p_fee_pct is null or p_fee_pct <= 0 or p_fee_pct > 100) then raise exception 'Invalid fee percentage'; end if;
  if not exists (select 1 from public.user_roles where user_id = p_assignor_id and role = 'assignor') then
    raise exception 'Assignor not found';
  end if;

  perform 1
  from public.tournaments t
  join public.hirers h on h.id = t.hirer_id
  where t.id = p_tournament_id
    and h.user_id = (select auth.uid())
    and coalesce(t.assignor_status, '') <> 'accepted'
  for update of t;
  if not found then raise exception 'Director tournament not available'; end if;

  update public.tournaments
  set assignor_id = p_assignor_id,
      assignor_status = 'inviting',
      assignor_fee_type = p_fee_type,
      assignor_fee = case when p_fee_type = 'flat' then p_fee_amount else null end,
      assignor_fee_pct = case when p_fee_type = 'percentage' then p_fee_pct else null end
  where id = p_tournament_id;

  insert into public.assignor_proposals (
    tournament_id, assignor_id, status, fee_type, fee_amount, fee_pct,
    message, invited_at, submitted_at, responded_at
  ) values (
    p_tournament_id, p_assignor_id, 'invited', p_fee_type,
    case when p_fee_type = 'flat' then p_fee_amount else null end,
    case when p_fee_type = 'percentage' then p_fee_pct else null end,
    null, now(), null, null
  )
  on conflict (tournament_id, assignor_id) do update
  set status = 'invited', fee_type = excluded.fee_type,
      fee_amount = excluded.fee_amount, fee_pct = excluded.fee_pct,
      message = null, invited_at = excluded.invited_at,
      submitted_at = null, responded_at = null
  returning id into v_proposal_id;
  return v_proposal_id;
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

create or replace function public.withdraw_assignor_proposal(p_tournament_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_proposal_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  perform 1 from public.tournaments
  where id = p_tournament_id and assignor_id = (select auth.uid())
  for update;
  if not found then raise exception 'Tournament invitation not available'; end if;

  update public.assignor_proposals
  set status = 'withdrawn', responded_at = now()
  where tournament_id = p_tournament_id
    and assignor_id = (select auth.uid())
    and status in ('invited', 'submitted')
  returning id into v_proposal_id;
  if v_proposal_id is null then raise exception 'Proposal not available'; end if;

  update public.tournaments set assignor_status = 'declined' where id = p_tournament_id;
  return v_proposal_id;
end;
$$;

create or replace function public.director_respond_to_assignor_proposal(
  p_proposal_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_proposal record;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select p.id, p.tournament_id, p.assignor_id, p.status, p.fee_type, p.fee_amount, p.fee_pct
  into v_proposal
  from public.assignor_proposals p
  join public.tournaments t on t.id = p.tournament_id
  join public.hirers h on h.id = t.hirer_id
  where p.id = p_proposal_id and h.user_id = (select auth.uid())
  for update of p, t;
  if v_proposal.id is null then raise exception 'Director proposal not found'; end if;
  if v_proposal.status <> 'submitted' then raise exception 'Proposal is not awaiting a decision'; end if;

  if p_accept then
    update public.tournaments
    set assignor_id = v_proposal.assignor_id,
        assignor_status = 'accepted',
        assignor_fee_type = v_proposal.fee_type,
        assignor_fee = case when v_proposal.fee_type = 'flat' then v_proposal.fee_amount else null end,
        assignor_fee_pct = case when v_proposal.fee_type = 'percentage' then v_proposal.fee_pct else null end
    where id = v_proposal.tournament_id;
    update public.assignor_proposals set status = 'accepted', responded_at = now() where id = p_proposal_id;
    update public.assignor_proposals set status = 'declined', responded_at = now()
    where tournament_id = v_proposal.tournament_id and id <> p_proposal_id and status in ('invited', 'submitted');
    return 'accepted';
  end if;

  update public.assignor_proposals set status = 'declined', responded_at = now() where id = p_proposal_id;
  update public.tournaments set assignor_status = 'declined'
  where id = v_proposal.tournament_id and assignor_id = v_proposal.assignor_id;
  return 'declined';
end;
$$;

create or replace function public.director_respond_to_application(
  p_job_id uuid,
  p_ref_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
  v_next_status text := case when p_accept then 'accepted' else 'declined' end;
  v_accepted_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select
    j.id,
    j.status,
    j.starts_at,
    coalesce(j.duration_minutes, 120) as duration_minutes,
    j.crew_size,
    t.assignor_id,
    t.assignor_status
  into v_job
  from public.jobs j
  join public.hirers h on h.id = j.hirer_id
  left join public.tournaments t on t.id = j.tournament_id
  where j.id = p_job_id
    and h.user_id = (select auth.uid())
  for update of j;

  if v_job.id is null then
    raise exception 'Director game not found';
  end if;
  if v_job.status in ('completed', 'cancelled') or v_job.starts_at <= now() then
    raise exception 'This game is no longer accepting applications';
  end if;
  if v_job.assignor_id is not null and v_job.assignor_status = 'accepted' then
    raise exception 'This tournament is staffed by its accepted assignor';
  end if;
  if not exists (
    select 1 from public.job_assignments a
    where a.job_id = p_job_id and a.ref_id = p_ref_id and a.status = 'pending'
  ) then
    raise exception 'Pending application not found';
  end if;

  if p_accept then
    select count(*) into v_accepted_count
    from public.job_assignments a
    where a.job_id = p_job_id
      and a.ref_id <> p_ref_id
      and a.status in ('accepted', 'needs_reconfirm');

    if v_accepted_count >= v_job.crew_size then
      raise exception 'Crew is already full';
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
  end if;

  update public.job_assignments
  set status = v_next_status, responded_at = now()
  where job_id = p_job_id and ref_id = p_ref_id and status = 'pending';

  if p_accept then
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

-- Material schedule/pay changes always require confirmed referees to consent
-- again, regardless of which client performed the edit.
create or replace function public.reconfirm_assignments_after_job_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.starts_at is distinct from new.starts_at
     or old.venue_name is distinct from new.venue_name
     or old.venue_city is distinct from new.venue_city
     or old.venue_state is distinct from new.venue_state
     or old.pay_per_game is distinct from new.pay_per_game then
    update public.job_assignments
    set status = 'needs_reconfirm', responded_at = null
    where job_id = new.id and status = 'accepted';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_jobs_reconfirm_assignments on public.jobs;
create trigger trg_jobs_reconfirm_assignments
  after update of starts_at, venue_name, venue_city, venue_state, pay_per_game
  on public.jobs
  for each row execute function public.reconfirm_assignments_after_job_change();

create or replace function public.complete_game(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
  v_full_pay integer;
  v_ref_ids jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select j.id, j.title, j.status, j.starts_at, j.pay_per_game, j.num_games
  into v_job
  from public.jobs j
  join public.hirers h on h.id = j.hirer_id
  where j.id = p_job_id and h.user_id = (select auth.uid())
  for update of j;

  if v_job.id is null then
    raise exception 'Director game not found';
  end if;
  if v_job.status in ('completed', 'cancelled') then
    raise exception 'Game is already closed';
  end if;
  if v_job.starts_at > now() then
    raise exception 'Cannot complete a game before it starts';
  end if;

  v_full_pay := v_job.pay_per_game * coalesce(v_job.num_games, 1);

  update public.jobs
  set status = 'completed', completed_at = now()
  where id = p_job_id;

  with changed as (
    update public.job_assignments
    set status = 'completed', amount_due = v_full_pay
    where job_id = p_job_id and status in ('accepted', 'needs_reconfirm')
    returning ref_id
  )
  select coalesce(jsonb_agg(ref_id), '[]'::jsonb) into v_ref_ids from changed;

  return jsonb_build_object(
    'title', v_job.title,
    'amount_due', v_full_pay,
    'ref_ids', v_ref_ids
  );
end;
$$;

create or replace function public.cancel_game(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
  v_late boolean;
  v_fee integer;
  v_ref_ids jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select j.id, j.title, j.status, j.starts_at, j.pay_per_game, j.num_games
  into v_job
  from public.jobs j
  join public.hirers h on h.id = j.hirer_id
  where j.id = p_job_id and h.user_id = (select auth.uid())
  for update of j;

  if v_job.id is null then
    raise exception 'Director game not found';
  end if;
  if v_job.status in ('completed', 'cancelled') then
    raise exception 'Game is already closed';
  end if;

  v_late := (v_job.starts_at - now()) < interval '1 hour';
  v_fee := case
    when v_late then round(v_job.pay_per_game * coalesce(v_job.num_games, 1) * 0.5)::integer
    else 0
  end;

  update public.jobs
  set status = 'cancelled', cancelled_at = now()
  where id = p_job_id;

  with changed as (
    update public.job_assignments
    set status = 'cancelled', amount_due = v_fee
    where job_id = p_job_id and status in ('accepted', 'needs_reconfirm')
    returning ref_id
  )
  select coalesce(jsonb_agg(ref_id), '[]'::jsonb) into v_ref_ids from changed;

  update public.job_assignments
  set status = 'cancelled', amount_due = 0
  where job_id = p_job_id and status in ('pending', 'offered');

  return jsonb_build_object(
    'title', v_job.title,
    'fee_paid', v_late,
    'fee_amount', v_fee,
    'ref_ids', v_ref_ids
  );
end;
$$;

revoke all on function public.invite_existing_ref_to_roster(uuid) from public, anon;
revoke all on function public.remove_ref_from_roster(uuid) from public, anon;
revoke all on function public.respond_to_roster_invite(uuid, boolean) from public, anon;
revoke all on function public.set_assignor_staffing_mode(uuid, text) from public, anon;
revoke all on function public.offer_ref_to_game(uuid, uuid, text) from public, anon;
revoke all on function public.remove_ref_from_assignor_game(uuid) from public, anon;
revoke all on function public.respond_to_job(uuid, boolean) from public, anon;
revoke all on function public.director_respond_to_application(uuid, uuid, boolean) from public, anon;
revoke all on function public.director_invite_assignor(uuid, uuid, text, integer, numeric) from public, anon;
revoke all on function public.submit_assignor_proposal(uuid, text, integer, numeric, text) from public, anon;
revoke all on function public.withdraw_assignor_proposal(uuid) from public, anon;
revoke all on function public.director_respond_to_assignor_proposal(uuid, boolean) from public, anon;
revoke all on function public.reconfirm_assignments_after_job_change() from public, anon, authenticated;
revoke all on function public.complete_game(uuid) from public, anon;
revoke all on function public.cancel_game(uuid) from public, anon;

grant execute on function public.invite_existing_ref_to_roster(uuid) to authenticated;
grant execute on function public.remove_ref_from_roster(uuid) to authenticated;
grant execute on function public.respond_to_roster_invite(uuid, boolean) to authenticated;
grant execute on function public.set_assignor_staffing_mode(uuid, text) to authenticated;
grant execute on function public.offer_ref_to_game(uuid, uuid, text) to authenticated;
grant execute on function public.remove_ref_from_assignor_game(uuid) to authenticated;
grant execute on function public.respond_to_job(uuid, boolean) to authenticated;
grant execute on function public.director_respond_to_application(uuid, uuid, boolean) to authenticated;
grant execute on function public.director_invite_assignor(uuid, uuid, text, integer, numeric) to authenticated;
grant execute on function public.submit_assignor_proposal(uuid, text, integer, numeric, text) to authenticated;
grant execute on function public.withdraw_assignor_proposal(uuid) to authenticated;
grant execute on function public.director_respond_to_assignor_proposal(uuid, boolean) to authenticated;
grant execute on function public.complete_game(uuid) to authenticated;
grant execute on function public.cancel_game(uuid) to authenticated;
