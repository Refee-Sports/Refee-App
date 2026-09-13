# REFEE

The on-demand marketplace for sports officials.

## Stack

- **Expo + React Native** — iOS + Android from one codebase
- **NativeWind** — Tailwind for React Native; carries our design tokens
- **Supabase** — Postgres, Auth, Storage, Edge Functions, RLS
- **Stripe Connect Express** — payments + 1099 generation
- **Persona** — identity verification
- **NCSI** — background checks (NCYS-endorsed for youth sports)

## Project Structure

```
refee/
├── app/                      # Expo Router screens
│   ├── (auth)/              # Public auth screens (welcome, sign-in, verify)
│   │   ├── welcome.tsx
│   │   ├── sign-in.tsx
│   │   └── verify.tsx
│   ├── (onboarding)/        # First-time-only onboarding flow
│   │   ├── identity.tsx
│   │   ├── profile.tsx
│   │   ├── credentials.tsx
│   │   ├── availability.tsx
│   │   ├── payout.tsx
│   │   └── success.tsx
│   ├── (app)/               # Authenticated app
│   │   ├── (tabs)/         # Tabbed nav: Home, Jobs, Inbox, Profile
│   │   │   ├── index.tsx
│   │   │   ├── jobs.tsx
│   │   │   ├── inbox.tsx
│   │   │   └── profile.tsx
│   │   └── job/[id].tsx    # Job detail
│   └── _layout.tsx
├── components/              # Reusable UI components
│   ├── ui/                 # Primitive components (Button, Badge, Input)
│   ├── data/               # Data display (Scoreboard, DataCard, StatStrip)
│   └── layout/             # Layout (PhoneStatusBar, AppHeader, Telemetry)
├── lib/                    # Core libs
│   ├── supabase.ts         # Supabase client
│   ├── auth.ts             # Auth helpers
│   └── theme.ts            # Design tokens
├── hooks/                  # React hooks
├── supabase/
│   ├── migrations/         # SQL migrations (privacy-first schema)
│   └── functions/          # Edge functions (Stripe, NCSI webhooks)
├── tailwind.config.js      # NativeWind config with Refee tokens
├── app.json                # Expo config
└── package.json
```

## Design Tokens (locked in)

| Token | Value | Use |
|---|---|---|
| `paper` | `#E5E1D6` | Light canvas |
| `paper-2` | `#D8D3C5` | Light section |
| `chalk` | `#F5F2EA` | Light elevated card |
| `ink` | `#08111C` | Light text / dark canvas |
| `signal` | `#1F4FCC` (light) / `#4F8CFF` (dark) | Brand |
| `hi-vis` | `#C9F031` (light) / `#D4FF3A` (dark) | Live / available |
| `court` | `#00A85C` (light) / `#00D982` (dark) | Confirmed / paid |
| `foul` | `#E63946` (light) / `#FF4757` (dark) | Decline / error |

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env vars (this repo uses dotenv-cli + `.env.dev` for `npm start`)
cp .env.dev.example .env.dev
# Fill in: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY from
# Supabase Dashboard → Project Settings → API (Project URL + anon public key).

# 3. From the `refee/` folder, run Supabase migrations (requires Supabase CLI linked to your project)
supabase db push
# Order: 0001 schema → 0002 RLS → 0003 hirers unique index → 0004 roles / levels /
# tournaments / assignors (for role-aware onboarding and director flows).

# 4. Start the dev server
npm start
```

Scan the QR code with Expo Go (iOS/Android) to run on your device.

### Supabase auth (phone sign-in / sign-up)

**Hosted project (what Refee uses with `.env.dev` today)**

1. **Supabase Dashboard** → **Authentication** → **Providers** → enable **Phone**.
2. Add an SMS provider. **Twilio** is the usual choice:
   - Create a [Twilio](https://www.twilio.com/) account.
   - Create a **Messaging Service** (or use a verified caller ID) and note **Messaging Service SID** (or “From” number per Supabase’s Twilio guide).
   - In Twilio Console: **Account SID**, **Auth Token** (keep secret).
   - Paste **Account SID**, **Auth Token**, and **Messaging Service SID** into the Phone provider fields in Supabase (same page as step 1).
3. Under **Authentication** → **Rate limits**, note OTP throttles if you hit “too many requests” while testing.

Official walkthrough: [Phone Login (Twilio)](https://supabase.com/docs/guides/auth/phone-login/twilio).

**How to test locally (pick one path)**

| Approach | Best for | Notes |
|----------|----------|--------|
| **A. Hosted Supabase + real SMS** | Physical phone + Expo Go | Keep `EXPO_PUBLIC_SUPABASE_URL` as `https://…supabase.co` (not `localhost`). Use a **real** `+1…` number; Twilio trial can only text **verified** numbers until you upgrade. Easiest path to prove end-to-end. |
| **B. `supabase start` + test OTP map** | iOS Simulator / Android emulator on the same machine | In `supabase/config.toml`, **`[auth.sms]`** enables signup + confirmations and **`[auth.sms.test_otp]`** maps `+15555550100` → `123456` (no Twilio). Use **`.env.local.supabase`** (see `.env.local.supabase.example`) and **`npm run start:local`**. Run **`supabase db push`** against local when you want the same schema as hosted. |

