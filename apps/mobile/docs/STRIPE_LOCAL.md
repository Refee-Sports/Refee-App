# Local Edge Functions & Env

Edge functions now include: Stripe (`pay-crew`, `auto-pay`, `confirm-payout`, `connect-onboard`, `connect-status`, `setup-payment-method`, `stripe-webhook`), `geocode`, and `send-push`. All run under one command:
```bash
npx supabase functions serve --env-file supabase/functions/.env
```
`supabase/functions/.env` keys: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (required for signed webhook events). Optional: `GEOCODER=google` + `GOOGLE_MAPS_API_KEY` (geocoding defaults to free Nominatim — no key needed). Push needs no secret (Expo push API is keyless for the send).

**Push caveat:** notifications only deliver in an **EAS dev build** on a physical device. Expo Go (SDK 53+) and simulators can't get push tokens — the code no-ops there, so nothing breaks; you just won't see banners until you build.

---

# Stripe — Local Test Mode Setup

Money flow (all test mode, no real money):
1. **Director saves a card once** — Profile → **SET UP AUTO-PAY**. From then on, completed games (manual or 24h auto-complete) are charged automatically and refs are paid without any taps.
2. **No card on file?** The manual **PAY CREW** button on the game page opens a payment sheet — same math (crew total + 5% platform fee). It's also the fallback if an auto-charge is declined.
3. **Referee** taps **SET UP PAYOUTS** on their profile → Stripe Express onboarding in the browser.
4. Paid refs receive Transfers to their Stripe connected-account balance. This is not the same as bank arrival: a first US payout may take about 7 days and standard payouts are typically about 2 business days. Refs who haven't onboarded have their share **held** — it releases automatically the next time their payout status is checked after onboarding.

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

### 2. Signed webhook forwarding

Run Stripe CLI forwarding during local payment tests and copy its `whsec_…`
value into `supabase/functions/.env`:

```bash
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

The endpoint intentionally has Supabase JWT verification disabled because
Stripe authenticates the raw request with the `stripe-signature` header.
Application callers still cannot forge an accepted event.

### 3. Run everything
⚠️ Stripe is a **native module — it does NOT work in Expo Go.** You must run a
native build. On the iOS Simulator that means `expo run:ios`, not `expo start`.

```bash
# terminal 1 — database (applies migrations)
npm run supabase:start          # or: npm run supabase:db:reset

# terminal 2 — edge functions (Stripe, geocode, push)
npx supabase functions serve --env-file supabase/functions/.env

# terminal 3 — native app on the iOS Simulator, using the LOCAL env
# (.env.local.supabase already holds the local Supabase URL + your pk_test_ key)
REFEE_ENV_FILE=.env.local.supabase EXPO_NO_DOTENV=1 npx expo run:ios
```
First `expo run:ios` compiles native code (a few minutes); later runs are fast.
The Stripe **payment sheet works on the Simulator**; push notifications do not
(simulators can't get push tokens — test push on a physical device).

### Testing on a physical phone
The Simulator reaches `127.0.0.1`; a phone cannot. So for on-device testing the
backend must be reachable and the app must be a real build:
1. **Backend** — either deploy to **hosted Supabase** (recommended: `supabase db push`,
   `supabase functions deploy`, and `supabase secrets set STRIPE_SECRET_KEY=sk_test_…`),
   or point the app at your laptop's LAN IP (`http://192.168.1.162:54321`) with phone
   + laptop on the same Wi-Fi and `functions serve` running.
2. **Build** — `eas build --profile development --platform ios`, install on the phone.
   The publishable key is baked in at build time from the env; set the hosted
   Supabase URL/anon + `pk_test_` in the env the build uses (EAS secrets or eas.json).

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
| `pay-crew` | Edge function — validates caller is the hirer, sums unpaid `amount_due`, creates PaymentIntent (+5% fee) |
| `confirm-payout` | Edge function — verifies the PaymentIntent **with Stripe** (never trusts the client), creates Transfers, marks `payout_status` |
| `stripe-webhook` | Public, Stripe-signed source of truth — settles intents, records transfer/refund/dispute states, flags manual review, and deduplicates event replays |
| `connect-onboard` | Edge function — creates/reuses Express account, returns onboarding link |
| `connect-status` | Edge function — checks payout readiness, releases held payouts |
| `lib/payments/queries.ts` | App-side wrappers via `supabase.functions.invoke` |
| Migrations 0014/0025/0026 | Payment fields/statuses, unique Stripe reference indexes, refund/dispute review state, and service-only webhook event ledger |

Secrets never touch the app: the secret key lives only in the edge functions' env; the app holds only the publishable key.

## Known limitations (revisit before production)
- **Webhook deployment/config remains** — deploy `stripe-webhook`, set `STRIPE_WEBHOOK_SECRET`, register the live endpoint in Stripe, and prove one real test-mode `payment_intent.succeeded` event end to end. Local signed-event and replay rejection are verified.
- **Platform fee** is `PLATFORM_FEE_PCT` in `_shared/util.ts` (currently 5% — revisit before launch).
- Transfers use the originating charge as `source_transaction`; live-mode timing still needs a Connect balance/failure drill.
- Refund/dispute events are reconciled and lock repeat payment, but connected-account transfers are intentionally **not auto-reversed** until the loss-liability policy is approved. Deploy and run Stripe test-mode refund/dispute drills after that decision.
