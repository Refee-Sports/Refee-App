-- Free-text note of the leagues/organizations a referee has worked, collected
-- (optionally) at sign-up. Lives on ref_sports so it is per-sport and inherits
-- that table's existing RLS.
alter table public.ref_sports
  add column leagues_worked text
  check (leagues_worked is null or char_length(leagues_worked) <= 300);
