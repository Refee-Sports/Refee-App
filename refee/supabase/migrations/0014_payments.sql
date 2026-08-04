-- =============================================================
-- REFEE — MIGRATION 0014: PAYMENTS (Stripe test mode)
-- Director pays crew at completion via PaymentIntent; refs
-- receive Transfers to their Stripe Express accounts.
-- =============================================================

alter table public.jobs
  add column if not exists payment_intent_id text,
  add column if not exists payment_status text default 'unpaid'
    check (payment_status in ('unpaid', 'processing', 'paid'));
