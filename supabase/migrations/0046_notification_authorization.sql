-- Who is allowed to send a push notification to whom.
--
-- send-push used to take a list of user ids from the caller and send to all of
-- them. Any signed-in account could read every id out of public_profiles and
-- push arbitrary text — with an arbitrary deep-link payload — to the whole
-- platform. A phishing notification that looks like it came from Refee is the
-- obvious use.
--
-- A notification is only legitimate when the two people already have a working
-- relationship: they share a conversation, a game, a roster, or a tournament.
-- That is what this file encodes, and send-push now filters every request
-- through it.

-- True when p_caller has standing to notify p_target.
--
-- Security definer because the caller is the backend (service role) acting on
-- behalf of a user: it has to look across tables that neither party can read in
-- full. It answers one boolean and reveals nothing else.
create or replace function public.can_notify(p_caller uuid, p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_caller is not null and p_target is not null and (
      -- Notifying yourself is always fine (your own device, your own action).
      p_caller = p_target

      -- They are in a conversation together.
      or exists (
        select 1
          from public.conversation_participants a
          join public.conversation_participants b
            on b.conversation_id = a.conversation_id
         where a.user_id = p_caller
           and b.user_id = p_target
      )

      -- One of them works a game the other posted.
      or exists (
        select 1
          from public.job_assignments ja
          join public.jobs j on j.id = ja.job_id
          join public.hirers h on h.id = j.hirer_id
         where (ja.ref_id = p_caller and h.user_id = p_target)
            or (ja.ref_id = p_target and h.user_id = p_caller)
      )

      -- One of them works a game on a tournament the other staffs.
      or exists (
        select 1
          from public.job_assignments ja
          join public.jobs j on j.id = ja.job_id
          join public.tournaments t on t.id = j.tournament_id
         where t.assignor_id is not null
           and ( (ja.ref_id = p_caller and t.assignor_id = p_target)
              or (ja.ref_id = p_target and t.assignor_id = p_caller) )
      )

      -- They are on a roster together, in either direction, at any stage:
      -- the invite itself is a notification worth sending.
      or exists (
        select 1
          from public.assignor_rosters r
         where (r.assignor_id = p_caller and r.ref_id = p_target)
            or (r.assignor_id = p_target and r.ref_id = p_caller)
      )

      -- The director and the assignor of the same tournament, including while
      -- a proposal is still being negotiated.
      or exists (
        select 1
          from public.tournaments t
          join public.hirers h on h.id = t.hirer_id
         where t.assignor_id is not null
           and ( (t.assignor_id = p_caller and h.user_id = p_target)
              or (t.assignor_id = p_target and h.user_id = p_caller) )
      )

      -- An assignor who has proposed on a tournament can reach its director
      -- before the proposal is accepted and written onto the tournament.
      or exists (
        select 1
          from public.assignor_proposals p
          join public.tournaments t on t.id = p.tournament_id
          join public.hirers h on h.id = t.hirer_id
         where (p.assignor_id = p_caller and h.user_id = p_target)
            or (p.assignor_id = p_target and h.user_id = p_caller)
      )
    );
$$;

comment on function public.can_notify(uuid, uuid) is
  'True when p_caller shares a conversation, game, roster or tournament with p_target and may therefore notify them.';

-- The subset of p_targets that p_caller may notify. send-push sends to exactly
-- this set, so an id the caller has no business reaching is dropped rather than
-- delivered.
create or replace function public.notifiable_user_ids(p_caller uuid, p_targets uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id
    from unnest(p_targets) as t(id)
   where public.can_notify(p_caller, t.id);
$$;

comment on function public.notifiable_user_ids(uuid, uuid[]) is
  'Filters a list of notification targets down to the ones p_caller is allowed to reach.';

-- Backend only. These answer questions about relationships the apps cannot see
-- in full, so they are not exposed through PostgREST.
revoke all on function public.can_notify(uuid, uuid) from public, anon, authenticated;
revoke all on function public.notifiable_user_ids(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.can_notify(uuid, uuid) to service_role;
grant execute on function public.notifiable_user_ids(uuid, uuid[]) to service_role;
