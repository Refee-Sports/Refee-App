-- =============================================================
-- REFEE — MIGRATION 0024: get_or_create_crew_thread RPC
-- Bug: a referee tapping MESSAGE CREW created the conversation but the client
-- then failed (RLS 42501) to insert participants — the creator-adds-participants
-- policy didn't hold in practice — leaving an EMPTY, read-only crew thread
-- (canSendInConversation saw no other participants → "your role cannot reply").
-- Fix: create + populate the crew thread in one SECURITY DEFINER RPC (mirrors
-- post_crew_note), so participants are added reliably regardless of RLS.
-- =============================================================

create or replace function public.get_or_create_crew_thread(p_job_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_convo uuid;
begin
  if v_caller is null then raise exception 'Not authenticated'; end if;

  -- caller must be on this crew
  if not exists (
    select 1 from public.job_assignments a
    where a.job_id = p_job_id and a.ref_id = v_caller
      and a.status in ('accepted', 'needs_reconfirm', 'completed')
  ) then
    raise exception 'Not on this crew';
  end if;

  insert into public.conversations (kind, job_id, created_by)
  values ('game_crew', p_job_id, v_caller)
  on conflict (job_id, kind) do nothing;

  select id into v_convo
  from public.conversations
  where job_id = p_job_id and kind = 'game_crew';

  -- add all crew refs as participants (director is not added — one-way notes)
  insert into public.conversation_participants (conversation_id, user_id)
  select v_convo, a.ref_id
  from public.job_assignments a
  where a.job_id = p_job_id
    and a.status in ('accepted', 'needs_reconfirm', 'completed')
  on conflict (conversation_id, user_id) do nothing;

  return v_convo;
end;
$$;

grant execute on function public.get_or_create_crew_thread(uuid) to authenticated;
