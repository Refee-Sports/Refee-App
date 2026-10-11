-- 0060 · A way for 16 and 17 year olds to say they're interested.
--
-- Refee is 18+ (0043). Plenty of working youth-sports officials are 16 or 17, and
-- we want to know how many before deciding whether a supervised tier is worth
-- building. So someone who enters a 16 or 17 year old's date of birth during
-- sign-up can ask to be emailed when there is something for them.
--
-- What we keep is the minimum needed to email them back and to size the demand:
-- who they are (the signed-in account), the email on that account, whether they
-- are 16 or 17, and optionally a state. Never a date of birth. The email is read
-- here from the account, not accepted from the app, and the row goes when the
-- account does. Under-16s are refused so we never collect anything from younger
-- children; the apps do not even offer the form to them.
--
-- No app role can read or write the table. People join through the function
-- below and staff read it from the database.

create table if not exists public.under_18_waitlist (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  age smallint not null check (age in (16, 17)),
  state text check (state ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now()
);

comment on table public.under_18_waitlist is
  '16-17 year olds who asked to be told about a supervised tier. Backend only. Never holds a date of birth.';

alter table public.under_18_waitlist enable row level security;
revoke all on table public.under_18_waitlist from anon, authenticated;

create or replace function public.join_under_18_waitlist(p_age integer, p_state text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_state text := nullif(upper(btrim(coalesce(p_state, ''))), '');
begin
  if v_user is null then
    raise exception 'Sign in to join this list.' using errcode = '42501';
  end if;

  if p_age is null or p_age not in (16, 17) then
    raise exception 'Only 16 and 17 year olds can join this list.' using errcode = '22023';
  end if;

  if v_state is not null and v_state !~ '^[A-Z]{2}$' then
    raise exception 'State must be a two-letter code.' using errcode = '22023';
  end if;

  select u.email into v_email from auth.users u where u.id = v_user;
  if v_email is null then
    raise exception 'An email address is needed to join this list.' using errcode = '22023';
  end if;

  insert into public.under_18_waitlist (user_id, email, age, state)
  values (v_user, v_email, p_age, v_state)
  on conflict (user_id) do update
    set email = excluded.email,
        age = excluded.age,
        state = excluded.state;
end;
$$;

revoke all on function public.join_under_18_waitlist(integer, text) from public, anon;
grant execute on function public.join_under_18_waitlist(integer, text) to authenticated;
