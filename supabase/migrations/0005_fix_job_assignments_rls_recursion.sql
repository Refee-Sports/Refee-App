-- Fix infinite recursion in job_assignments SELECT policy.
-- The crew-visibility policy queried job_assignments from within
-- job_assignments RLS, which breaks INSERT/UPDATE (upsert) paths.

create or replace function public.is_accepted_crew_member(p_job_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.job_assignments
    where job_id = p_job_id
      and ref_id = p_user_id
      and status = 'accepted'
  );
$$;

revoke all on function public.is_accepted_crew_member(uuid, uuid) from public;
grant execute on function public.is_accepted_crew_member(uuid, uuid) to authenticated;

drop policy if exists "refs can see crew on jobs they are accepted to" on public.job_assignments;

create policy "refs can see crew on jobs they are accepted to"
  on public.job_assignments for select
  to authenticated
  using (public.is_accepted_crew_member(job_id, auth.uid()));
