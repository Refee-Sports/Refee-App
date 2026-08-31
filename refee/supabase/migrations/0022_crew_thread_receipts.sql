-- =============================================================
-- REFEE — MIGRATION 0022: CREW THREAD + READ RECEIPTS (director view)
-- The director isn't a participant in the crew thread (one-way messaging), so
-- the thread never shows in their Messages inbox. This SECURITY DEFINER RPC
-- lets the game owner read back the crew messages they've sent AND per-ref read
-- receipts (who has seen the latest message) — surfaced on the game detail.
-- =============================================================

create or replace function public.get_crew_thread(p_job_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_hirer_user uuid;
  v_convo uuid;
  v_last timestamptz;
  v_messages json;
  v_receipts json;
begin
  if v_caller is null then raise exception 'Not authenticated'; end if;

  -- caller must own the game
  select h.user_id into v_hirer_user
  from public.jobs j
  join public.hirers h on h.id = j.hirer_id
  where j.id = p_job_id;
  if v_hirer_user is null or v_hirer_user <> v_caller then
    raise exception 'Not your game';
  end if;

  select id, last_message_at into v_convo, v_last
  from public.conversations
  where job_id = p_job_id and kind = 'game_crew';

  if v_convo is null then
    return json_build_object(
      'conversationId', null, 'lastMessageAt', null,
      'messages', '[]'::json, 'receipts', '[]'::json
    );
  end if;

  select coalesce(json_agg(
    json_build_object('id', m.id, 'senderId', m.sender_id, 'body', m.body, 'createdAt', m.created_at)
    order by m.created_at
  ), '[]'::json)
  into v_messages
  from public.messages m
  where m.conversation_id = v_convo;

  select coalesce(json_agg(
    json_build_object('refId', cp.user_id, 'displayName', pp.display_name, 'lastReadAt', cp.last_read_at)
  ), '[]'::json)
  into v_receipts
  from public.conversation_participants cp
  join public.public_profiles pp on pp.id = cp.user_id
  where cp.conversation_id = v_convo;

  return json_build_object(
    'conversationId', v_convo,
    'lastMessageAt', v_last,
    'messages', v_messages,
    'receipts', v_receipts
  );
end;
$$;

grant execute on function public.get_crew_thread(uuid) to authenticated;
