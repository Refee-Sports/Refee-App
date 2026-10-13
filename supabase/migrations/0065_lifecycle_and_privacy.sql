-- 0065 · Lifecycle and privacy fixes from the referee and director simulations.
--
--  1. A game completes automatically 1 hour after its scheduled end (was 2). A
--     standard 2-hour game therefore completes 3 hours after tip-off.
--  2. No withdrawing once a game has started (the no-show path covers that).
--  3. The accepted assignor of an event can complete and cancel its games, like
--     the director. cancel_game also returns the refs who had applied or been
--     offered the game, so they can be told it is off.
--  4. cancel_tournament cancels every game still open in an event, then the
--     event itself.
--  5. When a ref is confirmed on a game, their pending applications to games
--     that overlap it are closed (they used to sit pending forever).
--  6. Privacy:
--     * ratings: readable by the director who wrote them; a ref sees the scores
--       they received through my_ratings(), without the director's comment.
--     * certifications (license numbers): the ref, plus organizers the ref has
--       applied to / worked for / is on the roster of.
--     * avatars: files are still served by public URL, but the bucket can no
--       longer be listed by everyone.
--
-- Cancellation fees are unchanged here (payment rules come later).

-- =============================================================================
-- Who runs a game: its director, or the accepted assignor of its event.
-- =============================================================================
create or replace function public.is_game_organizer(p_job_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null and exists (
    select 1
    from public.jobs j
    join public.hirers h on h.id = j.hirer_id
    left join public.tournaments t on t.id = j.tournament_id
    where j.id = p_job_id
      and (h.user_id = p_user or (t.assignor_status = 'accepted' and t.assignor_id = p_user))
  );
$$;

revoke all on function public.is_game_organizer(uuid, uuid) from public, anon, authenticated;

-- =============================================================================
-- 1. Auto-complete 1 hour after the scheduled end
-- =============================================================================
create or replace function public.sweep_game_lifecycle()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 1. Auto-complete games 1 hour after they end
  update public.jobs
  set status = 'completed', completed_at = now()
  where status not in ('completed', 'cancelled')
    and starts_at
        + make_interval(mins => coalesce(duration_minutes, 120))
        + interval '1 hour' < now();

  -- 2. Lock in pay for confirmed refs on completed games
  --    (needs_reconfirm included: they were confirmed before a late edit
  --     and presumably worked; disputes handled manually)
  update public.job_assignments a
  set status = 'completed',
      amount_due = coalesce(a.amount_due, j.pay_per_game * coalesce(j.num_games, 1))
  from public.jobs j
  where a.job_id = j.id
    and j.status = 'completed'
    and a.status in ('accepted', 'needs_reconfirm');
end;
$$;

-- =============================================================================
-- 2. No withdrawing once the game has started
-- =============================================================================
create or replace function public.withdraw_from_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
  v_late boolean;
  v_convo_id uuid;
begin
  select id, title, starts_at, status into v_job
  from public.jobs where id = p_job_id;

  if v_job.id is null then
    return jsonb_build_object('error', 'Game not found');
  end if;
  if v_job.status in ('completed', 'cancelled') then
    return jsonb_build_object('error', 'This game is already closed.');
  end if;
  if v_job.starts_at <= now() then
    return jsonb_build_object('error',
      'This game has started, so you can no longer withdraw. Contact the organizer.');
  end if;

  v_late := (v_job.starts_at - now()) < interval '48 hours';

  update public.job_assignments
  set status = 'withdrawn', withdrawn_at = now(), withdrew_late = v_late
  where job_id = p_job_id
    and ref_id = auth.uid()
    and status in ('accepted', 'needs_reconfirm');

  if not found then
    return jsonb_build_object('error', 'You are not confirmed on this game.');
  end if;

  -- A slot just opened up
  update public.jobs set status = 'open' where id = p_job_id;

  select id into v_convo_id
  from public.conversations
  where job_id = p_job_id and kind = 'game_crew';

  if v_convo_id is not null then
    insert into public.messages (conversation_id, sender_id, body)
    values (
      v_convo_id,
      auth.uid(),
      'I''ve withdrawn from "' || v_job.title || '". The slot is open again.'
    );
  end if;

  return jsonb_build_object('late', v_late);
end;
$$;

-- =============================================================================
-- 3. Complete / cancel: director or the event's assignor
-- =============================================================================
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
  if not public.is_game_organizer(p_job_id, (select auth.uid())) then
    raise exception 'Director game not found';
  end if;

  select j.id, j.title, j.status, j.starts_at, j.pay_per_game, j.num_games
  into v_job
  from public.jobs j
  where j.id = p_job_id
  for update of j;

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
  v_pending_ids jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_game_organizer(p_job_id, (select auth.uid())) then
    raise exception 'Director game not found';
  end if;

  select j.id, j.title, j.status, j.starts_at, j.pay_per_game, j.num_games
  into v_job
  from public.jobs j
  where j.id = p_job_id
  for update of j;

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

  -- Applicants and offered refs are told too, so nobody keeps the date free.
  with changed as (
    update public.job_assignments
    set status = 'cancelled', amount_due = 0
    where job_id = p_job_id and status in ('pending', 'offered')
    returning ref_id
  )
  select coalesce(jsonb_agg(ref_id), '[]'::jsonb) into v_pending_ids from changed;

  return jsonb_build_object(
    'job_id', p_job_id,
    'title', v_job.title,
    'fee_paid', v_late,
    'fee_amount', v_fee,
    'ref_ids', v_ref_ids,
    'pending_ref_ids', v_pending_ids
  );
end;
$$;

-- =============================================================================
-- 4. Cancel a whole tournament (rain-out, venue lost)
-- =============================================================================
create or replace function public.cancel_tournament(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_t record;
  v_job_id uuid;
  v_games jsonb := '[]'::jsonb;
begin
  select t.id, t.name, t.status, h.user_id as director_id,
         case when t.assignor_status = 'accepted' then t.assignor_id end as assignor_id
  into v_t
  from public.tournaments t
  join public.hirers h on h.id = t.hirer_id
  where t.id = p_tournament_id
  for update of t;

  if v_caller is null or v_t.id is null
     or v_caller not in (v_t.director_id, coalesce(v_t.assignor_id, v_t.director_id)) then
    raise exception 'Only the organizer of this event can cancel it.' using errcode = '42501';
  end if;
  if v_t.status = 'cancelled' then
    raise exception 'This event is already cancelled.';
  end if;

  for v_job_id in
    select j.id from public.jobs j
    where j.tournament_id = p_tournament_id
      and j.status not in ('completed', 'cancelled')
    order by j.starts_at
  loop
    v_games := v_games || jsonb_build_array(public.cancel_game(v_job_id));
  end loop;

  update public.tournaments set status = 'cancelled' where id = p_tournament_id;

  return jsonb_build_object('name', v_t.name, 'games', v_games);
end;
$$;

revoke all on function public.cancel_tournament(uuid) from public, anon;
grant execute on function public.cancel_tournament(uuid) to authenticated;

-- =============================================================================
-- 5. Confirming a ref closes their overlapping pending applications
-- =============================================================================
create or replace function public.close_overlapping_applications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.job_assignments a
  set status = 'declined', responded_at = now()
  from public.jobs other, public.jobs this
  where this.id = new.job_id
    and a.ref_id = new.ref_id
    and a.job_id <> new.job_id
    and a.status = 'pending'
    and other.id = a.job_id
    and this.starts_at
        < other.starts_at + make_interval(mins => coalesce(other.duration_minutes, 120))
    and other.starts_at
        < this.starts_at + make_interval(mins => coalesce(this.duration_minutes, 120));
  return new;
end;
$$;

revoke all on function public.close_overlapping_applications() from public, anon, authenticated;

drop trigger if exists trg_close_overlapping_applications on public.job_assignments;
create trigger trg_close_overlapping_applications
  after insert or update of status on public.job_assignments
  for each row
  when (new.status = 'accepted')
  execute function public.close_overlapping_applications();

-- =============================================================================
-- 6a. Ratings
-- =============================================================================
drop policy if exists "anyone authenticated can read ratings" on public.ratings;
create policy "directors read the ratings they wrote"
  on public.ratings for select
  to authenticated
  using (
    exists (
      select 1 from public.hirers h
      where h.id = ratings.hirer_id and h.user_id = (select auth.uid())
    )
  );

-- What a ref sees about the ratings they received: the game, the date and the
-- three scores. The director's comment stays with the director.
create or replace function public.my_ratings()
returns table (
  job_id uuid,
  job_title text,
  game_date timestamptz,
  rating integer,
  on_time smallint,
  professionalism smallint,
  game_management smallint,
  rated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.job_id, j.title, j.starts_at, r.rating, r.on_time, r.professionalism,
         r.game_management, r.created_at
  from public.ratings r
  left join public.jobs j on j.id = r.job_id
  where r.ref_id = (select auth.uid())
  order by r.created_at desc;
$$;

revoke all on function public.my_ratings() from public, anon;
grant execute on function public.my_ratings() to authenticated;

-- =============================================================================
-- 6b. Certifications: the ref, and organizers who have a reason to check them
-- =============================================================================
create or replace function public.can_view_ref_details(p_ref_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    (select auth.uid()) = p_ref_id
    -- applied to, offered, or worked a game this person organizes
    or exists (
      select 1 from public.job_assignments a
      where a.ref_id = p_ref_id
        and public.is_game_organizer(a.job_id, (select auth.uid()))
    )
    -- on (or invited to) this assignor's roster
    or exists (
      select 1 from public.assignor_rosters r
      where r.ref_id = p_ref_id and r.assignor_id = (select auth.uid())
    )
  );
$$;

revoke all on function public.can_view_ref_details(uuid) from public, anon;
grant execute on function public.can_view_ref_details(uuid) to authenticated;

drop policy if exists "anyone authenticated can read certifications" on public.certifications;
create policy "refs and their organizers read certifications"
  on public.certifications for select
  to authenticated
  using (public.can_view_ref_details(ref_id));

-- =============================================================================
-- 6c. Avatars: served by public URL, not listable
-- =============================================================================
drop policy if exists "avatar images are publicly readable" on storage.objects;
-- Uploading with upsert reads the existing object, so owners keep select on
-- their own folder.
create policy "users read their own avatar object"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
