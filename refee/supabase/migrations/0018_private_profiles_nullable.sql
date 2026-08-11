-- =============================================================
-- REFEE — MIGRATION 0018
-- Legal identity (name, DOB, phone) is now collected and held by
-- Stripe Connect Express, so private_profiles no longer requires them.
-- This lets connect-onboard upsert a row with just the Stripe account id
-- (referee onboarding doesn't create a private_profiles row).
-- =============================================================

alter table public.private_profiles
  alter column legal_first_name drop not null,
  alter column legal_last_name drop not null,
  alter column date_of_birth drop not null,
  alter column phone drop not null;
