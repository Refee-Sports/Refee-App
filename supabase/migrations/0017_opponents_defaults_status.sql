-- =============================================================
-- REFEE — MIGRATION 0017
-- 1. Games identified by Home vs Away teams (replaces free-text title)
-- 2. Tournament-level defaults that cascade to games (format, uniform)
-- 3. Simplified status: open / staffed (+ completed / cancelled)
-- =============================================================

-- 1. Opponents on games ------------------------------------------------------
alter table public.jobs
  add column if not exists home_team text,
  add column if not exists away_team text;

-- 2. Tournament-level defaults (ruleset already added in 0012) ---------------
alter table public.tournaments
  add column if not exists game_format text check (game_format in ('quarters', 'halves')),
  add column if not exists period_minutes integer,
  add column if not exists uniform_requirements text;

-- 3. Status simplification ---------------------------------------------------
-- Games (jobs.status is free text): collapse to open / staffed.
-- (completed / cancelled are set by the lifecycle flow in 0013 and preserved.)
update public.jobs set status = 'open'
  where status in ('draft', 'partially_filled', 'staffing');
update public.jobs set status = 'staffed'
  where status in ('filled', 'in_progress');

-- Tournaments (has a strict check constraint from 0004): swap it out.
alter table public.tournaments drop constraint if exists tournaments_status_check;

update public.tournaments set status = 'open'
  where status in ('draft', 'staffing');
update public.tournaments set status = 'staffed'
  where status = 'in_progress';

alter table public.tournaments
  add constraint tournaments_status_check
  check (status in ('open', 'staffed', 'completed', 'cancelled'));

alter table public.tournaments alter column status set default 'open';

-- Redefine withdraw_from_job for the simplified status model:
-- a withdrawal always leaves an open slot, so the game returns to 'open'.
create or replace function public.withdraw_from_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
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

  v_late := (v_job.starts_at - now()) < interval '24 hours';

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
