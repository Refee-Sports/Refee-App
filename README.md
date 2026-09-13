# REFEE

The on-demand marketplace for sports officials.

## Stack

- **Expo SDK 54 + React Native 0.81 + React 19** — iOS + Android from one codebase
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
├── .env.dev                # Local dev secrets (gitignored; see .env.dev.example)
├── .env.stg                # Staging secrets (gitignored; see .env.stg.example)
├── .env.prod               # Production secrets for local verification (gitignored; see .env.prod.example)
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

## Environments

Use **three Supabase projects** (or local Supabase for development): development for daily work, staging for QA and release candidates, production for real users. Never share production keys into dev builds.

| Env | App flag | Local command | Typical use |
|-----|-----------|---------------|-------------|
| Development | `EXPO_PUBLIC_APP_ENV=development` | `npm start` | Daily coding; dev Supabase or `supabase start` |
| Staging | `EXPO_PUBLIC_APP_ENV=staging` | `npm run start:stg` | QA, TestFlight/internal tracks |
| Production | `EXPO_PUBLIC_APP_ENV=production` | `npm run start:prod` | Smoke-test prod config only — real installs use EAS |

Env files live in `apps/mobile/` and are gitignored. Copy the examples once per environment:

```bash
cd apps/mobile
cp .env.dev.example .env.dev
cp .env.stg.example .env.stg
cp .env.prod.example .env.prod
```

Fill each file with that environment’s Supabase URL and anon key (and Stripe/Persona as needed). `EXPO_PUBLIC_*` variables are inlined at bundle time.

**EAS Build:** After installing [EAS CLI](https://docs.expo.dev/build/setup/), configure `EXPO_PUBLIC_*` values as [EAS secrets](https://docs.expo.dev/build-reference/variables/) or dashboard env vars for `staging` / `production` profiles in `eas.json` — do not commit live keys. Profiles set `EXPO_PUBLIC_APP_ENV` so `lib/env.ts` stays consistent.

## Prerequisites

- **Node.js ≥ 22** — the web app's `@supabase/*` packages need it, and Expo SDK 54 supports it (`nvm install 22` or [nodejs.org](https://nodejs.org)); the root `package.json` lists this under `engines`.
- **Xcode** (Mac App Store) if you use the **iOS Simulator** — open Xcode once to accept the license.
- **Expo Go** on a phone must be a build that supports **SDK 54** (update from the store).

## Setup

```bash
# 1. Install dependencies — one npm workspace for both apps, from the repo root
npm install

# 2. Env files (see Environments above)
cp apps/mobile/.env.dev.example apps/mobile/.env.dev
# Edit it — at minimum EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY

# 3. Run Supabase migrations (supabase/ lives at the repo root; needs a linked project)
npm run db:push

# 4. Start the dev server (loads apps/mobile/.env.dev)
npm run mobile
```

The repo is one workspace: `apps/mobile` (this Expo app), `apps/web` (the Next.js
web app), `packages/core` (backend calls both apps share) and `supabase/` (the
backend). Web: `npm run web`.

Scan the QR code with Expo Go (iOS/Android) to run on your device.

### iOS Simulator

From `refee/`:

```bash
npm run ios
```

This uses `.env.dev`, starts Metro, and opens the app in the Simulator (boot a simulator first, or Expo will prompt for a device). If Xcode is not found, point the CLI at your install:

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
