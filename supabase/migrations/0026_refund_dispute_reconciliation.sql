-- =============================================================
-- REFEE — MIGRATION 0026: REFUND / DISPUTE RECONCILIATION
-- Records Stripe loss events without silently choosing whether the
-- platform or referee bears the loss. A reviewed issue can later drive
-- transfer reversal once the launch policy is approved.
-- =============================================================

alter table public.jobs
  add column if not exists stripe_charge_id text,
  add column if not exists payment_refund_status text not null default 'none'
    check (payment_refund_status in ('none', 'partial', 'full')),
  add column if not exists refunded_amount_cents integer not null default 0
    check (refunded_amount_cents >= 0),
  add column if not exists stripe_dispute_id text,
  add column if not exists payment_dispute_status text not null default 'none'
    check (payment_dispute_status in ('none', 'open', 'won', 'lost')),
  add column if not exists payment_issue_requires_review boolean not null default false,
  add column if not exists payment_review_reason text
    check (payment_review_reason is null or payment_review_reason in ('refund', 'dispute'));

create unique index if not exists idx_jobs_stripe_charge_id
  on public.jobs(stripe_charge_id)
  where stripe_charge_id is not null;

create unique index if not exists idx_jobs_stripe_dispute_id
  on public.jobs(stripe_dispute_id)
  where stripe_dispute_id is not null;
