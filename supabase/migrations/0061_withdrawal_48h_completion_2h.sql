-- 0061 · Two product rules, decided Oct 3, 2026.
--
--  1. Withdrawing from a game is free until 48 hours before tip-off (was 24).
--     Inside 48 hours it is recorded as a late withdrawal, as before. What a
--     late withdrawal costs is still undecided (TRUST-02); only the window moves.
--
--  2. A game completes automatically 2 hours after it ends (was 24). Completing
--     it locks in each confirmed referee's pay, which is what puts the money in
--     the referee's balance. Nothing waits on the director to confirm.
--
-- Same function bodies as 0013 / 0017 apart from the two intervals. Both keep
-- their hardened settings from 0039 (empty search_path, so every object is
-- schema-qualified). CREATE OR REPLACE keeps their existing grants.

create or replace function public.sweep_game_lifecycle()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 1. Auto-complete games 2 hours after they end
  update public.jobs
  set status = 'completed', completed_at = now()
  where status not in ('completed', 'cancelled')
    and starts_at
        + make_interval(mins => coalesce(duration_minutes, 120))
        + interval '2 hours' < now();

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