**Local stack quick start**

```bash
cd refee
npm run supabase:start    # or: npx supabase start
npm run supabase:status   # copy API URL + Publishable / anon key
cp .env.local.supabase.example .env.local.supabase
# Edit .env.local.supabase — paste URL + key from status output

npm run start:local
```

The CLI is a **project devDependency** — `supabase` alone is not on your PATH unless you install it globally. Always run from `refee/` via `npm run supabase:*` or `npx supabase …`.

Phone auth test: sign in with **`(555) 555-0100`**, OTP **`123456`**. After changing `config.toml`, run **`npm run supabase:stop`** then **`npm run supabase:start`** — you should **not** see “Disabling phone login” if the local Twilio stub + `test_otp` are active.

### Seed users & demo jobs (local)

`supabase/seed.sql` runs on **`supabase db reset`** (and the first **`supabase start`**). It creates two phone users, profiles, a hirer, and sample jobs (same job UUIDs as `lib/jobs/mock-data.ts`).

| Role | Phone in app | E.164 | OTP |
|------|----------------|-------|-----|
| Referee | `(555) 555-0100` | `+15555550100` | `123456` |
| Director / hirer | `(555) 555-0101` | `+15555550101` | `123456` |

```bash
cd refee
npm run supabase:start          # if not already running
npx supabase db reset           # reapplies migrations + seed.sql
```

Then open Studio → **Authentication → Users** (http://127.0.0.1:54323) — you should see both users. **Table Editor** → `public_profiles`, `jobs`.

To refresh seed data without wiping migrations only: run `db reset` (there is no lighter “re-seed only” in the CLI).

**Hosted:** seed SQL does not run automatically. Either sign up in the app or run `supabase/snippets/seed_demo_jobs.sql` in the hosted SQL Editor after you have a real user.

**Expo Go on a real phone:** `127.0.0.1` only works on the simulator. Set `EXPO_PUBLIC_SUPABASE_URL` to your Mac’s LAN IP (e.g. `http://192.168.1.151:54321`) in `.env.local.supabase`, same Wi‑Fi as the phone.

Use **`npm start`** (`.env.dev`) for hosted Supabase + real Twilio SMS.
| **C. Dashboard-only users** | Schema / RLS / seed SQL | **Authentication → Users → Add user** creates a row without going through SMS; useful for DB work, not for testing the SMS UI flow. |

The app sends **`signInWithOtp` with `+1` + 10 digits** and verifies with `verifyOtp({ phone, token, type: 'sms' })` — use **E.164** (`+15551234567`) everywhere.

4. After a user exists in `auth.users`, you can attach demo job data: run the SQL in `supabase/snippets/seed_demo_jobs.sql` in the **SQL Editor** (it creates a `hirers` row for your first user and inserts sample `jobs` rows whose UUIDs match `lib/jobs/mock-data.ts`). Apply migrations through **`0003_hirers_one_user_unique`** so the hirer upsert works. Add **`0004_roles_levels_tournaments_assignors`** when you start role-aware onboarding (new tables do not block the job seed).
5. OAuth (Google / Apple) needs the redirect URLs and client IDs configured under **Authentication → Providers** for each platform; see Expo and Supabase docs for your bundle IDs.

### Jobs feed and job detail

- With Supabase configured and migrations applied, **Jobs** loads open jobs from the `jobs` table. If the query fails or returns no rows, the app falls back to the built-in mock list.
- **Job detail** reads one row by `id` from Supabase when possible, otherwise uses the same mock detail map.

## Privacy Convention (enforced at the database level)

- Public profile shows: first name + last initial, headshot, city, rating
- Legal name, DOB, SSN, and bank info live in `private_profiles` table
- RLS policies enforce that `private_profiles` is only readable by the user themselves and admin role
- Even a bug in app code cannot leak the data

## Background Check Policy

Auto-disqualifying:
1. Any sex offense (any age, any victim) — permanent
2. Crimes against children — permanent
3. Drug distribution / trafficking — last 7 years

Everything else: case-by-case review with bias toward eligibility.
