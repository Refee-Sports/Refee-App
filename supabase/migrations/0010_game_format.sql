-- =============================================================
-- REFEE — MIGRATION 0010: GAME FORMAT
-- 4 quarters or 2 halves + minutes per period.
-- =============================================================

alter table public.jobs
  add column if not exists game_format text
    check (game_format in ('quarters', 'halves')),
  add column if not exists period_minutes integer
    check (period_minutes between 4 and 30);
