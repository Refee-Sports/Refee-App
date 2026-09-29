-- Launch requirements, part 1.
--
--   1. A headshot is part of signing up: a profile cannot be created without one.
--   2. Referees can upload a background check; it counts for one year.
--   3. Assignors grow their roster by email (typed or CSV) or QR/code, message a
--      game's crew, and send one-way blasts to the whole roster. Referees can
--      see — and leave — every roster they are on.
--
-- Everything is additive: no column, policy or function a released app uses is
-- removed (post_crew_note / get_crew_thread / can_send_to_conversation keep their
-- signatures and only widen or tighten in ways the apps already expect).

-- =============================================================================
-- 1. HEADSHOT REQUIRED AT SIGN-UP
-- =============================================================================

-- Enforced when a signed-in person creates their own profile. The backend
-- (service role, seed data, tests) has no auth.uid() and is exempt, so this
-- only gates the sign-up screens. Existing profiles are untouched.
create or replace function public.require_headshot_on_signup()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- An upsert on an existing profile (editing it, or adding a second role)
  -- still fires this BEFORE INSERT trigger; only brand-new profiles need a photo.
  if exists (select 1 from public.public_profiles p where p.id = new.id) then
    return new;
  end if;
  if (select auth.uid()) is not null
     and nullif(btrim(coalesce(new.avatar_url, '')), '') is null then
    raise exception 'Upload a headshot to finish signing up.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_require_headshot_on_signup on public.public_profiles;
create trigger trg_require_headshot_on_signup
  before insert on public.public_profiles
  for each row execute function public.require_headshot_on_signup();

-- =============================================================================
-- 2. BACKGROUND CHECK UPLOADS (valid for one year)
-- =============================================================================

create table if not exists public.background_check_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.public_profiles(id) on delete cascade,
  -- Object path inside the private `background-checks` bucket: <user_id>/<file>
  file_path text not null unique,
  file_name text,
  uploaded_at timestamptz not null default now(),
  -- Always one year after upload. Set by trigger; a client cannot choose it.
  expires_at timestamptz not null default (now() + interval '1 year')
);

create index if not exists idx_background_check_documents_user
  on public.background_check_documents(user_id, uploaded_at desc);

create or replace function public.stamp_background_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.uploaded_at := now();
  new.expires_at := now() + interval '1 year';
  return new;
end;
$$;

drop trigger if exists trg_stamp_background_check on public.background_check_documents;
create trigger trg_stamp_background_check
  before insert on public.background_check_documents
  for each row execute function public.stamp_background_check();

alter table public.background_check_documents enable row level security;

-- The document itself is the owner's business. Other people only ever learn
-- "has a current check, until <date>" through the view below.
create policy "owners read their background checks"
  on public.background_check_documents for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "owners add a background check"
  on public.background_check_documents for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and file_path like ((select auth.uid())::text || '/%')
  );

create policy "owners remove a background check"
  on public.background_check_documents for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.background_check_documents from anon;
grant select, insert, delete on public.background_check_documents to authenticated;

-- Latest upload per person, without the file path. Runs as the view owner so
-- directors and assignors can show a "background check" badge; it exposes
-- nothing about the document beyond its dates.
create or replace view public.background_check_status as
select distinct on (d.user_id)
  d.user_id,
  d.uploaded_at,
  d.expires_at,
  d.expires_at > now() as is_valid
from public.background_check_documents d
order by d.user_id, d.uploaded_at desc;

revoke all on public.background_check_status from public, anon;
grant select on public.background_check_status to authenticated;

-- Private bucket: owner-only. PDF or photo, 10 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'background-checks', 'background-checks', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

create policy "owners read their background check files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'background-checks'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "owners upload their background check files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'background-checks'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "owners delete their background check files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'background-checks'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- =============================================================================
-- 3. ROSTER GROWTH: EMAIL INVITES, QR / CODE, LEAVING
-- =============================================================================

create table if not exists public.roster_email_invites (
  id uuid primary key default gen_random_uuid(),
  assignor_id uuid not null references public.public_profiles(id) on delete cascade,
  email text not null check (email = lower(email) and length(email) <= 254),
  status text not null default 'pending' check (status in ('pending', 'claimed', 'revoked')),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by uuid references public.public_profiles(id) on delete set null,
  unique (assignor_id, email)
);

