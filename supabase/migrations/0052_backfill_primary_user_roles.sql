-- Every profile's primary role is also a held role. Older onboarding paths only
-- wrote public_profiles.primary_role, so taking a second role could make the
-- original role disappear from the switcher after primary_role changed.
insert into public.user_roles (user_id, role)
select id, primary_role
from public.public_profiles
where primary_role in ('referee', 'assignor', 'director')
on conflict (user_id, role) do nothing;
