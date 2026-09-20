-- Take the signed-out key off every table that doesn't serve signed-out people.
--
-- Supabase grants anon full DML on new public tables by default and relies on
-- RLS to hold the line. That works — today every policy but three is scoped
-- `to authenticated`, so the grants are unreachable — but it leaves the safety
-- of the whole database resting on nobody ever writing a policy without that
-- clause. One `using (true)` written without `to authenticated` silently opens
-- a table to the public key that ships inside both apps.
--
-- Grants are the second lock. 0045 did this for the identity tables; this does
-- it for the rest.
--
-- Three tables keep anon SELECT on purpose: the reference lists a signed-out
-- visitor legitimately reads (sports, levels, certification bodies). They hold
-- no user data.
--
-- TRUNCATE matters here too: it is not subject to RLS at all, so the default
-- grant was the only thing standing between the anon role and an empty table.

do $$
declare
  t record;
  keep constant text[] := array['sports', 'levels', 'cert_bodies'];
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'v', 'm', 'p')
       and not (c.relname = any (keep))
  loop
    execute format('revoke all on table public.%I from anon', t.relname);
  end loop;
end
$$;

-- And make sure the three that stay are read-only.
revoke all on table public.sports from anon;
revoke all on table public.levels from anon;
revoke all on table public.cert_bodies from anon;
grant select on table public.sports to anon;
grant select on table public.levels to anon;
grant select on table public.cert_bodies to anon;

-- New tables created from here on should not hand anon anything either.
alter default privileges in schema public revoke all on tables from anon;
