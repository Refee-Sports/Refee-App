-- A basketball game is 2 halves or 4 quarters, and a half runs at most 20
-- minutes. game_format is already limited to those two values and
-- period_minutes to 4–30; this caps halves at 20.
--
-- NOT VALID: enforced for every new or edited game and tournament, without
-- failing the migration on any older row that was saved with a longer half.

alter table public.jobs
  add constraint jobs_half_length_check
  check (game_format is distinct from 'halves' or period_minutes is null or period_minutes <= 20)
  not valid;

alter table public.tournaments
  add constraint tournaments_half_length_check
  check (game_format is distinct from 'halves' or period_minutes is null or period_minutes <= 20)
  not valid;
