-- Crew messaging closes 24 hours after a game's scheduled end (start plus its
-- booked length, 2 hours when unset). After that:
--   * refs can no longer post in the game's crew chat (game_crew)
--   * only the game's director can post a crew note (director_crew_note), and
--     only while the game has a payment issue — the same issues the director's
--     dashboard lists: a declined card, an open dispute, a payment under
--     review, or a ref still owed past the payout window.
-- History stays readable.

create or replace function public.crew_chat_open(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.jobs j
    where j.id = p_job_id
      and now() < j.starts_at + make_interval(mins => coalesce(j.duration_minutes, 120)) + interval '24 hours'
  );
$$;

create or replace function public.game_has_payment_issue(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.jobs j
    where j.id = p_job_id
      and (
        j.payment_status = 'failed'
        or j.payment_dispute_status = 'open'
        or coalesce(j.payment_issue_requires_review, false)
        or (
          j.status = 'completed'
          and now() > coalesce(
                j.completed_at,
                j.starts_at + make_interval(mins => coalesce(j.duration_minutes, 120)) + interval '1 hour'
              ) + make_interval(hours => coalesce(j.payout_window_hours, 48))
          and exists (
            select 1 from public.job_assignments a
            where a.job_id = j.id and a.status = 'completed'
              and coalesce(a.payout_status, 'pending') not in ('paid', 'processing')
          )
        )
      )
  );
$$;

revoke all on function public.crew_chat_open(uuid) from public, anon;
revoke all on function public.game_has_payment_issue(uuid) from public, anon;
grant execute on function public.crew_chat_open(uuid) to authenticated;
grant execute on function public.game_has_payment_issue(uuid) to authenticated;

-- Same as 0057, plus: a game's crew chat takes no new messages once closed.
create or replace function public.can_send_to_conversation(p_conversation_id uuid, p_sender_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
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
          c.kind in ('director_crew_note', 'roster_blast')
          or not coalesce((
            (sender.primary_role = 'referee' and target.primary_role in ('referee', 'assignor'))
            or (sender.primary_role = 'director' and target.primary_role = 'referee')
            or (sender.primary_role = 'assignor' and target.primary_role = 'referee')
          ), false)
        )
    )
    and not exists (
      select 1
      from public.conversations c
      where c.id = p_conversation_id
        and c.kind = 'game_crew'
        and c.job_id is not null
        and not public.crew_chat_open(c.job_id)
    );
$$;

-- Same as before, plus the window: a note after it only for a payment issue.
create or replace function public.post_crew_note(p_job_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_caller uuid := auth.uid();
  v_convo uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_caller is null then raise exception 'Not authenticated'; end if;
  if length(v_body) = 0 then raise exception 'Note is empty'; end if;
  if length(v_body) > 4000 then v_body := left(v_body, 4000); end if;

  if not exists (select 1 from public.jobs where id = p_job_id) then
    raise exception 'Game not found';
  end if;
  if not public.can_manage_crew_note(p_job_id, v_caller) then
    raise exception 'Not your game';
  end if;
  -- After the window only the game's director, and only for a payment issue.
  if not public.crew_chat_open(p_job_id)
     and not (
       public.game_has_payment_issue(p_job_id)
       and exists (
         select 1 from public.jobs j join public.hirers h on h.id = j.hirer_id
         where j.id = p_job_id and h.user_id = v_caller
       )
     ) then
    raise exception 'Crew messages closed 24 hours after this game. You can still message the crew about a payment issue.'
      using errcode = '42501';
  end if;

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
