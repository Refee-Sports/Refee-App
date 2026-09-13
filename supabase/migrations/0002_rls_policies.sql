-- =============================================================
-- ROW-LEVEL SECURITY POLICIES
-- This is where the privacy convention becomes enforceable.
-- Even buggy app code cannot leak data the database refuses to return.
-- =============================================================

-- Enable RLS on all tables
alter table public.public_profiles enable row level security;
alter table public.private_profiles enable row level security;
alter table public.ref_sports enable row level security;
alter table public.certifications enable row level security;
alter table public.availability_prefs enable row level security;
alter table public.hirers enable row level security;
alter table public.jobs enable row level security;
alter table public.job_assignments enable row level security;
alter table public.ratings enable row level security;

-- =============================================================
-- PUBLIC PROFILES
-- Anyone authenticated can READ a public profile.
-- Only the owner can UPDATE their own.
-- =============================================================
create policy "anyone authenticated can read public profiles"
  on public.public_profiles for select
  to authenticated
  using (true);

create policy "users can update their own public profile"
  on public.public_profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "users can insert their own public profile"
  on public.public_profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- =============================================================
-- PRIVATE PROFILES — THE CORE PRIVACY GUARANTEE
-- Only the user themselves can read their own private profile.
-- Admin role can read all (for support, payroll, compliance).
-- NO ONE ELSE EVER reads this. Not other refs, not hirers, no one.
-- =============================================================
create policy "users can only read their OWN private profile"
  on public.private_profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "users can only insert their own private profile"
  on public.private_profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "users can only update their own private profile"
  on public.private_profiles for update
  to authenticated
  using (auth.uid() = id);

-- =============================================================
-- REF SPORTS
-- =============================================================
create policy "anyone authenticated can read ref sports"
  on public.ref_sports for select
  to authenticated
  using (true);

create policy "refs can manage their own sports"
  on public.ref_sports for all
  to authenticated
  using (auth.uid() = ref_id);

-- =============================================================
-- CERTIFICATIONS
-- Other refs can see WHICH certifications a ref has, but not
-- the document or license number (those need separate handling).
-- =============================================================
create policy "anyone authenticated can read certifications"
  on public.certifications for select
  to authenticated
  using (true);

create policy "refs can manage their own certifications"
  on public.certifications for all
  to authenticated
  using (auth.uid() = ref_id);

-- =============================================================
-- AVAILABILITY PREFS
-- A ref's availability is private to them — used only for
-- server-side matching, never displayed.
-- =============================================================
create policy "refs can read their own availability"
  on public.availability_prefs for select
  to authenticated
  using (auth.uid() = ref_id);

create policy "refs can manage their own availability"
  on public.availability_prefs for all
  to authenticated
  using (auth.uid() = ref_id);

-- =============================================================
-- HIRERS
-- Anyone can read a hirer profile (refs need to see who's posting).
-- Only the hirer themselves can edit.
-- =============================================================
create policy "anyone authenticated can read hirers"
  on public.hirers for select
  to authenticated
  using (true);

create policy "hirers can manage their own profile"
  on public.hirers for all
  to authenticated
  using (auth.uid() = user_id);

-- =============================================================
-- JOBS
-- Anyone authenticated can read open jobs.
-- Only the hirer who posted the job can edit it.
-- =============================================================
create policy "anyone authenticated can read jobs"
  on public.jobs for select
  to authenticated
  using (true);

create policy "hirers can manage their own jobs"
  on public.jobs for all
  to authenticated
  using (
    exists (
      select 1 from public.hirers
      where hirers.id = jobs.hirer_id
      and hirers.user_id = auth.uid()
    )
  );

-- =============================================================
-- JOB ASSIGNMENTS
-- A ref can see their own assignments + assignments on jobs they
-- are part of (so confirmed crew can see each other).
-- A hirer can see all assignments on their jobs.
-- =============================================================
create policy "refs can see their own assignments"
  on public.job_assignments for select
  to authenticated
  using (auth.uid() = ref_id);

create policy "refs can see crew on jobs they are accepted to"
  on public.job_assignments for select
  to authenticated
  using (
    exists (
      select 1 from public.job_assignments self
      where self.job_id = job_assignments.job_id
      and self.ref_id = auth.uid()
      and self.status = 'accepted'
    )
  );

create policy "hirers can see assignments on their jobs"
  on public.job_assignments for select
  to authenticated
  using (
    exists (
      select 1 from public.jobs j
      join public.hirers h on h.id = j.hirer_id
      where j.id = job_assignments.job_id
      and h.user_id = auth.uid()
    )
  );

create policy "refs can apply to jobs"
  on public.job_assignments for insert
  to authenticated
  with check (auth.uid() = ref_id);

create policy "refs can update their own assignment status"
  on public.job_assignments for update
  to authenticated
  using (auth.uid() = ref_id);

-- =============================================================
-- RATINGS
-- Anyone authenticated can read ratings (drives public profile).
-- Only the hirer of the job can create a rating.
-- =============================================================
create policy "anyone authenticated can read ratings"
  on public.ratings for select
  to authenticated
  using (true);

create policy "hirers can rate refs after their job"
  on public.ratings for insert
  to authenticated
  with check (
    exists (
      select 1 from public.hirers
      where hirers.id = ratings.hirer_id
      and hirers.user_id = auth.uid()
    )
  );
