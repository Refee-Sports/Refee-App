-- Billing identifiers are not part of a public org profile.
--
-- hirers is readable by every signed-in account so people can see who posted a
-- game. stripe_customer_id was sitting in that same row. It is not a secret on
-- its own — nothing can be done with it without our Stripe key — but it is an
-- internal billing handle, it identifies a paying customer, and no client has
-- ever needed to read it: the only readers are edge functions running as
-- service_role.
--
-- So it moves to its own table, locked to the backend, the way the webhook
-- ledgers already are.

create table if not exists public.hirer_billing (
  hirer_id uuid primary key references public.hirers(id) on delete cascade,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.hirer_billing is
  'Stripe billing handles for hirers. Backend only — no client ever reads this.';

alter table public.hirer_billing enable row level security;

-- No policies on purpose: service_role bypasses RLS, everyone else is refused.
revoke all on table public.hirer_billing from anon, authenticated;

-- Carry across what is already there.
insert into public.hirer_billing (hirer_id, stripe_customer_id)
select id, stripe_customer_id
  from public.hirers
 where stripe_customer_id is not null
on conflict (hirer_id) do update set stripe_customer_id = excluded.stripe_customer_id;

alter table public.hirers drop column if exists stripe_customer_id;
