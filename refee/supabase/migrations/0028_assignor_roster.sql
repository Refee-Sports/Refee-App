-- =============================================================
-- REFEE — MIGRATION 0019: ASSIGNOR ROSTER + GAME STAFFING MODE
-- Builds out the assignor role (schema for tournaments/proposals
-- already existed in 0004; this adds the roster + per-game
-- staffing mechanics needed to actually staff a tournament).
--
-- Model:
--  - A director invites an assignor to a tournament (assignor_proposals,
--    already exists). Once accepted, tournaments.assignor_id /
--    assignor_status = 'accepted' marks the assignor as staffing it.
--  - The assignor builds a roster of referees (assignor_rosters, new).
--  - For each game (job) inside that tournament, the assignor picks
--    a staffing mode: 'assignor_direct' (assignor places a roster ref
--    directly — instantly accepted, no apply step) or 'self_assign'
--    (roster refs see the game and can claim it themselves, instantly
--    accepted, first-come). This choice is per-game, per Gerda (Aug 2026).
-- =============================================================

-- =============================================================
-- 1. ASSIGNOR ROSTERS
-- Who's on an assignor's roster, and the invite/request lifecycle.
-- Directional for now (assignor invites); referee-initiated "request
-- to join" can reuse this same table (status starts 'requested'
-- instead of 'invited') once that flow is built.
-- =============================================================
create table if not exists public.assignor_rosters (
  id uuid primary key default gen_random_uuid(),
  assignor_id uuid references public.public_profiles(id) on delete cascade not null,
  ref_id uuid references public.public_profiles(id) on delete cascade not null,

  status text default 'invited'
    check (status in ('invited', 'requested', 'accepted', 'declined', 'removed')),

  invited_at timestamptz default now(),
  responded_at timestamptz,
  removed_at timestamptz,

  unique (assignor_id, ref_id)
);

create index if not exists idx_assignor_rosters_assignor on public.assignor_rosters(assignor_id, status);
create index if not exists idx_assignor_rosters_ref on public.assignor_rosters(ref_id, status);

alter table public.assignor_rosters enable row level security;

-- Assignor manages their own roster (invite, remove)
create policy "assignors manage their own roster"
  on public.assignor_rosters for all
  to authenticated
  using (auth.uid() = assignor_id)
  with check (auth.uid() = assignor_id);

-- Ref can see roster rows they're on, and respond (accept/decline)
create policy "refs can see their own roster invites"
  on public.assignor_rosters for select
  to authenticated
  using (auth.uid() = ref_id);

create policy "refs can respond to their own roster invites"
  on public.assignor_rosters for update
  to authenticated
  using (auth.uid() = ref_id)
  with check (auth.uid() = ref_id);

-- =============================================================
-- 2. GAME STAFFING MODE
-- Only meaningful for games inside an assignor_managed tournament.
-- =============================================================
alter table public.jobs
  add column if not exists assignor_staffing_mode text
    check (assignor_staffing_mode in ('assignor_direct', 'self_assign'));

-- =============================================================
-- 3. RLS — let the accepted assignor of a tournament staff its games
-- =============================================================

-- Assignor can flip staffing mode (and other fields, same "for all"
-- looseness as hirer/director policies elsewhere in this schema) on
-- games that belong to a tournament they're the accepted assignor of.
create policy "assignors manage games on their assigned tournaments"
  on public.jobs for update
  to authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = jobs.tournament_id
      and t.assignor_id = auth.uid()
      and t.assignor_status = 'accepted'
    )
  );

-- Assignor can see assignments on their tournament's games (mirrors
-- the equivalent hirer policy on job_assignments)
create policy "assignors can see assignments on their tournaments' games"
  on public.job_assignments for select
  to authenticated
  using (
    exists (
      select 1 from public.jobs j
      join public.tournaments t on t.id = j.tournament_id
      where j.id = job_assignments.job_id
      and t.assignor_id = auth.uid()
      and t.assignor_status = 'accepted'
    )
  );

-- Assignor can directly place a roster ref onto one of their games
-- (assignor_direct mode) — bypasses the normal apply step.
create policy "assignors can directly assign roster refs to their games"
  on public.job_assignments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.jobs j
      join public.tournaments t on t.id = j.tournament_id
      where j.id = job_assignments.job_id
      and j.assignor_staffing_mode = 'assignor_direct'
      and t.assignor_id = auth.uid()
      and t.assignor_status = 'accepted'
    )
    and exists (
      select 1 from public.assignor_rosters r
      where r.assignor_id = auth.uid()
      and r.ref_id = job_assignments.ref_id
      and r.status = 'accepted'
    )
  );

-- Assignor can update (approve/remove) assignments on their games too
-- (e.g. bump a ref off a self_assign slot that filled twice, adjust role)
create policy "assignors can update assignments on their games"
  on public.job_assignments for update
  to authenticated
  using (
    exists (
      select 1 from public.jobs j
      join public.tournaments t on t.id = j.tournament_id
      where j.id = job_assignments.job_id
      and t.assignor_id = auth.uid()
      and t.assignor_status = 'accepted'
    )
  );

-- =============================================================
-- 4. CONVENIENCE VIEW — an assignor's accepted roster with profile info
-- =============================================================
create or replace view public.assignor_roster_members as
select
  r.id as roster_id,
  r.assignor_id,
  r.ref_id,
  r.status,
  r.invited_at,
  r.responded_at,
  p.display_name,
  p.first_name,
  p.last_initial,
  p.avatar_url,
  p.city,
  p.state,
  p.rating,
  p.rating_count,
  p.is_available
from public.assignor_rosters r
join public.public_profiles p on p.id = r.ref_id;
