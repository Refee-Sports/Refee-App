-- =============================================================
-- REFEE — MIGRATION 0016: PUSH TOKENS
-- Expo push tokens per user/device for notifications.
-- =============================================================

create table public.push_tokens (
  token text primary key,
  user_id uuid references public.public_profiles(id) on delete cascade not null,
  platform text,
  updated_at timestamptz default now()
);

create index idx_push_tokens_user on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

create policy "users manage their own push tokens"
  on public.push_tokens for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
