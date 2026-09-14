-- 0034 — game-day details: where exactly to go, which court, how to check in.
--
-- Games only carried a venue name, city and state, so the map pin was the
-- centre of the city and nothing said which gym or court. Tournaments now hold
-- the venue once (street address, ZIP, pin, courts, arrival notes) and each
-- game carries its own copy plus the court it's on. High-school games can say
-- Varsity / JV / Freshman instead of an age bracket.
--
-- All columns are optional so existing rows and older app builds keep working.

alter table public.tournaments
  add column if not exists venue_address text,
  add column if not exists venue_zip text,
  add column if not exists venue_lat numeric,
  add column if not exists venue_lng numeric,
  add column if not exists courts text[] not null default '{}',
  add column if not exists arrival_notes text;

alter table public.jobs
  add column if not exists venue_zip text,
  add column if not exists court text,
  add column if not exists arrival_notes text,
  add column if not exists team_level text;

alter table public.jobs drop constraint if exists jobs_team_level_check;
alter table public.jobs add constraint jobs_team_level_check
  check (team_level is null or team_level in ('varsity', 'jv', 'freshman'));

alter table public.jobs drop constraint if exists jobs_arrival_notes_length;
alter table public.jobs add constraint jobs_arrival_notes_length
  check (arrival_notes is null or char_length(arrival_notes) <= 280);

alter table public.tournaments drop constraint if exists tournaments_arrival_notes_length;
alter table public.tournaments add constraint tournaments_arrival_notes_length
  check (arrival_notes is null or char_length(arrival_notes) <= 280);

comment on column public.tournaments.courts is
  'Courts or gyms at the venue, e.g. {"Main floor","Aux gym · Court 2"}. Games pick one.';
comment on column public.jobs.court is 'Which court or gym at the venue this game is on.';
comment on column public.jobs.arrival_notes is 'Entrance, parking, doors time, check-in — shown to the crew.';
comment on column public.jobs.team_level is 'High school only: varsity, jv or freshman.';

-- Director screens and the director RLS check read games by organizer.
create index if not exists jobs_hirer_id_idx on public.jobs (hirer_id);
