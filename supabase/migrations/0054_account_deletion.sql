-- In-app account deletion.
--
-- Authentication and personal profile data are removed. Historical game and
-- payment rows remain only where another participant or financial record
-- depends on them, with the deleted person detached from those rows.

create table public.account_deletion_receipts (
  id uuid primary key default gen_random_uuid(),
  user_fingerprint text not null unique,
  status text not null default 'prepared' check (status in ('prepared', 'completed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.account_deletion_receipts enable row level security;
revoke all on public.account_deletion_receipts from public, anon, authenticated;

-- Rows other people rely on become anonymous instead of blocking removal of
-- public_profiles/auth.users. Personal profile, role, roster, rating and push
-- rows still use their existing cascades and are deleted.
alter table public.job_assignments drop constraint job_assignments_ref_id_fkey;
alter table public.job_assignments
  add constraint job_assignments_ref_id_fkey
  foreign key (ref_id) references public.public_profiles(id) on delete set null;

alter table public.conversations alter column created_by drop not null;
alter table public.conversations drop constraint conversations_created_by_fkey;
alter table public.conversations
  add constraint conversations_created_by_fkey
  foreign key (created_by) references public.public_profiles(id) on delete set null;

alter table public.messages alter column sender_id drop not null;
alter table public.messages drop constraint messages_sender_id_fkey;
alter table public.messages
  add constraint messages_sender_id_fkey
  foreign key (sender_id) references public.public_profiles(id) on delete set null;

alter table public.tournaments drop constraint tournaments_assignor_id_fkey;
alter table public.tournaments
  add constraint tournaments_assignor_id_fkey
  foreign key (assignor_id) references public.public_profiles(id) on delete set null;

alter table public.hirers drop constraint hirers_user_id_fkey;
alter table public.hirers
  add constraint hirers_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.private_profiles drop constraint private_profiles_suspended_by_fkey;
alter table public.private_profiles
  add constraint private_profiles_suspended_by_fkey
  foreign key (suspended_by) references auth.users(id) on delete set null;

alter table public.admin_actions alter column admin_id drop not null;
alter table public.admin_actions drop constraint admin_actions_admin_id_fkey;
alter table public.admin_actions
  add constraint admin_actions_admin_id_fkey
  foreign key (admin_id) references auth.users(id) on delete set null;

alter table public.admin_actions drop constraint admin_actions_subject_user_id_fkey;
alter table public.admin_actions
  add constraint admin_actions_subject_user_id_fkey
  foreign key (subject_user_id) references auth.users(id) on delete set null;

alter table public.listing_deletions alter column deleted_by drop not null;

create or replace function public.prepare_account_deletion(
  p_user uuid,
  p_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_redacted_messages integer := 0;
  v_anonymized_hirers integer := 0;
begin
  if p_user is null or coalesce(trim(p_fingerprint), '') = '' then
    raise exception 'Invalid account deletion request.' using errcode = '22023';
  end if;

  -- Do not orphan a future crew position or money still owed to a referee.
  if exists (
    select 1
      from public.job_assignments a
      join public.jobs j on j.id = a.job_id
     where a.ref_id = p_user
       and (
         (a.status in ('accepted', 'needs_reconfirm') and j.status not in ('completed', 'cancelled'))
         or (coalesce(a.amount_due, 0) > 0 and coalesce(a.payout_status, 'pending') <> 'paid')
       )
  ) then
    raise exception 'Finish or withdraw from active games and resolve pending payouts before deleting your account.'
      using errcode = 'P0001';
  end if;

  -- A director must close active listings and settle money/disputes first.
  if exists (
    select 1
      from public.hirers h
      join public.jobs j on j.hirer_id = h.id
     where h.user_id = p_user
       and (
         j.status not in ('completed', 'cancelled')
         or j.payment_status in ('unpaid', 'processing', 'failed')
         or j.payment_dispute_status = 'open'
         or j.payment_issue_requires_review is true
       )
  ) then
    raise exception 'Close active listings and resolve payment issues before deleting your account.'
      using errcode = 'P0001';
  end if;

  -- An accepted assignor must hand off a tournament that has not ended.
  if exists (
    select 1
      from public.tournaments t
     where t.assignor_id = p_user
       and t.assignor_status = 'accepted'
       and t.ends_on >= current_date
       and coalesce(t.status, '') not in ('completed', 'cancelled')
  ) then
    raise exception 'Hand off active tournaments before deleting your account.'
      using errcode = 'P0001';
  end if;

  insert into public.account_deletion_receipts (user_fingerprint, status, requested_at)
  values (p_fingerprint, 'prepared', now())
  on conflict (user_fingerprint) do update
    set status = 'prepared', requested_at = now(), completed_at = null;

  -- User-written message content is personal data. Keep the conversation
  -- structure for the other participants, but not the deleted content.
  update public.messages
     set body = '[Account deleted]'
   where sender_id = p_user;
  get diagnostics v_redacted_messages = row_count;

  -- Historical listings stay available to participants and payment support,
  -- but the deleted director's contact and stored payment method do not.
  delete from public.hirer_billing
   where hirer_id in (select id from public.hirers where user_id = p_user);

  update public.hirers
     set user_id = null,
         contact_first_name = null,
         contact_last_initial = null,
         city = null,
         state = null
   where user_id = p_user;
  get diagnostics v_anonymized_hirers = row_count;

  update public.listing_deletions set deleted_by = null where deleted_by = p_user;

  return jsonb_build_object(
    'redactedMessages', v_redacted_messages,
    'anonymizedHirers', v_anonymized_hirers
  );
end;
$$;

revoke all on function public.prepare_account_deletion(uuid, text) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid, text) to service_role;
