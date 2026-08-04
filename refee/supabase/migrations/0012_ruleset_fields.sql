-- =============================================================
-- REFEE — MIGRATION 0012: RULESET FIELDS
-- Ruleset is required with preset options; organizers can note
-- tournament/game-specific modifications.
-- =============================================================

alter table public.jobs
  add column if not exists ruleset_modifications text;

alter table public.tournaments
  add column if not exists ruleset text,
  add column if not exists ruleset_modifications text;
