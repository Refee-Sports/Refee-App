-- Keep demo job start times in the future so Home / Upcoming lists work after real-world dates pass.

update public.jobs
set starts_at = now() + interval '5 days'
where id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;

update public.jobs
set starts_at = now() + interval '8 days'
where id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid;

update public.jobs
set starts_at = now() + interval '12 days'
where id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid;