create index if not exists idx_roster_email_invites_email
  on public.roster_email_invites(email) where status = 'pending';

alter table public.roster_email_invites enable row level security;

create policy "assignors read their email invites"
  on public.roster_email_invites for select
  to authenticated
  using ((select auth.uid()) = assignor_id);

revoke all on public.roster_email_invites from anon;
grant select on public.roster_email_invites to authenticated;

create table if not exists public.assignor_invite_codes (
  assignor_id uuid primary key references public.public_profiles(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table public.assignor_invite_codes enable row level security;

create policy "assignors read their invite code"
  on public.assignor_invite_codes for select
  to authenticated
  using ((select auth.uid()) = assignor_id);

revoke all on public.assignor_invite_codes from anon;
grant select on public.assignor_invite_codes to authenticated;

-- Unambiguous alphabet (no 0/O/1/I/L), 8 characters.
create or replace function public.new_roster_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.assignor_invite_codes c where c.code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.is_assignor(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur where ur.user_id = p_user and ur.role = 'assignor'
  );
$$;

create or replace function public.is_referee(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.public_profiles p
    where p.id = p_user
      and p.is_active = true
      and (
        p.primary_role = 'referee'
        or exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'referee')
      )
  );
$$;

-- The assignor's own join code (created on first use).
create or replace function public.my_roster_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_code text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.is_assignor(v_actor) then raise exception 'Assignor role required'; end if;

  select c.code into v_code from public.assignor_invite_codes c where c.assignor_id = v_actor;
  if v_code is null then
    insert into public.assignor_invite_codes (assignor_id, code)
    values (v_actor, public.new_roster_code())
    on conflict (assignor_id) do nothing;
    select c.code into v_code from public.assignor_invite_codes c where c.assignor_id = v_actor;
  end if;
  return v_code;
end;
$$;

-- Replace the code (a leaked or printed code stops working).
create or replace function public.rotate_roster_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_code text := public.new_roster_code();
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.is_assignor(v_actor) then raise exception 'Assignor role required'; end if;

  insert into public.assignor_invite_codes (assignor_id, code)
  values (v_actor, v_code)
  on conflict (assignor_id) do update set code = excluded.code, created_at = now();
  return v_code;
end;
$$;

-- Who owns this code? Shown on the "Join <name>'s roster?" confirmation.
create or replace function public.preview_roster_invite_code(p_code text)
returns table (assignor_id uuid, display_name text, city text, state text, avatar_url text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  return query
    select p.id, p.display_name, p.city, p.state::text, p.avatar_url
    from public.assignor_invite_codes c
    join public.public_profiles p on p.id = c.assignor_id
    where c.code = upper(btrim(coalesce(p_code, '')))
      and p.is_active = true;
end;
$$;

-- Scanning the assignor's QR (or typing the code) joins that roster: the
-- assignor handed the code out on purpose, so this counts as their invitation
-- and the referee's tap on "Join" as their acceptance.
create or replace function public.join_roster_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_assignor uuid;
  v_roster_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.is_referee(v_actor) then
    raise exception 'Only referees can join a roster';
  end if;

  select c.assignor_id into v_assignor
  from public.assignor_invite_codes c
  where c.code = upper(btrim(coalesce(p_code, '')));

  if v_assignor is null then raise exception 'That invite code is not valid'; end if;
  if v_assignor = v_actor then raise exception 'You cannot join your own roster'; end if;

  insert into public.assignor_rosters (assignor_id, ref_id, status, invited_at, responded_at, removed_at)
  values (v_assignor, v_actor, 'accepted', now(), now(), null)
  on conflict (assignor_id, ref_id) do update
    set status = 'accepted', responded_at = now(), removed_at = null
  returning id into v_roster_id;

  return v_roster_id;
end;
$$;

-- Invite people by email. Anyone who already has a Refee account with that
-- (confirmed) email gets a normal roster invite right away; everyone else gets
-- a pending invite that is turned into a roster invite the first time they
-- sign in with that address (see claim_roster_invites).
create or replace function public.invite_to_roster_by_email(p_emails text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_email text;
  v_raw text;
  v_email text;
  v_seen text[] := '{}';
  v_out jsonb := '[]'::jsonb;
  v_user uuid;
  v_result text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.is_assignor(v_actor) then raise exception 'Assignor role required'; end if;
  if p_emails is null or coalesce(array_length(p_emails, 1), 0) = 0 then
    raise exception 'Add at least one email';
  end if;
  if array_length(p_emails, 1) > 500 then
    raise exception 'Invite at most 500 people at a time';
  end if;

  select lower(u.email) into v_actor_email from auth.users u where u.id = v_actor;

  foreach v_raw in array p_emails loop
    v_email := lower(btrim(coalesce(v_raw, '')));

    if v_email = '' or v_email = any (v_seen) then
      continue;
    end if;
    v_seen := v_seen || v_email;

    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
      v_out := v_out || jsonb_build_object('email', v_email, 'result', 'invalid');
      continue;
    end if;
    if v_email = v_actor_email then
      v_out := v_out || jsonb_build_object('email', v_email, 'result', 'self');
      continue;
    end if;

    select u.id into v_user
    from auth.users u
    where lower(u.email) = v_email and u.email_confirmed_at is not null
    limit 1;

    if v_user is not null and public.is_referee(v_user) then
      insert into public.assignor_rosters (assignor_id, ref_id, status, invited_at, responded_at, removed_at)
      values (v_actor, v_user, 'invited', now(), null, null)
      on conflict (assignor_id, ref_id) do update
        set status = 'invited', invited_at = now(), responded_at = null, removed_at = null
        where public.assignor_rosters.status in ('declined', 'removed');

      v_result := case
        when exists (
          select 1 from public.assignor_rosters r
          where r.assignor_id = v_actor and r.ref_id = v_user and r.status = 'accepted'
        ) then 'already_on_roster'
        else 'invited'
      end;
      v_out := v_out || jsonb_build_object('email', v_email, 'result', v_result, 'user_id', v_user);
    else
      insert into public.roster_email_invites (assignor_id, email)
      values (v_actor, v_email)
      on conflict (assignor_id, email) do update
        set status = 'pending', claimed_at = null, claimed_by = null
        where public.roster_email_invites.status <> 'pending';
      v_out := v_out || jsonb_build_object('email', v_email, 'result', 'pending');
    end if;
  end loop;

  return v_out;
end;
$$;

-- Turn any pending email invites for the caller's confirmed address into roster
-- invites. Cheap and idempotent; the app calls it whenever it loads invites.
create or replace function public.claim_roster_invites()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_email text;
  v_count integer := 0;
  v_invite record;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.is_referee(v_actor) then return 0; end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_actor and u.email_confirmed_at is not null;
  if v_email is null then return 0; end if;

  for v_invite in
    select i.id, i.assignor_id
    from public.roster_email_invites i
    where i.email = v_email and i.status = 'pending' and i.assignor_id <> v_actor
    for update
  loop
    insert into public.assignor_rosters (assignor_id, ref_id, status, invited_at, responded_at, removed_at)
    values (v_invite.assignor_id, v_actor, 'invited', now(), null, null)
    on conflict (assignor_id, ref_id) do update
      set status = 'invited', invited_at = now(), responded_at = null, removed_at = null
      where public.assignor_rosters.status in ('declined', 'removed');

    update public.roster_email_invites
    set status = 'claimed', claimed_at = now(), claimed_by = v_actor
    where id = v_invite.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.revoke_roster_email_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  update public.roster_email_invites
  set status = 'revoked'
  where id = p_invite_id and assignor_id = (select auth.uid()) and status = 'pending';
  if not found then raise exception 'Pending invite not found'; end if;
end;
$$;

-- A referee leaves a roster they are on (or withdraws a pending invite).
create or replace function public.leave_roster(p_roster_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  update public.assignor_rosters r
  set status = 'removed', removed_at = now()
  where r.id = p_roster_id
    and r.ref_id = (select auth.uid())
    and r.status in ('invited', 'accepted');
  if not found then raise exception 'Roster membership not found'; end if;
end;
$$;

-- =============================================================================
-- 4. ROSTER BLASTS (one-way) AND GAME NOTES FROM THE ASSIGNOR
-- =============================================================================

alter table public.conversations drop constraint if exists conversations_kind_check;
alter table public.conversations
  add constraint conversations_kind_check
  check (kind in ('dm', 'game_crew', 'director_crew_note', 'roster_blast'));

-- One blast thread per assignor, shared by their whole roster.
create unique index if not exists uq_conversations_roster_blast
  on public.conversations(created_by) where kind = 'roster_blast';

-- Same rule as before, plus: nobody posts into a roster blast through a plain
-- insert — the assignor uses post_roster_blast, and referees cannot reply.
create or replace function public.can_send_to_conversation(
  p_conversation_id uuid,
  p_sender_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (
      select 1
      from public.conversation_participants self
      where self.conversation_id = p_conversation_id
        and self.user_id = p_sender_id
    )
    and exists (
      select 1
      from public.conversation_participants recipient
      where recipient.conversation_id = p_conversation_id
        and recipient.user_id <> p_sender_id
    )
    and not exists (
      select 1
      from public.conversation_participants recipient
      join public.public_profiles sender on sender.id = p_sender_id
      join public.public_profiles target on target.id = recipient.user_id
      join public.conversations c on c.id = p_conversation_id
      where recipient.conversation_id = p_conversation_id
        and recipient.user_id <> p_sender_id
        and (
          c.kind in ('director_crew_note', 'roster_blast')
          or not coalesce((
            (sender.primary_role = 'referee' and target.primary_role in ('referee', 'assignor'))
            or (sender.primary_role = 'director' and target.primary_role = 'referee')
            or (sender.primary_role = 'assignor' and target.primary_role = 'referee')
          ), false)
        )
    );
$$;

-- Keep the blast thread's readers equal to the accepted roster.
create or replace function public.sync_roster_blast_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convo uuid;
begin
  select c.id into v_convo
  from public.conversations c
  where c.kind = 'roster_blast' and c.created_by = new.assignor_id;

  if v_convo is null then
    return new;
  end if;

  if new.status = 'accepted' then
    insert into public.conversation_participants (conversation_id, user_id)
    values (v_convo, new.ref_id)
    on conflict (conversation_id, user_id) do nothing;
  else
    delete from public.conversation_participants
    where conversation_id = v_convo and user_id = new.ref_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_roster_blast_participant on public.assignor_rosters;
create trigger trg_sync_roster_blast_participant
  after insert or update of status on public.assignor_rosters
  for each row execute function public.sync_roster_blast_participant();

-- Send a one-way announcement to the whole (accepted) roster. Returns the
-- recipients so the app can push them; the push itself goes through send-push,
-- which already allows notifying anyone you share a roster with (0046).
create or replace function public.post_roster_blast(p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_body text := btrim(coalesce(p_body, ''));
  v_convo uuid;
  v_recipients uuid[];
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.is_assignor(v_actor) then raise exception 'Assignor role required'; end if;
  if length(v_body) = 0 then raise exception 'Message is empty'; end if;
  if length(v_body) > 1000 then raise exception 'Keep announcements under 1,000 characters'; end if;

  if (
    select count(*)
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.kind = 'roster_blast' and c.created_by = v_actor
      and m.created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Too many announcements in the last hour. Try again later.';
  end if;

  select coalesce(array_agg(r.ref_id), '{}') into v_recipients
  from public.assignor_rosters r
  where r.assignor_id = v_actor and r.status = 'accepted';

  if coalesce(array_length(v_recipients, 1), 0) = 0 then
    raise exception 'Your roster is empty';
  end if;

  insert into public.conversations (kind, created_by)
  values ('roster_blast', v_actor)
  on conflict (created_by) where kind = 'roster_blast' do nothing;

  select c.id into v_convo
  from public.conversations c
  where c.kind = 'roster_blast' and c.created_by = v_actor;

  insert into public.conversation_participants (conversation_id, user_id)
  select v_convo, x from unnest(v_recipients || v_actor) as x
  on conflict (conversation_id, user_id) do nothing;

  insert into public.messages (conversation_id, sender_id, body)
  values (v_convo, v_actor, v_body);

  return jsonb_build_object('conversation_id', v_convo, 'recipient_ids', to_jsonb(v_recipients));
end;
$$;

-- Who may post to / read receipts for a game's crew note: the game's director,
-- or the accepted assignor of the tournament the game belongs to.
create or replace function public.can_manage_crew_note(p_job_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.jobs j
    left join public.hirers h on h.id = j.hirer_id
    left join public.tournaments t on t.id = j.tournament_id
    where j.id = p_job_id
      and (
        h.user_id = p_user
        or (t.assignor_id = p_user and t.assignor_status = 'accepted')
      )
  );
$$;

create or replace function public.post_crew_note(p_job_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_convo uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_caller is null then raise exception 'Not authenticated'; end if;
  if length(v_body) = 0 then raise exception 'Note is empty'; end if;
  if length(v_body) > 4000 then v_body := left(v_body, 4000); end if;

  if not exists (select 1 from public.jobs where id = p_job_id) then
    raise exception 'Game not found';
  end if;
  if not public.can_manage_crew_note(p_job_id, v_caller) then
    raise exception 'Not your game';
  end if;

  insert into public.conversations (kind, job_id, created_by)
  values ('director_crew_note', p_job_id, v_caller)
  on conflict (job_id, kind) do nothing;

  select id into v_convo
  from public.conversations
  where job_id = p_job_id and kind = 'director_crew_note';

  insert into public.conversation_participants (conversation_id, user_id)
  select v_convo, a.ref_id
  from public.job_assignments a
  where a.job_id = p_job_id
    and a.status in ('accepted', 'needs_reconfirm', 'completed', 'cancelled')
  on conflict (conversation_id, user_id) do nothing;

  insert into public.messages (conversation_id, sender_id, body)
  values (v_convo, v_caller, v_body);

  return v_convo;
end;
$$;

create or replace function public.get_crew_thread(p_job_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_convo uuid;
  v_last timestamptz;
  v_messages json;
  v_receipts json;
begin
  if v_caller is null then raise exception 'Not authenticated'; end if;

  if not exists (select 1 from public.jobs where id = p_job_id)
     or not public.can_manage_crew_note(p_job_id, v_caller) then
    raise exception 'Not your game';
  end if;

  select id, last_message_at into v_convo, v_last
  from public.conversations
  where job_id = p_job_id and kind = 'director_crew_note';

  if v_convo is null then
    return json_build_object(
      'conversationId', null, 'lastMessageAt', null,
      'messages', '[]'::json, 'receipts', '[]'::json
    );
  end if;

  select coalesce(json_agg(
    json_build_object('id', m.id, 'senderId', m.sender_id, 'body', m.body, 'createdAt', m.created_at)
    order by m.created_at
  ), '[]'::json)
  into v_messages
  from public.messages m
  where m.conversation_id = v_convo;

  select coalesce(json_agg(
    json_build_object('refId', cp.user_id, 'displayName', pp.display_name, 'lastReadAt', cp.last_read_at)
  ), '[]'::json)
  into v_receipts
  from public.conversation_participants cp
  join public.public_profiles pp on pp.id = cp.user_id
  where cp.conversation_id = v_convo
    and cp.user_id <> v_caller;

  return json_build_object(
    'conversationId', v_convo,
    'lastMessageAt', v_last,
    'messages', v_messages,
    'receipts', v_receipts
  );
end;
$$;

-- =============================================================================
-- GRANTS — signed-in callers only, never anon (see 0039 / 0049)
-- =============================================================================

revoke all on function
  public.require_headshot_on_signup(),
  public.stamp_background_check(),
  public.new_roster_code(),
  public.is_assignor(uuid),
  public.is_referee(uuid),
  public.my_roster_invite_code(),
  public.rotate_roster_invite_code(),
  public.preview_roster_invite_code(text),
  public.join_roster_by_code(text),
  public.invite_to_roster_by_email(text[]),
  public.claim_roster_invites(),
  public.revoke_roster_email_invite(uuid),
  public.leave_roster(uuid),
  public.sync_roster_blast_participant(),
  public.post_roster_blast(text),
  public.can_manage_crew_note(uuid, uuid),
  public.post_crew_note(uuid, text),
  public.get_crew_thread(uuid),
  public.can_send_to_conversation(uuid, uuid)
from public, anon;

grant execute on function
  public.my_roster_invite_code(),
  public.rotate_roster_invite_code(),
  public.preview_roster_invite_code(text),
  public.join_roster_by_code(text),
  public.invite_to_roster_by_email(text[]),
  public.claim_roster_invites(),
  public.revoke_roster_email_invite(uuid),
  public.leave_roster(uuid),
  public.post_roster_blast(text),
  public.post_crew_note(uuid, text),
  public.get_crew_thread(uuid),
  public.can_send_to_conversation(uuid, uuid)
to authenticated;
