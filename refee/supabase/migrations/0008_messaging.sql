-- =============================================================
-- REFEE — MIGRATION 0008: MESSAGING
-- Conversations between directors, referees, and assignors.
-- Kinds:
--   dm        — 1:1 (director↔ref once accepted, ref↔ref same crew, assignor↔ref)
--   game_crew — group thread per game: director + all accepted refs
-- =============================================================

create table public.conversations (
  id uuid primary key default uuid_generate_v4(),
  kind text not null default 'dm' check (kind in ('dm', 'game_crew')),
  job_id uuid references public.jobs(id) on delete cascade,
  created_by uuid references public.public_profiles(id) not null,
  created_at timestamptz default now(),
  last_message_at timestamptz default now(),
  -- one crew thread per game
  unique (job_id, kind)
);

create table public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.public_profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  last_read_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.public_profiles(id) not null,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz default now()
);

create index idx_messages_conversation on public.messages(conversation_id, created_at);
create index idx_participants_user on public.conversation_participants(user_id);
create index idx_conversations_last_message on public.conversations(last_message_at desc);

-- Bump conversation freshness on new message
create or replace function bump_conversation_last_message()
returns trigger as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_bump_last_message
  after insert on public.messages
  for each row execute function bump_conversation_last_message();

-- =============================================================
-- RLS — participant-based, via security definer helper to avoid
-- recursive policy evaluation on conversation_participants.
-- =============================================================
create or replace function public.is_conversation_participant(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = p_user_id
  );
$$;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- Conversations: participants can read; any authenticated user can create
-- (eligibility — accepted crew member, director of the game, etc. — is
-- enforced app-side; participants table controls actual visibility)
create policy "participants read conversations"
  on public.conversations for select
  to authenticated
  using (public.is_conversation_participant(id, auth.uid()));

create policy "authenticated users create conversations"
  on public.conversations for insert
  to authenticated
  with check (created_by = auth.uid());

-- Participants: visible to fellow participants; creator seeds the roster
create policy "participants read roster"
  on public.conversation_participants for select
  to authenticated
  using (public.is_conversation_participant(conversation_id, auth.uid()));

create policy "conversation creator adds participants"
  on public.conversation_participants for insert
  to authenticated
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
    or user_id = auth.uid()
  );

create policy "participants update their own read state"
  on public.conversation_participants for update
  to authenticated
  using (user_id = auth.uid());

-- Messages: participants read + send
create policy "participants read messages"
  on public.messages for select
  to authenticated
  using (public.is_conversation_participant(conversation_id, auth.uid()));

create policy "participants send messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id, auth.uid())
  );

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
