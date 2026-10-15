-- Names and photos once an ID is verified.
--
-- 1. The last initial everyone sees is taken from the legal last name, never
--    typed separately, so it can't disagree with the ID.
-- 2. A verified person can still change their name (an ID that scanned badly,
--    a nickname, a marriage), but only once every 60 days. Edits within an hour
--    of each other count as one change, so fixing the legal name and the
--    display name together isn't two. Every change is logged for admins.
--    The date of birth stays locked (0067); in_review still locks everything.
-- 3. A verified person's photo can only change through the set-headshot edge
--    function, which face-matches it against their ID selfie. The app can no
--    longer write avatar_url or the avatar file for them; it uploads a
--    candidate to <uid>/pending.jpg instead.
-- 4. A director's organization contact name follows their profile name.

-- ── Change log and cooldown ──────────────────────────────────────────────────

alter table public.private_profiles
  add column if not exists name_changed_at timestamptz;

create table if not exists public.name_changes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  field text not null check (field in ('first_name', 'legal_first_name', 'legal_last_name')),
  old_value text,
  new_value text,
  changed_at timestamptz not null default now()
);
create index if not exists name_changes_user_idx on public.name_changes (user_id, changed_at desc);

-- Admins read it through the service role; nobody reads it from the app.
alter table public.name_changes enable row level security;
revoke all on table public.name_changes from anon, authenticated;

create or replace function public.name_change_cooldown()
returns interval language sql immutable as $$ select interval '60 days' $$;

-- Refuses a verified person's name change if they made one recently. Edits
-- within an hour of the last one are the same sitting and pass.
create or replace function public.assert_name_change_allowed(p_last timestamptz)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_last is not null
     and p_last < now() - interval '1 hour'
     and p_last > now() - public.name_change_cooldown()
  then
    raise exception 'You can change your name again on %.',
      to_char(p_last + public.name_change_cooldown(), 'FMMonth FMDD, YYYY')
      using errcode = '42501';
  end if;
end;
$$;

-- The stamp to keep: the sitting's start while it lasts, otherwise now.
create or replace function public.name_change_stamp(p_last timestamptz)
returns timestamptz language sql stable set search_path = '' as $$
  select case when p_last is not null and p_last >= now() - interval '1 hour' then p_last else now() end
$$;

-- Writes to the admin-only log, for the caller's own account only.
create or replace function public.log_name_change(p_field text, p_old text, p_new text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.name_changes (user_id, field, old_value, new_value)
  values ((select auth.uid()), p_field, p_old, p_new);
$$;
revoke all on function public.log_name_change(text, text, text) from public, anon;
grant execute on function public.log_name_change(text, text, text) to authenticated;

-- Stamps the caller's own private row (the public-name trigger can't update it
-- through RLS-free paths otherwise).
create or replace function public.stamp_name_change()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.private_profiles
     set name_changed_at = public.name_change_stamp(name_changed_at)
   where id = (select auth.uid());
$$;
revoke all on function public.stamp_name_change() from public, anon;
grant execute on function public.stamp_name_change() to authenticated;

