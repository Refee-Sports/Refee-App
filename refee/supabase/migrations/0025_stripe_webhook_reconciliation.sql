-- =============================================================
-- REFEE — MIGRATION 0025: STRIPE WEBHOOK RECONCILIATION
-- Tracks signed webhook delivery and expands payment states so Stripe,
-- rather than a client callback, is the durable source of truth.
-- =============================================================

alter table public.jobs
  drop constraint if exists jobs_payment_status_check;

alter table public.jobs
  add constraint jobs_payment_status_check
  check (payment_status in ('unpaid', 'processing', 'paid', 'failed', 'refunded', 'disputed'));

alter table public.jobs
  add column if not exists last_payment_event_at timestamptz;

create unique index if not exists idx_jobs_payment_intent_id
  on public.jobs(payment_intent_id)
  where payment_intent_id is not null;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  livemode boolean not null default false,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'failed')),
  attempts integer not null default 1,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

alter table public.stripe_webhook_events enable row level security;

-- No client policies: this ledger is service-role only.
revoke all on table public.stripe_webhook_events from anon, authenticated;

