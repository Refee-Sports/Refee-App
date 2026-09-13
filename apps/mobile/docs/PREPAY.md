# Charge at booking, pay out within 48 hours

The agreement with directors and assignors: the crew's pay is collected when a
game is created, and referees are paid within 48 hours of the game completing.

## How it works

| Step | Where | What happens |
|---|---|---|
| Game created | web app → `prepay-game` | The director's saved card is charged for every crew slot at the posted pay, plus the platform fee (`prepayQuote` in `_shared/prepay.ts`). The game is marked `payment_status = 'prepaid'`. No card on file → the web app asks for one, then charges. |
| Safety net | `run-payouts`, every 15 min | Any upcoming game created since migration 0032 that still hasn't been charged is charged, for directors with a card on file. This covers clients that don't call `prepay-game` (the mobile app today). |
| Game completes | `complete_game` RPC, or `sweep_game_lifecycle` 24h after the end | Each confirmed ref's `amount_due` is locked in. |
| Payout | `run-payouts`, every 15 min | Each ref is paid their `amount_due` out of the booking charge (Stripe transfer, `source_transaction` = that charge). Refs without a finished payout account are held (`payout_status = 'processing'`) and released when they onboard. The crew money nobody earned — unfilled slots, dropped refs, an early cancellation — is refunded, with the matching share of the fee (`prepaySettlement`). One refund per game, idempotent. |

Because games auto-complete 24 hours after they end and `run-payouts` runs
every 15 minutes, payout lands roughly 24h after the game — inside the 48h
window even when the director never closes the game out.

### Which games

`jobs.prepay_required` is `true` for every game created after migration 0032
and `false` for all earlier rows, so nothing already posted is charged
retroactively. Legacy games keep the old flow: charged after completion by
`auto-pay` / `pay-crew`.

### Payment states

`unpaid` → `processing` (charge in flight) → `prepaid` (collected, crew not yet
paid) → `paid` (settled). A declined card leaves `failed`; the web game screen
offers "Charge card now" to retry. `refunded` when nobody was owed anything.

### Edge cases

- **Director raises the pay or crew size after being charged.** The crew is then
  owed more than was collected. `run-payouts` does not draw past the charge: it
  sets `payment_issue_requires_review = true`, `payment_review_reason =
  'prepay_shortfall'` for a person to resolve.
- **Webhook.** `payment_intent.succeeded` for a booking charge
  (`metadata.refee_charge_kind = 'prepay'`) is recorded as `prepaid`, not
  settled — settling it would mark the game paid and stop the payout. Refunds
  tagged `refee_refund_kind = 'unused_prepay'` are recorded without flagging the
  game for review.

## Setting it up in an environment

Migration 0032 enables `pg_net`, adds the columns, and schedules
`refee-run-payouts` every 15 minutes. The job reads two Vault secrets and does
nothing until both exist:

```sql
-- URL the database can reach the functions gateway at.
--   Hosted: https://<project-ref>.supabase.co
--   Local:  http://supabase_kong_refee:8000   (from inside the db container)
select vault.create_secret('https://<project-ref>.supabase.co', 'refee_functions_base_url');

-- A service_role JWT. run-payouts rejects any other role.
select vault.create_secret('<service_role key>', 'refee_service_role_key');
```

Deploy the functions: `supabase functions deploy prepay-game run-payouts stripe-webhook`.

Locally, functions added after `supabase start` are not served until the edge
runtime is recreated — run `supabase functions serve --env-file
supabase/functions/.env`, or restart the stack.

## Checking it

```sql
select jobname, schedule from cron.job;                        -- refee-run-payouts */15
select public.invoke_run_payouts();                            -- run it now
select status_code, left(content, 200) from net._http_response order by id desc limit 1;
```

Unit tests: `lib/payments/prepay.test.ts` (quote and settlement maths).
