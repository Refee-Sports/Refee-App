-- A director rates a referee only once the game is over. 0064 required the
-- game to be completed, but complete_game accepts a game as soon as it has
-- started, so a director could mark it completed at tip-off and rate the crew
-- mid-game. The rating now also waits for the scheduled end: start plus the
-- booked length (2 hours when unset, as everywhere else).

drop policy if exists "hirers can rate refs who worked their finished game" on public.ratings;
create policy "hirers can rate refs who worked their finished game"
  on public.ratings for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.hirers h
      join public.jobs j on j.hirer_id = h.id
      join public.job_assignments a on a.job_id = j.id
      where h.id = ratings.hirer_id
        and h.user_id = (select auth.uid())
        and j.id = ratings.job_id
        and j.status = 'completed'
        and now() >= j.starts_at + make_interval(mins => coalesce(j.duration_minutes, 120))
        and a.ref_id = ratings.ref_id
        and a.status = 'completed'
    )
  );
