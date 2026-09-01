-- =============================================================
-- REFEE — MIGRATION 0024: ROLE-ENFORCED MESSAGING
-- Separates one-way director announcements from referee crew chat
-- and enforces directional role rules at the database boundary.
-- =============================================================

alter table public.conversations
  drop constraint if exists conversations_kind_check;

alter table public.conversations
  add constraint conversations_kind_check
  check (kind in ('dm', 'game_crew', 'director_crew_note'));

-- Preserve existing data: move messages authored by the game's director out
-- of a shared crew thread and into a dedicated read-only announcement thread.
insert into public.conversations (kind, job_id, created_by, created_at, last_message_at)
select
  'director_crew_note',
  c.job_id,
  h.user_id,
  min(m.created_at),
  max(m.created_at)
from public.conversations c
join public.jobs j on j.id = c.job_id
join public.hirers h on h.id = j.hirer_id
join public.messages m on m.conversation_id = c.id and m.sender_id = h.user_id
where c.kind = 'game_crew'
group by c.job_id, h.user_id
on conflict (job_id, kind) do nothing;

update public.messages m
set conversation_id = notes.id
from public.conversations crew
join public.jobs j on j.id = crew.job_id
join public.hirers h on h.id = j.hirer_id
join public.conversations notes
  on notes.job_id = crew.job_id and notes.kind = 'director_crew_note'
where m.conversation_id = crew.id
  and crew.kind = 'game_crew'
  and m.sender_id = h.user_id;

-- Announcement readers are the game's crew, including lifecycle states in
-- which a director may still need to send an operational update.
insert into public.conversation_participants (conversation_id, user_id)
select notes.id, a.ref_id
from public.conversations notes
join public.job_assignments a on a.job_id = notes.job_id
where notes.kind = 'director_crew_note'
  and a.status in ('accepted', 'needs_reconfirm', 'completed', 'cancelled')
on conflict (conversation_id, user_id) do nothing;

-- Repair freshness after moving historical messages.
update public.conversations c
set last_message_at = coalesce(
  (select max(m.created_at) from public.messages m where m.conversation_id = c.id),
  c.created_at
)
where c.kind in ('game_crew', 'director_crew_note');

-- Directional server rule mirroring lib/messages/permissions.ts. Regular
-- inserts into director_crew_note are always denied; directors post there only
-- through the ownership-checking post_crew_note RPC below.
create or replace function public.can_send_to_conversation(
  p_conversation_id uuid,
  p_sender_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (
      select 1
      from public.conversation_participants self
      where self.conversation_id = p_conversation_id
        and self.user_id = p_sender_id
    )
    and exists (
      select 1
      from public.conversation_participants recipient
      where recipient.conversation_id = p_conversation_id
        and recipient.user_id <> p_sender_id
    )
    and not exists (
      select 1
      from public.conversation_participants recipient
      join public.public_profiles sender on sender.id = p_sender_id
      join public.public_profiles target on target.id = recipient.user_id
      join public.conversations c on c.id = p_conversation_id
      where recipient.conversation_id = p_conversation_id
        and recipient.user_id <> p_sender_id
        and (
          c.kind = 'director_crew_note'
          or not coalesce((
            (sender.primary_role = 'referee' and target.primary_role in ('referee', 'assignor'))
            or (sender.primary_role = 'director' and target.primary_role = 'referee')
            or (sender.primary_role = 'assignor' and target.primary_role = 'referee')
          ), false)
        )
    );
$$;

drop policy if exists "participants send messages" on public.messages;
drop policy if exists "role-allowed participants send messages" on public.messages;

create policy "role-allowed participants send messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.can_send_to_conversation(conversation_id, auth.uid())
  );

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

  select h.user_id into v_hirer_user
  from public.jobs j
  join public.hirers h on h.id = j.hirer_id
  where j.id = p_job_id;

  if v_hirer_user is null then raise exception 'Game not found'; end if;
  if v_hirer_user <> v_caller then raise exception 'Not your game'; end if;

  insert into public.conversations (kind, job_id, created_by)
  values ('director_crew_note', p_job_id, v_caller)
  on conflict (job_id, kind) do nothing;

  select id into v_convo
  from public.conversations
  where job_id = p_job_id and kind = 'director_crew_note';

  insert into public.conversation_participants (conversation_id, user_id)
  select v_convo, a.ref_id
  from public.job_assignments a
  where a.job_id = p_job_id
    and a.status in ('accepted', 'needs_reconfirm', 'completed', 'cancelled')
  on conflict (conversation_id, user_id) do nothing;

  insert into public.messages (conversation_id, sender_id, body)
  values (v_convo, v_caller, v_body);

  return v_convo;
end;
$$;

grant execute on function public.post_crew_note(uuid, text) to authenticated;

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

  select h.user_id into v_hirer_user
  from public.jobs j
  join public.hirers h on h.id = j.hirer_id
  where j.id = p_job_id;
  if v_hirer_user is null or v_hirer_user <> v_caller then
    raise exception 'Not your game';
  end if;

  select id, last_message_at into v_convo, v_last
  from public.conversations
  where job_id = p_job_id and kind = 'director_crew_note';

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
