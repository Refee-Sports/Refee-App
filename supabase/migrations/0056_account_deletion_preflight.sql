-- Give the account-deletion edge function a read-only preflight. It runs this
-- before removing records at Stripe or Didit, so a known business blocker does
-- not leave the local account intact after an external account was removed.
create or replace function public.account_deletion_blocker(p_user uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user is null then
    return 'Invalid account deletion request.';
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
    return 'Finish or withdraw from active games and resolve pending payouts before deleting your account.';
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
    return 'Close active listings and resolve payment issues before deleting your account.';
  end if;

  if exists (
    select 1
      from public.tournaments t
     where t.assignor_id = p_user
       and t.assignor_status = 'accepted'
       and t.ends_on >= current_date
       and coalesce(t.status, '') not in ('completed', 'cancelled')
  ) then
    return 'Hand off active tournaments before deleting your account.';
  end if;

  return null;
end;
$$;

revoke all on function public.account_deletion_blocker(uuid) from public, anon, authenticated;
grant execute on function public.account_deletion_blocker(uuid) to service_role;
