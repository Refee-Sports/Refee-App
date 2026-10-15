-- What the dashboards need that wasn't recorded.
--
-- 1. How each application ended. "declined" alone can't say who declined: a
--    referee cancelling their own application, an organizer saying no, and the
--    automatic close when the referee is confirmed on an overlapping game
--    (0065) all write it. application_outcome records which, so a referee's
--    approval rate counts only organizers' decisions.
--      approved   the organizer (or auto-accept) took them
--      declined   the organizer said no
--      withdrawn  the referee cancelled their own application
--      closed     closed automatically: they were booked on a game at the same time
-- 2. When a game's crew first filled (filled_at), so time to fill can be
--    measured from created_at. Recorded now, shown later.
-- History before this migration has no outcome or fill time; both build up.

alter table public.job_assignments
  add column if not exists application_outcome text
    check (application_outcome in ('approved', 'declined', 'withdrawn', 'closed'));

create or replace function public.record_application_outcome()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Applying again starts a new application.
  if new.status = 'pending' then
    new.application_outcome := null;
    return new;
  end if;
  -- Re-applying to an auto-accept game goes straight to accepted.
  if old.status in ('declined', 'withdrawn') and new.status = 'accepted' then
    new.application_outcome := 'approved';
    return new;
  end if;
  if old.status is distinct from 'pending' then
    return new;
  end if;
  new.application_outcome := case
    when new.status in ('accepted', 'offered', 'needs_reconfirm') then 'approved'
    -- Nested inside another trigger: the overlap close from 0065.
    when pg_trigger_depth() > 1 then 'closed'
    when (select auth.uid()) = new.ref_id then 'withdrawn'
    else 'declined'
  end;
  return new;
end;
$$;

drop trigger if exists trg_job_assignments_application_outcome on public.job_assignments;
create trigger trg_job_assignments_application_outcome
  before update of status on public.job_assignments
  for each row execute function public.record_application_outcome();

-- Auto-accepted applications never sit in pending: they're approved on arrival.
create or replace function public.record_auto_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'accepted' and new.applied_at is not null and new.offered_at is null
     and new.application_outcome is null then
    new.application_outcome := 'approved';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_job_assignments_auto_approval on public.job_assignments;
create trigger trg_job_assignments_auto_approval
  before insert on public.job_assignments
  for each row execute function public.record_auto_approval();

-- ── Time to fill ─────────────────────────────────────────────────────────────

alter table public.jobs
  add column if not exists filled_at timestamptz;

create or replace function public.record_job_filled()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'staffed' and old.status is distinct from 'staffed' and new.filled_at is null then
    new.filled_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_jobs_record_filled on public.jobs;
create trigger trg_jobs_record_filled
  before update of status on public.jobs
  for each row execute function public.record_job_filled();
