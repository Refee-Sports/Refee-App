-- 0039 · Backend functions: least privilege, pinned search paths, and refs
-- reconfirm when a game's street address changes.

-- 1. The lifecycle sweep runs on a schedule as the backend; apps and
--    visitors had EXECUTE through the default PUBLIC grant.
revoke execute on function public.sweep_game_lifecycle() from public, anon, authenticated;

-- 2. Crew chat, withdrawing and the messaging checks are for signed-in users
--    only (they refused signed-out callers, but needn't be reachable).
revoke execute on function
  public.can_send_to_conversation(uuid, uuid),
  public.is_conversation_participant(uuid, uuid),
  public.get_crew_thread(uuid),
  public.get_or_create_crew_thread(uuid),
  public.post_crew_note(uuid, text),
  public.withdraw_from_job(uuid)
from public, anon;
grant execute on function
  public.can_send_to_conversation(uuid, uuid),
  public.is_conversation_participant(uuid, uuid),
  public.get_crew_thread(uuid),
  public.get_or_create_crew_thread(uuid),
  public.post_crew_note(uuid, text),
  public.withdraw_from_job(uuid)
to authenticated;

-- The conversations read policy applied to every role, including signed-out
-- visitors; it calls is_conversation_participant, which they can no longer run.
drop policy if exists "creator or participant reads conversations" on public.conversations;
create policy "creator or participant reads conversations" on public.conversations
  for select to authenticated
  using (created_by = (select auth.uid()) or public.is_conversation_participant(id, (select auth.uid())));

-- 3. Security-definer functions pin an empty search path so nothing on the
--    caller's path can shadow the tables they touch (all names are qualified).
alter function public.bump_conversation_last_message() set search_path = '';
alter function public.is_conversation_participant(uuid, uuid) set search_path = '';
alter function public.recompute_ref_rating() set search_path = '';
alter function public.sweep_game_lifecycle() set search_path = '';
alter function public.withdraw_from_job(uuid) set search_path = '';

-- 4. Refs agreed to a place as well as a time and pay: a new street address or
--    ZIP now asks confirmed refs to reconfirm, as the apps already tell the
--    director it does.
create or replace function public.reconfirm_assignments_after_job_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.starts_at is distinct from new.starts_at
     or old.venue_name is distinct from new.venue_name
     or old.venue_address is distinct from new.venue_address
     or old.venue_zip is distinct from new.venue_zip
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

-- The trigger fires only for the columns it lists, so it has to name the
-- address fields too.
drop trigger if exists trg_jobs_reconfirm_assignments on public.jobs;
create trigger trg_jobs_reconfirm_assignments
  after update of starts_at, venue_name, venue_address, venue_zip, venue_city, venue_state, pay_per_game
  on public.jobs
  for each row execute function public.reconfirm_assignments_after_job_change();

-- 5. Only a conversation's creator adds people to it. The old rule also let
--    any signed-in user add themselves to any conversation, and so read it.
--    Crew threads add their members through security-definer functions.
drop policy if exists "conversation creator adds participants" on public.conversation_participants;
create policy "conversation creator adds participants" on public.conversation_participants
  for insert to authenticated
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_participants.conversation_id
        and c.created_by = (select auth.uid())
    )
  );
