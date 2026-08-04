-- =============================================================
-- REFEE — MIGRATION 0007
-- Adds auto_accept flag to jobs so directors can bypass manual
-- approval and automatically accept any referee who applies.
-- =============================================================

alter table public.jobs
  add column if not exists auto_accept boolean default false;
