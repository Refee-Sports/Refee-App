-- Lock legal name and date of birth once the ID check is under way.
--
-- These are what Didit matches the ID against. Until now the person could
-- rewrite them at any time, so a verified badge could be carried over to a
-- different name or birthday. They stay editable before the check (and after a
-- declined, expired or abandoned one, so a typo can be fixed and retried); from
-- in_review on, only the backend can change them. Writing back the same values
-- is allowed, so signing up for a second role still works.

create or replace function public.guard_verified_identity_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if old.identity_status in ('in_review', 'approved')
     and (new.legal_first_name, new.legal_last_name, new.date_of_birth)
         is distinct from (old.legal_first_name, old.legal_last_name, old.date_of_birth)
  then
    raise exception 'Your legal name and date of birth are locked once your ID is verified. Contact support to change them.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_private_profiles_guard_identity_fields on public.private_profiles;
create trigger trg_private_profiles_guard_identity_fields
  before update on public.private_profiles
  for each row execute function public.guard_verified_identity_fields();
