-- 0044 · A VERIFIED badge means an identity check passed — nothing else.
--
-- Until 0041, anyone could set public_profiles.is_verified (and hirers.is_verified)
-- on themselves, because the update policies covered every column. 0041 stopped
-- new writes like that, but left existing values where they were. So an account
-- could still carry a VERIFIED badge with no approved check behind it — shown as
-- verified to everyone, while every gate in 0042 refuses it.
--
-- This clears any badge that isn't backed by an approved identity check, so the
-- profiles read PENDING VERIFICATION until Didit says otherwise. didit-webhook
-- keeps the two in step from here on. Safe to re-run: it only ever clears.

update public.public_profiles pp
set is_verified = false
where pp.is_verified
  and not public.is_identity_verified(pp.id);

update public.hirers h
set is_verified = false
where h.is_verified
  and h.user_id is not null
  and not public.is_identity_verified(h.user_id);
