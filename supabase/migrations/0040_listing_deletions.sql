-- 0040 · A record of deleted games and tournaments.
--
-- Directors and a tournament's accepted assignor can delete a game or a whole
-- tournament until a referee accepts (the delete-listing edge function). The
-- rows go, but a game charged at booking has a Stripe charge and refund behind
-- it, so each deletion is logged here for support and bookkeeping.
-- Backend only: the apps can neither read nor write it.

create table if not exists public.listing_deletions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('game', 'tournament')),
  tournament_id uuid,
  job_id uuid,
  title text,
  hirer_id uuid,
  payment_intent_id text,
  refunded_cents integer not null default 0,
  deleted_by uuid not null,
  deleted_at timestamptz not null default now()
);

alter table public.listing_deletions enable row level security;
revoke all on public.listing_deletions from anon, authenticated;

create index if not exists listing_deletions_hirer_idx on public.listing_deletions (hirer_id, deleted_at desc);
