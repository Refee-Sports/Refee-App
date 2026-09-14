-- 0038 · Reference tables are read-only to the apps.
--
-- sports, levels and cert_bodies had row-level security off and full grants
-- for anon and authenticated, so anyone holding the public anon key (it ships
-- in the website) could insert, edit or delete them through the REST API.
-- They're lookup data that only migrations and the seed write.

alter table public.sports enable row level security;
alter table public.levels enable row level security;
alter table public.cert_bodies enable row level security;

revoke insert, update, delete, truncate, references, trigger
  on public.sports, public.levels, public.cert_bodies
  from anon, authenticated;

-- Readable by everyone, signed in or not (onboarding lists them).
drop policy if exists "anyone can read sports" on public.sports;
create policy "anyone can read sports" on public.sports for select to anon, authenticated using (true);

drop policy if exists "anyone can read levels" on public.levels;
create policy "anyone can read levels" on public.levels for select to anon, authenticated using (true);

drop policy if exists "anyone can read certification bodies" on public.cert_bodies;
create policy "anyone can read certification bodies" on public.cert_bodies for select to anon, authenticated using (true);
