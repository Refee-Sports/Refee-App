-- 0054 initially referenced the legacy hirers.stripe_customer_id column. Card
-- details now live only in hirer_billing, which 0054 already deletes.
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

  update public.messages
     set body = '[Account deleted]'
   where sender_id = p_user;
  get diagnostics v_redacted_messages = row_count;

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
