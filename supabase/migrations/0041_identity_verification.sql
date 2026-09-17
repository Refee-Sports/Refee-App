-- 0041 · Identity verification: who a person is, checked once at signup.
--
-- Refee is open-signup — anyone can create an account and start working games —
-- so Refee has to establish "you're a real person, and you're who you say you
-- are" itself. Didit does the check (ID scan, liveness, face match, face search)
-- on its own hosted pages; Refee stores a session id and a status, never a
-- document or a photo.
--
-- The state lives on private_profiles: every role has one, it's already RLS'd to
-- "your own row only", and assignors often have no hirers row at all. The apps
-- never write that table — connect-onboard and the two Didit functions do, as
-- service_role.
--
-- This migration also closes a hole that has been open since day one: the
-- profile screens show a VERIFIED badge from public_profiles.is_verified, and
-- the update policies on public_profiles and hirers cover *every* column, so a
-- user could simply mark themselves verified. The guard triggers below fix that,
-- in the same shape as 0033.

-- ── Identity state ───────────────────────────────────────────────────────────

alter table public.private_profiles
  add column if not exists identity_provider text not null default 'didit',
  add column if not exists identity_session_id text,
  -- Didit's hosted page for the session in flight, so someone who closes the
  -- tab picks up where they left off instead of burning a new session.
  add column if not exists identity_session_url text,
  add column if not exists identity_status text not null default 'unstarted',
  add column if not exists identity_decision_at timestamptz,
  add column if not exists identity_last_reason text;

-- identity_verified_at already exists (0001) and keeps its meaning: set when
-- the check passes, cleared if a later decision takes the approval away.

alter table public.private_profiles
  drop constraint if exists private_profiles_identity_status_check;
alter table public.private_profiles
  add constraint private_profiles_identity_status_check
  check (identity_status in (
    'unstarted', 'in_progress', 'in_review', 'approved', 'declined', 'expired', 'abandoned'
  ));

create unique index if not exists private_profiles_identity_session_idx
  on public.private_profiles (identity_session_id)
  where identity_session_id is not null;

-- ── Webhook ledger ───────────────────────────────────────────────────────────
-- Didit retries deliveries, so each event is reserved by id before it is acted
-- on. Same shape and the same reasoning as stripe_webhook_events (0025).

create table if not exists public.didit_webhook_events (
  event_id text primary key,
  event_type text not null,
  session_id text,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'failed')),
  attempts integer not null default 1,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

alter table public.didit_webhook_events enable row level security;

-- No policies: this ledger is service-role only.
revoke all on table public.didit_webhook_events from anon, authenticated;

-- ── The verification badge is set by Refee, not by the app ───────────────────

create or replace function public.guard_public_profile_backend_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_verified := false;
    return new;
  end if;

  if new.is_verified is distinct from old.is_verified then
    raise exception 'Verification is set by Refee, not the app.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_public_profiles_guard_backend_columns on public.public_profiles;
create trigger trg_public_profiles_guard_backend_columns
  before insert or update on public.public_profiles
  for each row execute function public.guard_public_profile_backend_columns();

create or replace function public.guard_hirer_backend_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_verified := false;
    return new;
  end if;

  if new.is_verified is distinct from old.is_verified then
    raise exception 'Verification is set by Refee, not the app.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_hirers_guard_backend_columns on public.hirers;
create trigger trg_hirers_guard_backend_columns
  before insert or update on public.hirers
  for each row execute function public.guard_hirer_backend_columns();

-- The identity and background-check columns, and the Stripe account the payouts
-- run pays into, are all written by the backend alone — no app code touches
-- private_profiles. Guarding them here means a tampered client can't approve
-- itself or redirect its own payouts.
create or replace function public.guard_private_profile_backend_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.identity_provider := 'didit';
    new.identity_session_id := null;
    new.identity_session_url := null;
    new.identity_status := 'unstarted';
    new.identity_decision_at := null;
    new.identity_last_reason := null;
    new.identity_verified_at := null;
    new.persona_inquiry_id := null;
    new.background_check_provider := 'ncsi';
    new.background_check_id := null;
    new.background_check_status := 'pending';
    new.background_check_completed_at := null;
    new.background_check_expires_at := null;
    new.stripe_account_id := null;
    new.stripe_account_status := 'pending';
    return new;
  end if;

  if (new.identity_provider, new.identity_session_id, new.identity_session_url, new.identity_status,
      new.identity_decision_at, new.identity_last_reason, new.identity_verified_at,
      new.persona_inquiry_id, new.background_check_provider, new.background_check_id,
      new.background_check_status, new.background_check_completed_at,
      new.background_check_expires_at, new.stripe_account_id, new.stripe_account_status)
     is distinct from
     (old.identity_provider, old.identity_session_id, old.identity_session_url, old.identity_status,
      old.identity_decision_at, old.identity_last_reason, old.identity_verified_at,
      old.persona_inquiry_id, old.background_check_provider, old.background_check_id,
      old.background_check_status, old.background_check_completed_at,
      old.background_check_expires_at, old.stripe_account_id, old.stripe_account_status)
  then
    raise exception 'Identity, background check and payout account are set by Refee, not the app.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_private_profiles_guard_backend_columns on public.private_profiles;
create trigger trg_private_profiles_guard_backend_columns
  before insert or update on public.private_profiles
  for each row execute function public.guard_private_profile_backend_columns();

-- ── The one question every gate asks ─────────────────────────────────────────
-- Definer, because private_profiles is readable only by its owner and the
-- gates in 0042 ask on behalf of the person acting. It answers the same
-- question the VERIFIED badge on public_profiles already answers out loud, so
-- signed-in callers may ask it; signed-out ones may not.

create or replace function public.is_identity_verified(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.private_profiles p
    where p.id = p_user and p.identity_status = 'approved'
  );
$$;

revoke all on function public.is_identity_verified(uuid) from public, anon;
grant execute on function public.is_identity_verified(uuid) to authenticated;
