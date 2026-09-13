-- =============================================================
-- REFEE — MIGRATION 0020: ASSIGNOR FEE TYPE (flat vs percentage)
-- Per Gerda (Aug 2026): an assignor is paid either a flat fee for
-- the event, or a percentage of the referee fees on each game they
-- assign. 0004 only modeled a flat integer fee — this adds the
-- flat/percentage choice to both the tournament (final terms) and
-- assignor_proposals (each assignor's bid).
-- =============================================================

alter table public.tournaments
  add column if not exists assignor_fee_type text
    check (assignor_fee_type in ('flat', 'percentage')) default 'flat',
  add column if not exists assignor_fee_pct numeric(5,2),
  alter column assignor_fee drop not null;

alter table public.assignor_proposals
  add column if not exists fee_type text
    check (fee_type in ('flat', 'percentage')) default 'flat',
  add column if not exists fee_pct numeric(5,2),
  alter column fee_amount drop not null;

-- Either a flat amount or a percentage must be set, never neither/both meaningfully —
-- enforced loosely at the app layer (matches this schema's existing convention of
-- app-level validation over exhaustive DB constraints, e.g. jobs/tournaments status flow).
