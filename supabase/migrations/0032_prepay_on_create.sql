-- 0032 — charge directors when a game is created; pay refs within 48h of
-- completion.
--
-- Until now the director was charged only after a game completed, and the
-- charge-and-payout ran only when the director next opened the app. The
-- agreement is the other way round: collect the crew's pay when the game is
-- booked, and pay the refs out of it within 48 hours of the game finishing.
--
--   prepay-game   edge fn — the app charges the saved card right after create
--   run-payouts   edge fn — every 15 min: charge any new game still uncharged
--                 (covers clients that don't call prepay-game), then settle
--                 finished prepaid games: pay each ref, refund unused slots
--
-- Games created before this migration keep the old pay-after-the-game flow:
-- prepay_required is false for every existing row and true for new ones, so
-- the scheduler never charges a director retroactively.

-- 1. New payment state: charged at booking, crew not yet paid.
alter table public.jobs drop constraint if exists jobs_payment_status_check;
alter table public.jobs add constraint jobs_payment_status_check
  check (payment_status = any (array[
    'unpaid', 'prepaid', 'processing', 'paid', 'failed', 'refunded', 'disputed'
  ]));

-- 2. What was collected up front, so settlement can pay out of it and refund
--    the rest without re-deriving it from a price that may have changed.
alter table public.jobs
  add column if not exists prepay_required boolean not null default false,
  add column if not exists prepaid_crew_cents integer not null default 0,
  add column if not exists prepaid_fee_cents integer not null default 0,
  add column if not exists prepaid_at timestamptz;

-- Existing rows stay false (above); every game created from now on is prepaid.
alter table public.jobs alter column prepay_required set default true;

comment on column public.jobs.prepay_required is
  'Charged at creation (true for games created after 0032). False = legacy post-game charge.';
comment on column public.jobs.prepaid_crew_cents is
  'Crew pay collected at booking: crew_size x pay_per_game x num_games, in cents.';
comment on column public.jobs.prepaid_fee_cents is
  'Platform fee collected at booking, in cents. Refunded pro rata on unfilled slots.';

-- 3. Let pg_cron reach the run-payouts edge function.
create extension if not exists pg_net;

-- Reads the functions URL and a service_role key from Vault, so no secret is
-- stored in this file. Until both secrets exist it does nothing — see
-- docs/PREPAY.md for the two vault.create_secret calls per environment.
create or replace function public.invoke_run_payouts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_key text;
begin
  select decrypted_secret into v_base
  from vault.decrypted_secrets where name = 'refee_functions_base_url';
  select decrypted_secret into v_key
  from vault.decrypted_secrets where name = 'refee_service_role_key';

  if v_base is null or v_key is null then
    raise notice 'run-payouts not configured (vault secrets missing) - skipped';
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_base, '/') || '/functions/v1/run-payouts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function public.invoke_run_payouts() from public, anon, authenticated;

-- 4. Every 15 minutes. Guarded like 0013: local stacks without pg_cron skip it.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'refee-run-payouts';
  perform cron.schedule('refee-run-payouts', '*/15 * * * *', 'select public.invoke_run_payouts()');
exception when others then
  raise notice 'pg_cron unavailable - schedule run-payouts another way';
end $$;
