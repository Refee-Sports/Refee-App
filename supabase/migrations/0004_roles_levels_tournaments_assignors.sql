-- =============================================================
-- REFEE — MIGRATION 0004
-- Adds: roles, levels, tournaments, assignor metrics (role-aware
-- onboarding + director/assignor workflows).
-- Run after 0001_initial_schema, 0002_rls_policies, and
-- 0003_hirers_one_user_unique.
-- =============================================================

-- =============================================================
-- 1. ADD ROLES TO PUBLIC PROFILES
-- =============================================================
alter table public.public_profiles
  add column if not exists primary_role text
    check (primary_role in ('referee', 'assignor', 'director'))
    default 'referee';

-- Track additional roles a user has (a director can also be a ref, etc.)
create table if not exists public.user_roles (
  user_id uuid references public.public_profiles(id) on delete cascade,
  role text not null check (role in ('referee', 'assignor', 'director')),
  added_at timestamptz default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

create policy "anyone authenticated can read user roles"
  on public.user_roles for select
  to authenticated
  using (true);

create policy "users can add their own roles"
  on public.user_roles for insert
  to authenticated
  with check (auth.uid() = user_id);

-- =============================================================
-- 2. LEVELS OF PLAY
-- =============================================================
create table if not exists public.levels (
  id text primary key,
  display_name text not null,
  tier text not null check (tier in ('amateur', 'college', 'professional')),
  sort_order integer
);

insert into public.levels (id, display_name, tier, sort_order) values
  ('youth_rec',   'Youth League / Rec',  'amateur',      1),
  ('high_school', 'High School',         'amateur',      2),
  ('juco',        'JUCO',                'college',      3),
  ('naia',        'NAIA',                'college',      4),
  ('ncaa_mens',   'NCAA Men''s College', 'college',      5),
  ('ncaa_womens', 'NCAA Women''s College','college',     6),
  ('pro_am',      'Pro-Am',              'professional', 7)
on conflict (id) do nothing;

-- Which levels has a ref worked
create table if not exists public.ref_levels (
  ref_id uuid references public.public_profiles(id) on delete cascade,
  level_id text references public.levels(id),
  years_experience integer default 0,
  primary key (ref_id, level_id)
);

alter table public.ref_levels enable row level security;

create policy "anyone authenticated can read ref levels"
  on public.ref_levels for select
  to authenticated
  using (true);

create policy "refs manage their own levels"
  on public.ref_levels for all
  to authenticated
  using (auth.uid() = ref_id);

-- =============================================================
-- 3. UPDATE CERTIFICATIONS — pre-seed common bodies
-- =============================================================
create table if not exists public.cert_bodies (
  id text primary key,
  display_name text not null,
  full_name text,
  sort_order integer,
  is_active boolean default true
);

insert into public.cert_bodies (id, display_name, full_name, sort_order) values
  ('iaabo', 'IAABO', 'International Association of Approved Basketball Officials', 1),
  ('nfhs',  'NFHS',  'National Federation of State High School Associations',      2),
  ('ncaa',  'NCAA',  'NCAA College Officials Program',                              3),
  ('fiba',  'FIBA',  'International Basketball Federation',                         4)
on conflict (id) do nothing;

-- =============================================================
-- 4. TOURNAMENTS — first-class objects
-- =============================================================
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  hirer_id uuid references public.hirers(id) on delete restrict not null,

  -- Basic info
  name text not null,
  description text,
  sport_id text references public.sports(id) not null,

  -- Dates / location
  starts_on date not null,
  ends_on date not null,
  venue_name text,
  venue_city text not null,
  venue_state char(2) not null,

  -- Scope
  total_games integer,
  age_groups text[],
  levels text[],

  -- Staffing model — the big decision
  staffing_model text default 'direct'
    check (staffing_model in ('direct', 'assignor_managed')),

  -- If assignor-managed
  assignor_id uuid references public.public_profiles(id),
  assignor_fee integer,
  assignor_proposal_message text,
  assignor_status text
    check (assignor_status in ('inviting', 'reviewing', 'accepted', 'declined', 'completed')),

  -- Budget
  pay_per_game integer,
  total_ref_budget integer,
  platform_fee_pct numeric(5,2) default 10.00,

  -- Status
  status text default 'draft'
    check (status in ('draft', 'open', 'staffing', 'staffed', 'in_progress', 'completed', 'cancelled')),

  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_tournaments_status on public.tournaments(status);
create index idx_tournaments_dates on public.tournaments(starts_on, ends_on);
create index idx_tournaments_assignor on public.tournaments(assignor_id) where assignor_id is not null;

create trigger trg_tournaments_updated_at
  before update on public.tournaments
  for each row execute function update_updated_at();

-- Link existing jobs to a tournament (optional — a job can be standalone or part of a tournament)
alter table public.jobs
  add column if not exists tournament_id uuid references public.tournaments(id) on delete cascade;

create index if not exists idx_jobs_tournament on public.jobs(tournament_id) where tournament_id is not null;

-- =============================================================
-- 5. ASSIGNOR PROPOSALS
-- When a director invites assignors, each one can submit a proposal
-- =============================================================
create table if not exists public.assignor_proposals (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  assignor_id uuid references public.public_profiles(id) on delete cascade not null,

  -- The proposal
  fee_amount integer not null,
  message text,

  -- Status
  status text default 'submitted'
    check (status in ('invited', 'submitted', 'accepted', 'declined', 'withdrawn')),

  -- Timestamps
  invited_at timestamptz,
  submitted_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz,

  unique (tournament_id, assignor_id)
);

create index idx_proposals_tournament on public.assignor_proposals(tournament_id);
create index idx_proposals_assignor on public.assignor_proposals(assignor_id, status);

alter table public.assignor_proposals enable row level security;

-- Assignor can see proposals they submitted
create policy "assignors see their own proposals"
  on public.assignor_proposals for select
  to authenticated
  using (auth.uid() = assignor_id);

-- Director (via hirer) can see proposals on their tournaments
create policy "directors see proposals on their tournaments"
  on public.assignor_proposals for select
  to authenticated
  using (
    exists (
      select 1 from public.tournaments t
      join public.hirers h on h.id = t.hirer_id
      where t.id = assignor_proposals.tournament_id
      and h.user_id = auth.uid()
    )
  );

-- Assignors create proposals
create policy "assignors create proposals"
  on public.assignor_proposals for insert
  to authenticated
  with check (auth.uid() = assignor_id);

-- Both sides can update (assignor withdraws, director accepts/declines)
create policy "assignor updates own proposal"
  on public.assignor_proposals for update
  to authenticated
  using (auth.uid() = assignor_id);

create policy "director updates proposals on their tournaments"
  on public.assignor_proposals for update
  to authenticated
  using (
    exists (
      select 1 from public.tournaments t
      join public.hirers h on h.id = t.hirer_id
      where t.id = assignor_proposals.tournament_id
      and h.user_id = auth.uid()
    )
  );

-- =============================================================
-- 6. ASSIGNOR METRICS — for the "Pro Assignor" badge
-- =============================================================
alter table public.public_profiles
  add column if not exists is_pro_assignor boolean default false,
  add column if not exists events_assigned integer default 0,
  add column if not exists fill_rate_pct numeric(5,2),
  add column if not exists avg_days_to_fill numeric(4,1);

-- =============================================================
-- 7. TOURNAMENTS RLS
-- =============================================================
alter table public.tournaments enable row level security;

create policy "anyone authenticated can read tournaments"
  on public.tournaments for select
  to authenticated
  using (true);

create policy "directors manage their tournaments"
  on public.tournaments for all
  to authenticated
  using (
    exists (
      select 1 from public.hirers
      where hirers.id = tournaments.hirer_id
      and hirers.user_id = auth.uid()
    )
  );

-- Assignors can update their assigned tournament's staffing status
create policy "assignors can update their assigned tournaments"
  on public.tournaments for update
  to authenticated
  using (auth.uid() = assignor_id);

-- =============================================================
-- 8. CONVENIENCE VIEW: Active assignors with stats
-- For the browse-assignors screen.
-- =============================================================
create or replace view public.active_assignors as
select
  p.id,
  p.display_name,
  p.avatar_url,
  p.city,
  p.state,
  p.rating,
  p.rating_count,
  p.is_pro_assignor,
  p.events_assigned,
  p.fill_rate_pct,
  p.avg_days_to_fill
from public.public_profiles p
where p.primary_role = 'assignor'
   or exists (
     select 1 from public.user_roles ur
     where ur.user_id = p.id and ur.role = 'assignor'
   );
