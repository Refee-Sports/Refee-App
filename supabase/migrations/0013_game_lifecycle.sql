-- =============================================================
-- REFEE — MIGRATION 0013: GAME LIFECYCLE
-- Completion (manual + auto after 24h), cancellation with late
-- fee, referee withdrawal tracking.
-- =============================================================

alter table public.jobs
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz;

alter table public.job_assignments
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrew_late boolean default false;

-- =============================================================
-- MISSING POLICY FIX
-- Hirers could read assignments on their jobs but had no UPDATE
-- policy — approve/decline/complete/cancel silently no-oped.
-- =============================================================
drop policy if exists "hirers can update assignments on their jobs" on public.job_assignments;
create policy "hirers can update assignments on their jobs"
  on public.job_assignments for update
  to authenticated
  using (
    exists (
      select 1 from public.jobs j
      join public.hirers h on h.id = j.hirer_id
      where j.id = job_assignments.job_id
      and h.user_id = auth.uid()
    )
  );

-- =============================================================
-- AUTO-COMPLETE SWEEP
-- Any game still not completed/cancelled 24 hours after its
-- scheduled end gets marked completed, and its confirmed refs'
-- assignments become completed with pay locked in.
-- Runs via pg_cron when available; the app also calls it as an
-- RPC on screen focus as a fallback.
-- =============================================================
create or replace function public.sweep_game_lifecycle()
returns void
language plpgsql
security definer
as $$
begin
  -- 1. Auto-complete overdue games
  update public.jobs
  set status = 'completed', completed_at = now()
  where status not in ('completed', 'cancelled')
    and starts_at
        + make_interval(mins => coalesce(duration_minutes, 120))
        + interval '24 hours' < now();

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

grant execute on function public.sweep_game_lifecycle() to authenticated;

-- =============================================================
-- REFEREE WITHDRAWAL
-- Security definer because the ref must also reopen the job slot,
-- which their RLS grants don't allow directly.
-- Free >24h before tip-off; inside 24h it's flagged late.
-- =============================================================
create or replace function public.withdraw_from_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_job record;
  v_late boolean;
  v_accepted_count integer;
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

  v_late := (v_job.starts_at - now()) < interval '24 hours';

  update public.job_assignments
  set status = 'withdrawn', withdrawn_at = now(), withdrew_late = v_late
  where job_id = p_job_id
    and ref_id = auth.uid()
    and status in ('accepted', 'needs_reconfirm');

  if not found then
    return jsonb_build_object('error', 'You are not confirmed on this game.');
  end if;

  -- Reopen the slot for other refs
  select count(*) into v_accepted_count
  from public.job_assignments
  where job_id = p_job_id and status = 'accepted';

  update public.jobs
  set status = case when v_accepted_count = 0 then 'open' else 'partially_filled' end
  where id = p_job_id;

  -- Notify the crew thread
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

grant execute on function public.withdraw_from_job(uuid) to authenticated;

-- Schedule hourly if pg_cron is available (hosted Supabase); local dev
-- falls back to the client RPC call.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'sweep-game-lifecycle',
    '7 * * * *',
    'select public.sweep_game_lifecycle()'
  );
exception when others then
  raise notice 'pg_cron unavailable — sweep_game_lifecycle runs via client RPC only';
end;
$$;
