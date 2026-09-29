-- The oldest app version still allowed to talk to this backend.
--
-- Once the app is in the stores, old installs can't be recalled: a migration
-- that drops something they use would break them. The rule is add → ship →
-- raise the minimum → remove. This is the "raise the minimum" step: the app
-- reads it at launch and shows an "Update Refee" screen to anything older.
--
-- Public on purpose (it has to answer before anyone signs in) and harmless —
-- it holds a version number, nothing else. Only the dashboard / service role
-- can change it.

create table if not exists public.app_min_versions (
  platform text primary key check (platform in ('ios', 'android')),
  min_version text not null check (min_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  updated_at timestamptz not null default now()
);

insert into public.app_min_versions (platform, min_version)
values ('ios', '1.0.0'), ('android', '1.0.0')
on conflict (platform) do nothing;

alter table public.app_min_versions enable row level security;

-- No policies: the table is not readable through the API. The function below
-- is the only way in.
revoke all on public.app_min_versions from anon, authenticated;

create or replace function public.get_min_app_version(p_platform text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.min_version
  from public.app_min_versions m
  where m.platform = lower(coalesce(p_platform, ''));
$$;

revoke all on function public.get_min_app_version(text) from public;
grant execute on function public.get_min_app_version(text) to anon, authenticated;
