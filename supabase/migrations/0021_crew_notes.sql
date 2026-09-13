-- =============================================================
-- REFEE — MIGRATION 0021: ONE-WAY CREW NOTES
-- Directors broadcast to a game's crew WITHOUT joining a two-way thread —
-- referees can't message directors (keeps the director inbox from becoming a
-- distraction). SECURITY DEFINER so the director can post into the crew thread
-- without being a participant, and so directors stop creating conversations
-- from the client (which was tripping the conversations RLS insert policy →
-- "new row violates row-level security policy for table conversations").
-- =============================================================

create or replace function public.post_crew_note(p_job_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_hirer_user uuid;
  v_convo uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_caller is null then raise exception 'Not authenticated'; end if;
  if length(v_body) = 0 then raise exception 'Note is empty'; end if;
  if length(v_body) > 4000 then v_body := left(v_body, 4000); end if;

  -- caller must own the game (be its hirer)
  select h.user_id into v_hirer_user
  from public.jobs j
  join public.hirers h on h.id = j.hirer_id
  where j.id = p_job_id;

  if v_hirer_user is null then raise exception 'Game not found'; end if;
  if v_hirer_user <> v_caller then raise exception 'Not your game'; end if;

  -- find or create the crew thread (unique per job_id + kind)
  insert into public.conversations (kind, job_id, created_by)
  values ('game_crew', p_job_id, v_caller)
  on conflict (job_id, kind) do nothing;

  select id into v_convo
  from public.conversations
  where job_id = p_job_id and kind = 'game_crew';

  -- the crew are participants so they can read the note; the director is
  -- intentionally NOT added (one-way — refs never message the director back).
  -- Include refs across the game's lifecycle (a note may be posted after the
  -- game is completed/cancelled), not just those still 'accepted'.
  insert into public.conversation_participants (conversation_id, user_id)
  select v_convo, a.ref_id
  from public.job_assignments a
  where a.job_id = p_job_id
    and a.status in ('accepted', 'needs_reconfirm', 'completed', 'cancelled')
  on conflict (conversation_id, user_id) do nothing;

  -- post the note as the director
  insert into public.messages (conversation_id, sender_id, body)
  values (v_convo, v_caller, v_body);

  return v_convo;
end;
$$;

grant execute on function public.post_crew_note(uuid, text) to authenticated;
