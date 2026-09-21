-- Refee staff access.
--
-- Deliberately NOT a value in user_roles: that table is writable by the person
-- it describes, and its check constraint refuses 'admin' precisely so nobody
-- can grant themselves one. Staff live in their own table that no client can
-- read or write — the only way in is a service-role query or the SQL editor,
-- which means a stolen session can never become an admin session.
--
-- Everything staff can do goes through the security-definer functions below,
-- each of which checks is_admin first. There is no blanket "admins bypass RLS"
-- policy anywhere, so the blast radius of this table is exactly the list of
-- functions here and nothing else.

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  granted_at timestamptz not null default now()
);

comment on table public.admins is
  'Refee staff. Backend only — granted by hand, never from an app.';

alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;

create or replace function public.is_admin(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null and exists (
    select 1 from public.admins a where a.user_id = p_user
  );
$$;

comment on function public.is_admin(uuid) is 'True when the user is Refee staff.';

revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

-- Raises unless the caller is staff. Every admin function starts with this.
create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.require_admin() from public, anon;
grant execute on function public.require_admin() to authenticated, service_role;

-- ── Suspension ──────────────────────────────────────────────────────────────
-- Refee never deletes an account to deal with a problem: games, payments and
-- ratings all reference it, and a deleted row would take someone else's
-- history with it. Suspension is the lever instead, and it lives on
-- private_profiles under the existing guard so a suspended person cannot lift
-- it themselves the way they could with public_profiles.is_active.

alter table public.private_profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists suspended_by uuid references auth.users(id);

comment on column public.private_profiles.suspended_at is
  'Set by staff. Non-null means the account cannot take or post work.';

create or replace function public.is_suspended(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.private_profiles p
     where p.id = p_user and p.suspended_at is not null
  );
$$;

revoke all on function public.is_suspended(uuid) from public, anon;
grant execute on function public.is_suspended(uuid) to authenticated, service_role;

-- Fold the new columns into the guard that already protects identity and
-- payout fields, so the app cannot write them.
--
-- Deliberately NOT security definer, matching 0041. This guard decides what to
-- do by looking at current_user, and inside a security-definer function
-- current_user is the function's owner rather than the caller — which would
-- make the "backend bypasses the guard" branch true for everyone and quietly
-- disable the whole thing.
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
    new.suspended_at := null;
    new.suspended_reason := null;
    new.suspended_by := null;
    return new;
  end if;

  if (new.identity_provider, new.identity_session_id, new.identity_session_url, new.identity_status,
      new.identity_decision_at, new.identity_last_reason, new.identity_verified_at,
      new.persona_inquiry_id, new.background_check_provider, new.background_check_id,
      new.background_check_status, new.background_check_completed_at,
      new.background_check_expires_at, new.stripe_account_id, new.stripe_account_status,
      new.suspended_at, new.suspended_reason, new.suspended_by)
     is distinct from
     (old.identity_provider, old.identity_session_id, old.identity_session_url, old.identity_status,
      old.identity_decision_at, old.identity_last_reason, old.identity_verified_at,
      old.persona_inquiry_id, old.background_check_provider, old.background_check_id,
      old.background_check_status, old.background_check_completed_at,
      old.background_check_expires_at, old.stripe_account_id, old.stripe_account_status,
      old.suspended_at, old.suspended_reason, old.suspended_by)
  then
    raise exception 'Identity, background check, payout account and suspension are set by Refee, not the app.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Re-attached here so this migration stands on its own: replacing the function
-- above with a different signature would otherwise leave the table unguarded.
drop trigger if exists trg_private_profiles_guard_backend_columns on public.private_profiles;
create trigger trg_private_profiles_guard_backend_columns
  before insert or update on public.private_profiles
  for each row execute function public.guard_private_profile_backend_columns();

-- A suspended account cannot work. is_identity_verified is the gate every
-- action already calls (0041/0042/0043), so suspension rides the same rail
-- rather than needing a second check spliced into a dozen functions.
create or replace function public.is_identity_verified(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.private_profiles p
     where p.id = p_user
       and p.identity_status = 'approved'
       and p.suspended_at is null
       -- Refee is 18+ (0043): a known minor is never verified, whatever the
       -- stored status says.
       and (p.date_of_birth is null or public.is_adult(p.date_of_birth))
  );
$$;

-- ── Audit ───────────────────────────────────────────────────────────────────
-- Staff actions are recorded. Reviewing someone's identity or suspending an
-- account is exactly the kind of thing that needs to be answerable later.

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id),
  action text not null,
  subject_user_id uuid references auth.users(id),
  subject_job_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_actions_created on public.admin_actions (created_at desc);
create index if not exists idx_admin_actions_subject on public.admin_actions (subject_user_id, created_at desc);

comment on table public.admin_actions is
  'Every staff action, for answering "who changed this, and why" later.';

alter table public.admin_actions enable row level security;
revoke all on table public.admin_actions from anon, authenticated;
