-- A referee's home ZIP, so the feed measures distance from near where they
-- live instead of the middle of their city (which in a big city can be 15–25
-- miles off). Optional. Private like the home pin it produces (0047): only the
-- referee reads it back.

alter table public.private_profiles
  add column if not exists home_zip text
    check (home_zip is null or home_zip ~ '^[0-9]{5}$');
