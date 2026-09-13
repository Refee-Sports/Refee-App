-- 0033 — payment, lifecycle and assignor-agreement columns change only
-- through the backend.
--
-- "hirers can manage their own jobs" (FOR ALL) lets a director's own client
-- update every column of their games and delete them, and directors can
-- likewise update every column of their tournaments. That covered the fields
-- the backend relies on to charge directors and pay referees (payment_status,
-- prepay_required, prepaid_*), to close a game out (status, completed_at,
-- cancelled_at) and to record an assignor's agreement (assignor_status, fees).
-- A tampered client could mark a game paid and never be charged.
--
-- The backend writes these through SECURITY DEFINER functions, which run as
-- their owner, and edge functions, which run as service_role. Statements that
-- come straight from a signed-in client run as `authenticated`. For those:
-- new rows get the backend-owned columns reset to their defaults, changes to
-- them are rejected, and deletes are refused (cancel instead).

-- ── Games ────────────────────────────────────────────────────────────────────

create or replace function public.guard_job_backend_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Games can''t be deleted. Cancel the game instead.'
      using errcode = '42501';
  end if;

  if new.tournament_id is not null and not exists (
    select 1 from public.tournaments t
    where t.id = new.tournament_id and t.hirer_id = new.hirer_id
  ) then
    raise exception 'That tournament belongs to another organizer.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.status := 'open';
    new.completed_at := null;
    new.cancelled_at := null;
    new.payout_window_hours := 48;
    new.payment_status := 'unpaid';
    new.prepay_required := true;
    new.payment_intent_id := null;
    new.stripe_charge_id := null;
    new.prepaid_crew_cents := 0;
    new.prepaid_fee_cents := 0;
    new.prepaid_at := null;
    new.refunded_amount_cents := 0;
    new.payment_refund_status := 'none';
    new.payment_dispute_status := 'none';
    new.stripe_dispute_id := null;
    new.payment_issue_requires_review := false;
    new.payment_review_reason := null;
    new.last_payment_event_at := null;
    return new;
  end if;

  if (new.status, new.completed_at, new.cancelled_at, new.payout_window_hours,
      new.payment_status, new.prepay_required, new.payment_intent_id,
      new.stripe_charge_id, new.prepaid_crew_cents, new.prepaid_fee_cents,
      new.prepaid_at, new.refunded_amount_cents, new.payment_refund_status,
      new.payment_dispute_status, new.stripe_dispute_id,
      new.payment_issue_requires_review, new.payment_review_reason,
      new.last_payment_event_at)
     is distinct from
     (old.status, old.completed_at, old.cancelled_at, old.payout_window_hours,
      old.payment_status, old.prepay_required, old.payment_intent_id,
      old.stripe_charge_id, old.prepaid_crew_cents, old.prepaid_fee_cents,
      old.prepaid_at, old.refunded_amount_cents, old.payment_refund_status,
      old.payment_dispute_status, old.stripe_dispute_id,
      old.payment_issue_requires_review, old.payment_review_reason,
      old.last_payment_event_at)
  then
    raise exception 'Game status and payment fields are set by Refee, not the app.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_jobs_guard_backend_columns on public.jobs;
create trigger trg_jobs_guard_backend_columns
  before insert or update or delete on public.jobs
  for each row execute function public.guard_job_backend_columns();

-- ── Tournaments ──────────────────────────────────────────────────────────────

create or replace function public.guard_tournament_backend_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Tournaments can''t be deleted. Cancel it instead.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.assignor_id := null;
    new.assignor_status := null;
    new.assignor_fee := null;
    new.assignor_fee_pct := null;
    new.assignor_fee_type := 'flat';
    new.assignor_proposal_message := null;
    new.platform_fee_pct := 10.00;
    return new;
  end if;

  if (new.assignor_id, new.assignor_status, new.assignor_fee,
      new.assignor_fee_pct, new.assignor_fee_type,
      new.assignor_proposal_message, new.platform_fee_pct)
     is distinct from
     (old.assignor_id, old.assignor_status, old.assignor_fee,
      old.assignor_fee_pct, old.assignor_fee_type,
      old.assignor_proposal_message, old.platform_fee_pct)
  then
    raise exception 'Assignor agreements and fees are set by Refee, not the app.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tournaments_guard_backend_columns on public.tournaments;
create trigger trg_tournaments_guard_backend_columns
  before insert or update or delete on public.tournaments
  for each row execute function public.guard_tournament_backend_columns();