-- ── Legal name and birthday (replaces 0067's rule) ───────────────────────────

create or replace function public.guard_verified_identity_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  -- Didit is checking against these right now.
  if old.identity_status = 'in_review'
     and (new.legal_first_name, new.legal_last_name, new.date_of_birth)
         is distinct from (old.legal_first_name, old.legal_last_name, old.date_of_birth)
  then
    raise exception 'Your ID is being reviewed, so your legal name and date of birth can''t change right now.'
      using errcode = '42501';
  end if;

  if old.identity_status = 'approved' then
    if new.date_of_birth is distinct from old.date_of_birth then
      raise exception 'Your date of birth is locked once your ID is verified. Contact support to change it.'
        using errcode = '42501';
    end if;
    if (new.legal_first_name, new.legal_last_name) is distinct from (old.legal_first_name, old.legal_last_name) then
      perform public.assert_name_change_allowed(old.name_changed_at);
      new.name_changed_at := public.name_change_stamp(old.name_changed_at);
      if new.legal_first_name is distinct from old.legal_first_name then
        perform public.log_name_change('legal_first_name', old.legal_first_name, new.legal_first_name);
      end if;
      if new.legal_last_name is distinct from old.legal_last_name then
        perform public.log_name_change('legal_last_name', old.legal_last_name, new.legal_last_name);
      end if;
    else
      -- The stamp is the backend's to set.
      new.name_changed_at := old.name_changed_at;
    end if;
  elsif new.name_changed_at is distinct from old.name_changed_at then
    new.name_changed_at := old.name_changed_at;
  end if;

  return new;
end;
$$;

-- A new legal last name moves the public initial with it.
create or replace function public.sync_last_initial_from_legal_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.legal_last_name is distinct from old.legal_last_name and nullif(trim(new.legal_last_name), '') is not null then
    update public.public_profiles
       set last_initial = upper(left(trim(new.legal_last_name), 1))
     where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_private_profiles_sync_last_initial on public.private_profiles;
create trigger trg_private_profiles_sync_last_initial
  after update of legal_last_name on public.private_profiles
  for each row execute function public.sync_last_initial_from_legal_name();

-- ── Public name and photo ────────────────────────────────────────────────────

create or replace function public.guard_public_name_and_photo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_legal_last text;
  v_last_change timestamptz;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  -- The person's own private row, readable to them.
  select nullif(trim(legal_last_name), ''), name_changed_at into v_legal_last, v_last_change
  from public.private_profiles where id = new.id;
  if v_legal_last is not null then
    new.last_initial := upper(left(v_legal_last, 1));
  end if;

  if tg_op = 'UPDATE' and public.is_identity_verified(new.id) then
    if new.first_name is distinct from old.first_name then
      perform public.assert_name_change_allowed(v_last_change);
      perform public.stamp_name_change();
      perform public.log_name_change('first_name', old.first_name, new.first_name);
    end if;
    if new.avatar_url is distinct from old.avatar_url then
      raise exception 'Your photo is checked against your ID. Use Change photo to update it.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_public_profiles_guard_name_and_photo on public.public_profiles;
create trigger trg_public_profiles_guard_name_and_photo
  before insert or update on public.public_profiles
  for each row execute function public.guard_public_name_and_photo();

-- ── Organization contact follows the director ────────────────────────────────

create or replace function public.hirer_contact_from_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  select p.first_name, p.last_initial
    into new.contact_first_name, new.contact_last_initial
  from public.public_profiles p
  where p.id = new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_hirers_contact_from_profile on public.hirers;
create trigger trg_hirers_contact_from_profile
  before insert or update on public.hirers
  for each row execute function public.hirer_contact_from_profile();

create or replace function public.sync_hirer_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.first_name, new.last_initial) is distinct from (old.first_name, old.last_initial) then
    update public.hirers
       set contact_first_name = new.first_name, contact_last_initial = new.last_initial
     where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_public_profiles_sync_hirer_contact on public.public_profiles;
create trigger trg_public_profiles_sync_hirer_contact
  after update of first_name, last_initial on public.public_profiles
  for each row execute function public.sync_hirer_contact();

-- ── Avatar files ─────────────────────────────────────────────────────────────
-- Anyone may stage <uid>/pending.jpg for the face match. Only people who aren't
-- verified yet may write their avatar file directly (sign-up needs that).

drop policy if exists "users upload their own avatar" on storage.objects;
create policy "users upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (
      storage.filename(name) = 'pending.jpg'
      or not public.is_identity_verified((select auth.uid()))
    )
  );

drop policy if exists "users update their own avatar" on storage.objects;
create policy "users update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (
      storage.filename(name) = 'pending.jpg'
      or not public.is_identity_verified((select auth.uid()))
    )
  );
