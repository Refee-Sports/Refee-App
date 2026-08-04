# Stripe — Local Test Mode Setup

Money flow (all test mode, no real money):
1. **Director saves a card once** — Profile → **SET UP AUTO-PAY**. From then on, completed games (manual or 24h auto-complete) are charged automatically and refs are paid without any taps.
2. **No card on file?** The manual **PAY CREW** button on the game page opens a payment sheet — same math (crew total + 5% platform fee). It's also the fallback if an auto-charge is declined.
3. **Referee** taps **SET UP PAYOUTS** on their profile → Stripe Express onboarding in the browser.
4. Paid refs receive instant Transfers. Refs who haven't onboarded have their share **held** — it releases automatically the next time their payout status is checked after onboarding.

Auto-pay triggers: right after the director taps MARK GAME COMPLETED, and on the tournaments screen load (which also sweeps games past their 24h auto-complete window). A `processing` lock on the job prevents double-charging.

## One-time setup

### 1. Stripe account + keys
- Create a free account at https://dashboard.stripe.com (stay in **Test mode** — orange banner).
- Enable **Connect** (Dashboard → Connect → Get started → choose Express).
- Grab both test keys from https://dashboard.stripe.com/test/apikeys:
  - **Publishable key** (`pk_test_…`) → already slotted in `.env.dev`:
    ```
    EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
    ```
  - **Secret key** (`sk_test_…`) → copy `supabase/functions/.env.example` to `supabase/functions/.env`:
    ```
    STRIPE_SECRET_KEY=sk_test_...
    ```

### 2. Run everything
```bash
# terminal 1 — database (applies migrations incl. 0014)
npx supabase start          # or: npx supabase db reset

# terminal 2 — Stripe edge functions
npx supabase functions serve --env-file supabase/functions/.env

# terminal 3 — the app
npx expo start
```

## Testing the flow

**As Jordan (director, 555-0101):**
1. Open a game with accepted refs → MARK GAME COMPLETED.
2. Tap **PAY CREW** → payment sheet opens.
3. Use test card **4242 4242 4242 4242**, any future expiry, any CVC/ZIP.
4. Success alert tells you how many refs were paid vs held.

Other useful test cards: `4000 0000 0000 9995` (declined — insufficient funds), `4000 0025 0000 3155` (requires 3DS authentication).

**As Devon (referee, 555-0104):**
1. Profile → **SET UP PAYOUTS** → browser opens Stripe Express onboarding.
2. Test-mode onboarding accepts fake data: any name/DOB, SSN `000-00-0000`, test bank routing `110000000` / account `000123456789`.
3. Return to the app — status flips to **PAYOUTS READY**, and any held pay from already-paid games transfers immediately.

**Verify in the Stripe dashboard (test mode):**
- Payments → the director's charge
- Connect → Accounts → the ref's Express account
- Connect → Transfers → per-ref payouts

## Architecture

| Piece | Where |
|---|---|
| `pay-crew` | Edge function — validates caller is the hirer, sums unpaid `amount_due`, creates PaymentIntent (+10% fee) |
| `confirm-payout` | Edge function — verifies the PaymentIntent **with Stripe** (never trusts the client), creates Transfers, marks `payout_status` |
| `connect-onboard` | Edge function — creates/reuses Express account, returns onboarding link |
| `connect-status` | Edge function — checks payout readiness, releases held payouts |
| `lib/payments/queries.ts` | App-side wrappers via `supabase.functions.invoke` |
| Migration 0014 | `jobs.payment_intent_id`, `jobs.payment_status` |

Secrets never touch the app: the secret key lives only in the edge functions' env; the app holds only the publishable key.

## Known limitations (fine for local, revisit for production)
- **No webhooks** — payout runs when the client calls `confirm-payout` after the sheet succeeds. If the app dies between payment and confirm, the game stays `processing`; re-tapping PAY CREW errors ("already paid" comes from Stripe status). Production should add a `payment_intent.succeeded` webhook as the source of truth.
- **Platform fee** is `PLATFORM_FEE_PCT` in `_shared/util.ts` (currently 5% — revisit before launch).
- **Instant transfers assume platform balance** — in test mode this just works; in live mode Stripe balance timing (charge settlement vs transfer) needs `source_transaction` or a balance buffer.
- Refunds/disputes not built.
