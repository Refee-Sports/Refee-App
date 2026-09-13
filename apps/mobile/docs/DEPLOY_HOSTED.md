# REFEE — Hosted Supabase Deploy Runbook

Get the backend onto hosted Supabase so a **physical phone** (and eventually production) can reach it over the internet. This covers: create project → link → push schema → deploy edge functions → set secrets → point the app at it → build for device.

All Stripe stays in **test mode** — no real money.

Prereqs: Supabase CLI (`npx supabase`), your Stripe test keys, and an Expo account for the device build.

---

## 1. Create the hosted project (one-time, in the browser)
1. Go to <https://supabase.com/dashboard> → **New project**.
2. Name it e.g. `refee-dev`, pick a region near you, set a strong DB password (save it).
3. When it finishes provisioning, grab these from **Project Settings**:
   - **Project ref** (Settings → General → "Reference ID", looks like `abcd1234…`)
   - **Project URL** (Settings → API → `https://<ref>.supabase.co`)
   - **anon public key** (Settings → API → Project API keys → `anon`)
   - You do **not** need the service-role key locally — the functions get it automatically when deployed.

## 2. Link the CLI to the project
```bash
# from the repo root — supabase/ lives there
npx supabase login                 # opens browser, authorizes the CLI
npx supabase link --project-ref <YOUR_PROJECT_REF>
# it will prompt for the DB password from step 1
```

## 3. Push the database schema (all 16 migrations)
```bash
npx supabase db push
```
This runs `supabase/migrations/0001 … 0016` against the hosted DB. Verify in the
dashboard → **Table Editor** that tables exist (public_profiles, jobs, conversations, push_tokens, …).

> Storage bucket + policies (migration 0011 `avatars`) and RLS all apply automatically.

## 4. Seed test users (optional but recommended)
The seed only auto-runs on local `db reset`. To load the six test users into hosted:
```bash
npx supabase db push --include-seed        # if your CLI supports it
# — or — run it manually:
# Dashboard → SQL Editor → paste the contents of supabase/seed.sql → Run
```
> Hosted auth doesn't use the local test-OTP map. For phone-number sign-in on
> hosted you need a real SMS provider (Twilio) configured in
> **Authentication → Providers → Phone**, or switch those test users to email/OAuth
> for testing. (Real Twilio is a separate launch task.)

## 5. Deploy the edge functions
```bash
npx supabase functions deploy geocode
npx supabase functions deploy send-push
npx supabase functions deploy pay-crew
npx supabase functions deploy auto-pay
npx supabase functions deploy confirm-payout
npx supabase functions deploy connect-onboard
npx supabase functions deploy connect-status
npx supabase functions deploy setup-payment-method
# or all at once:
# npx supabase functions deploy
```

## 6. Set the function secrets (server-side — never in the app)
```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_your_secret_key
# optional geocoder upgrade (else free Nominatim is used):
# npx supabase secrets set GEOCODER=google GOOGLE_MAPS_API_KEY=your_key
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into deployed
functions automatically — do not set them by hand.

## 7. Point the app at hosted
Put the hosted values in the env the build will use. For a hosted **dev** run,
edit `.env.dev` (loaded by `npm start` / `npm run ios`):
```
EXPO_PUBLIC_SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your anon public key>
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
```
(Local Simulator testing still uses `.env.local.supabase` via the `:local` scripts —
this doesn't disturb that.)

## 8. Build for the phone
Stripe + push are native, so the phone needs a real build (not Expo Go):
```bash
npm i -g eas-cli
eas login
eas build --profile development --platform ios     # or android
```
EAS builds don't read your local `.env`. Provide the three `EXPO_PUBLIC_*` values
to the build one of two ways:
- **EAS env vars** (recommended): dashboard → your project → **Environment variables**, add the three for the `development` profile; or
- add an `env` block to the `development` profile in `eas.json`.

Install the finished build on your phone via the QR/link EAS gives you.

## 9. Verify on device
1. Open the app → sign in.
2. **Push:** grant the notification prompt → confirm a row appears in `push_tokens` (dashboard → Table Editor).
3. **Payments:** as a director, **SET UP AUTO-PAY** with card `4242 4242 4242 4242` → complete a game with accepted refs → confirm the charge in the **Stripe dashboard → Payments** (test mode).
4. **Payouts:** as a referee, **SET UP PAYOUTS** → finish Stripe Express onboarding → confirm the Connect account + transfer in the Stripe dashboard.

---

## Notes / gotchas
- **Test OTP won't work on hosted** — the local `[auth.sms.test_otp]` map is CLI-only. Use Twilio, or test with Google/Apple OAuth, or temporarily enable email auth.
- **Push only fires on a physical device** via a dev build — never Expo Go or Simulator.
- **Re-deploy after code changes:** re-run the relevant `supabase functions deploy <name>` and, for schema changes, add a new migration + `supabase db push` (never edit an applied migration).
- **Keep test mode** until the payments launch-hardening items (webhooks, refunds, 1099 filing) are done — see LAUNCH_CHECKLIST.md.
