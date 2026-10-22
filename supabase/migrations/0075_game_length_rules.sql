-- A basketball game is 2 halves or 4 quarters, and a half runs 8 to 20
-- minutes. game_format is already limited to those two values and
-- period_minutes to 4–30; this limits halves to 8–20.
--
-- NOT VALID: enforced for every new or edited game and tournament, without
-- failing the migration on any older row that was saved with a longer half.

alter table public.jobs
  add constraint jobs_half_length_check
  check (game_format is distinct from 'halves' or period_minutes is null or period_minutes between 8 and 20)
  not valid;

alter table public.tournaments
  add constraint tournaments_half_length_check
  check (game_format is distinct from 'halves' or period_minutes is null or period_minutes between 8 and 20)
  not valid;
