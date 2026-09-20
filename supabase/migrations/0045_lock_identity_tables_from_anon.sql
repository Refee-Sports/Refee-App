-- 0045 · Signed-out visitors have no business touching identity data.
--
-- Supabase grants every public table to `anon` and `authenticated` by default
-- and relies on RLS to decide the rows. private_profiles is covered — its three
-- policies are all `to authenticated`, so an anonymous request matches nothing
-- — but the grant is still there, and that leaves one careless policy between
-- the internet and legal names, dates of birth, phone numbers and the Stripe
-- account someone is paid into.
--
-- The ledgers (didit_webhook_events, listing_deletions, stripe_webhook_events)
-- were already revoked when they were created; this does the same for the two
-- tables that predate that habit. Nothing signed-out reads either: the apps
-- touch private_profiles only as the signed-in owner, and ai_events only ever
-- through service_role.

revoke all on table public.private_profiles from anon;
revoke all on table public.ai_events from anon;
