-- 0043 · Refee is for adults.
--
-- Officiating on Refee means being paid, entering a contract, and standing
-- alone in a gym with other people's children. All three are 18+.
--
-- Age is checked twice, because a date someone types is not evidence:
--
--  * At sign-up, the apps collect a date of birth and the trigger below
--    refuses anything under 18. This is the honest gate — it tells someone
--    straight away instead of after they've photographed their ID.
--  * At verification, Didit reads the date of birth off a government ID and
--    didit-webhook records that one, overwriting whatever was typed. A minor
--    is declined there no matter what the form said.
--
-- And is_identity_verified — the question every gate in 0042 asks — now
-- refuses a date of birth known to be under 18, whatever the status column
-- says. So even a wrongly-approved account unlocks nothing.

create or replace function public.is_adult(p_dob date)
returns boolean
language sql
stable
set search_path = ''
as $$
  -- Null is "we don't know", which is not the same as "old enough".
  select p_dob is not null and p_dob <= (current_date - interval '18 years')::date;
$$;

revoke all on function public.is_adult(date) from public, anon;
grant execute on function public.is_adult(date) to authenticated;

-- ── The sign-up gate ─────────────────────────────────────────────────────────
-- Backend writes (the webhook's verified date, seeds) pass through; anything
-- from an app has to carry a date of birth, and an adult one.

create or replace function public.require_adult_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  -- A row that isn't theirs is RLS's business, not ours. Saying "enter your
  -- date of birth" to someone writing into another person's profile would
  -- hide the real answer, which is that they can't.
  if new.id is distinct from (select auth.uid()) then
    return new;
  end if;

  if new.date_of_birth is null then
    raise exception 'Enter your date of birth.'
      using errcode = 'check_violation';
  end if;

  if not public.is_adult(new.date_of_birth) then
    raise exception 'You must be 18 or older to use Refee.'
      using errcode = 'check_violation',
            hint = 'Officiating on Refee means being paid and working with minors.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_private_profiles_require_adult on public.private_profiles;
create trigger trg_private_profiles_require_adult
  before insert or update on public.private_profiles
  for each row execute function public.require_adult_profile();

-- ── The gate every action already asks ───────────────────────────────────────
-- Unchanged from 0041 apart from the age clause.

create or replace function public.is_identity_verified(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.private_profiles p
    where p.id = p_user
      and p.identity_status = 'approved'
      -- A date of birth we know to be under 18 closes every gate. An unknown
      -- one doesn't: accounts approved before this migration keep working,
      -- and the next verification fills the date in.
      and not (p.date_of_birth is not null and not public.is_adult(p.date_of_birth))
  );
$$;

revoke all on function public.is_identity_verified(uuid) from public, anon;
grant execute on function public.is_identity_verified(uuid) to authenticated;
