-- Show rate: the late-withdrawal penalty.
--
-- A referee who drops out inside 48 hours (withdrew_late, 0061) or doesn't turn
-- up (no_show, 0064) leaves a crew short. Directors deciding between applicants
-- see how often each referee kept the games they confirmed over the last year;
-- referees see their own. Nothing is blocked or charged: the number speaks.
--
-- Counts only. No titles, dates or organizers, so it reveals no more about a
-- referee's schedule than their rating does.

create or replace function public.referee_reliability(p_ref_ids uuid[])
returns table (ref_id uuid, kept integer, late_withdrawals integer, no_shows integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, s.kept, s.late_withdrawals, s.no_shows
  from (select distinct unnest(p_ref_ids[1:200]) as id) r
  cross join lateral (
    select count(*) filter (where a.status = 'completed')::integer as kept,
           count(*) filter (where a.status = 'withdrawn' and a.withdrew_late)::integer as late_withdrawals,
           count(*) filter (where a.status = 'no_show')::integer as no_shows
    from public.job_assignments a
    join public.jobs j on j.id = a.job_id
    where a.ref_id = r.id
      and j.starts_at > now() - interval '365 days'
      and j.starts_at < now()
  ) s;
$$;

revoke all on function public.referee_reliability(uuid[]) from public, anon;
grant execute on function public.referee_reliability(uuid[]) to authenticated;
