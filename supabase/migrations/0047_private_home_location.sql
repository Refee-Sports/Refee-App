-- Home coordinates are not public.
--
-- public_profiles is readable by every signed-in account ("anyone
-- authenticated can read public profiles", using (true)) — that is deliberate,
-- it's how people browse officials and directors. But two of its columns were
-- home_lat and home_lng: the geocoded home address of every referee on the
-- platform, readable in bulk by anyone who signs up with a phone number.
--
-- Nothing ever needed them to be public. They exist so a referee can sort games
-- by distance from home, and the only read in the apps is of the caller's own
-- row. So they move to private_profiles, which is already restricted to the
-- owner, and the public table loses them.

alter table public.private_profiles
  add column if not exists home_lat numeric(10, 7),
  add column if not exists home_lng numeric(10, 7);

comment on column public.private_profiles.home_lat is
  'Geocoded home latitude, used only to sort games by distance for this user. Never public.';
comment on column public.private_profiles.home_lng is
  'Geocoded home longitude, used only to sort games by distance for this user. Never public.';

-- Carry across what is already there.
--
-- Not a plain UPDATE joined to private_profiles: a private row is created
-- during onboarding, and accounts that predate that step (or never finished
-- it) have a public profile and no private one. Production is exactly that
-- case — several geocoded users, no private rows at all — so an UPDATE would
-- match nothing and the DROP below would take their coordinates with it.
--
-- Insert-or-update keyed on the id, so a missing row is created rather than
-- skipped. Running as the migration role, the backend-column guard bypasses
-- and identity_* keeps its defaults.
insert into public.private_profiles (id, home_lat, home_lng)
select p.id, p.home_lat, p.home_lng
  from public.public_profiles p
 where p.home_lat is not null
    or p.home_lng is not null
on conflict (id) do update
   set home_lat = excluded.home_lat,
       home_lng = excluded.home_lng;

alter table public.public_profiles
  drop column if exists home_lat,
  drop column if exists home_lng;
