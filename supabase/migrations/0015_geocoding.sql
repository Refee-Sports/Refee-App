-- =============================================================
-- REFEE — MIGRATION 0015: GEOCODING
-- Ref home coordinates for distance-based feed filtering.
-- (jobs.venue_lat / venue_lng already exist from 0001.)
-- =============================================================

alter table public.public_profiles
  add column if not exists home_lat numeric(10, 7),
  add column if not exists home_lng numeric(10, 7);
