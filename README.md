# REFEE

The on-demand marketplace for sports officials.

## Stack

- **Expo SDK 54 + React Native 0.81 + React 19** — iOS + Android from one codebase
- **Next.js 15** — the web app (marketing site, director tools, staff admin)
- **NativeWind / Tailwind** — both apps style from the same design tokens
- **Supabase** — Postgres, Auth, Storage, Edge Functions, RLS
- **Stripe Connect Express** — payments + 1099 generation
- **Didit** — identity verification
- **NCSI** — background checks (NCYS-endorsed for youth sports)

## Project Structure

One npm workspace; run everything from the repo root.

```
refee/
├── apps/
│   ├── mobile/              # Expo app (Expo Router screens in app/, components/ui/ kit)
│   └── web/                 # Next.js app (app/ routes, components/ui/ kit, /admin)
├── packages/
│   ├── core/                # Backend calls both apps share (jobs, profiles, payments…)
│   └── design/              # @refee/design: tokens + component looks for both apps
├── docs/design-system/      # The design system: rules, tokens.json, component specs
├── supabase/
│   ├── migrations/          # SQL migrations (privacy-first schema)
│   ├── functions/           # Edge functions (Stripe, Didit, geocode, payouts…)
│   ├── seed.sql, seeds/     # Local test data (see Local development)
│   └── tests/database/      # pgTAP tests, run in CI
└── scripts/                 # db:seed, make-admin, secret and write checks
```

## Design System

Rules, tokens and component specs live in [`docs/design-system/`](docs/design-system/README.md).
Token values come from `@refee/design` (`packages/design`), which both Tailwind
configs and the mobile theme read; tests fail if they drift from
`docs/design-system/tokens.json`. Build screens from `components/ui/` in each
app. ESLint blocks raw buttons, inputs and hex colors in new files. See
[`CLAUDE.md`](CLAUDE.md) for the short version.

## Environments

Use **three Supabase projects** plus local Supabase: local for daily work, staging for QA and release candidates, production for real users. Never share production keys into dev builds.

| Env | Local command (from `apps/mobile`) | Typical use |
|-----|-------------------------------|-------------|
| Local | `npm run ios:local` / `npm run start:local` | Daily coding against `supabase start` and seed data |
| Development | `npm start` (loads `.env.dev`) | Whatever project `.env.dev` points at — check before running |
| Staging | `npm run start:stg` | QA, TestFlight/internal tracks |
| Production | `npm run start:prod` | Smoke-test prod config only — real installs use EAS |

Env files live in `apps/mobile/` and are gitignored. Copy the examples once per environment:

```bash
cd apps/mobile
cp .env.local.supabase.example .env.local.supabase
cp .env.dev.example .env.dev
cp .env.stg.example .env.stg
cp .env.prod.example .env.prod
```

Fill each file with that environment’s Supabase URL and anon key (and Stripe as needed). `EXPO_PUBLIC_*` variables are inlined at bundle time.

**EAS Build:** After installing [EAS CLI](https://docs.expo.dev/build/setup/), configure `EXPO_PUBLIC_*` values as [EAS secrets](https://docs.expo.dev/build-reference/variables/) or dashboard env vars for `staging` / `production` profiles in `eas.json` — do not commit live keys. Profiles set `EXPO_PUBLIC_APP_ENV` so `lib/env.ts` stays consistent.

## Prerequisites

- **Node.js ≥ 22** — the web app's `@supabase/*` packages need it, and Expo SDK 54 supports it (`nvm install 22` or [nodejs.org](https://nodejs.org)); the root `package.json` lists this under `engines`.
- **Docker** and the **Supabase CLI** for local Supabase.
- **Xcode** (Mac App Store) if you use the **iOS Simulator** — open Xcode once to accept the license.

## Local development

```bash
# 1. Install dependencies — one workspace for both apps
npm install

# 2. Local Supabase: migrations + seed data
npm run db:start
npm run db:reset              # fresh database from migrations + seed
supabase functions serve      # edge functions (ZIP lookups, payments…); leave running

# 3. Mobile, against local Supabase (never production)
cd apps/mobile && npm run ios:local

# 4. Web
npm run web
```

**Test data.** `npm run db:seed` re-runs the seed without wiping accounts you
created, and moves every game date forward from today. Run it when the feed
looks stale. Sign in with an email below; the code arrives in the local inbox at
http://127.0.0.1:54324. Nothing reaches a real mailbox.

| Account | What you'll see |
|---|---|
| `dc.new@refee.local` | Referee, full DC-area feed, no games yet |
| `dc.booked@refee.local` | Confirmed games, an application pending, an offer from the assignor |
| `dc.paid@refee.local` | A season of completed games, paid and pending payouts |
| `dc.unverified@refee.local` | ID check in review: can browse, can't apply |
| `dc.director@refee.local` | DMV Hoops Classic, weeknight games, applicants to review |
| `dc.assignor@refee.local` | Three-ref roster, running Capital Fall League |
| `admin@refee.local` | Staff admin on the web at `/admin` |
| `ref1`–`ref4@refee.local`, `dir1`–`dir2@refee.local` | The original Texas data |

An account you create with a DC ZIP (e.g. 20019) sees the same DC feed.

**Checks.** `npm test` and `npm run typecheck` cover both apps and the shared
packages; `npm run db:test` runs the database tests (including one that fails if
a migration breaks the seed). CI runs all of them on every push.

**Migrations to hosted projects.** `npm run db:push` pushes to whichever project
this checkout is linked to — production unless you've re-linked. Only run it on
purpose.

### iOS Simulator

If Xcode is not found, point the CLI at your install:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

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
