-- One hirer organization record per auth user (simplifies upserts for dev seeding).
create unique index if not exists hirers_one_user_id on public.hirers (user_id);
