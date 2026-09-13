-- =============================================================
-- REFEE — MIGRATION 0023: let a conversation creator read their own row
-- Bug: a referee tapping MESSAGE CREW inserts a conversation and then reads it
-- back (.insert().select()), but they aren't a participant yet, so the
-- participant-only SELECT policy hid the just-inserted row → PostgREST reports
-- "new row violates row-level security policy for table conversations".
-- Fix: allow SELECT when you created the row OR you're a participant. The insert
-- WITH CHECK already restricts created_by = auth.uid(), so this can't leak
-- others' conversations.
-- =============================================================

drop policy if exists "participants read conversations" on public.conversations;

create policy "creator or participant reads conversations"
  on public.conversations for select
  using (
    created_by = auth.uid()
    or public.is_conversation_participant(id, auth.uid())
  );
