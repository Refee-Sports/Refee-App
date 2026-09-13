# Refee Web

The web app for **Refee** — the on-demand marketplace for sports officials —
plus the marketing landing page.

Refee is a mobile-first product, but web launches first: it ships without the
App Store review cycle. So this is not a cut-down companion site. It runs the
**same product as the mobile app, against the same backend**: a referee or
tournament director can sign in here or in the app with one account and do the
same things either way.

The React Native app lives in
[`Refee-Sports/Refee-Mobile`](https://github.com/Refee-Sports/Refee-Mobile).

## Shared backend (the important part)

Both clients talk to **one Supabase project** — same Postgres, same Auth, same
RLS policies, same Storage bucket, same edge functions. Nothing is duplicated
server-side, and there is no web-only API.

Point the web env at the same project the app uses:

| Mobile (`refee-mobile/refee/.env.dev`) | Web (`.env.local`)               |
| -------------------------------------- | -------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`             | `NEXT_PUBLIC_SUPABASE_URL`       |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`        | `NEXT_PUBLIC_SUPABASE_ANON_KEY`  |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`   | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |

Because phone-OTP sign-in resolves to the same `auth.users` row, a ref who
signs up on the web opens the app and their profile, jobs, crew threads and
earnings are already there.

### Using the mobile test accounts locally

The seeded test users — `(555) 555-0100` through `0105`, OTP always `123456` —
live in the **local** Supabase stack (`refee/supabase/seed.sql`), and the OTP
comes from `[auth.sms.test_otp]` in `refee/supabase/config.toml`. They are not
in any hosted project, so the web app has to point at that same local stack:

```bash
# 1. start the local backend from the mobile repo
cd ../Refee-Mobile/refee && supabase start

# 2. point the web app at it (reads `supabase status`, writes .env.local)
cd ../../Refee-Web
npm run setup:local
#   …or pass the path if the repo lives elsewhere:
#   npm run setup:local -- ../path/to/refee

# 3. run
npm run dev
```

`setup:local` only ever writes the publishable/anon key — it refuses the
service-role or `sb_secret_…` key, which would bypass RLS if it reached the
browser. To do it by hand instead, `cp .env.example .env.local` and paste the
API URL and Publishable key from `supabase status`.

Then open http://localhost:3000/auth/sign-in, enter `(555) 555-0100`, and use
`123456`. That is the same account the app signs into with the same number.

In development the sign-in screen prints the API host it is talking to
(`DEV · API 127.0.0.1:54321 · LOCAL`) so you can confirm both clients are
pointed at the same backend.

Two things to configure once in the Supabase dashboard (hosted only):

- **Authentication → URL Configuration** — add this origin's
  `https://<your-domain>/auth/callback` alongside the app's `refee://` deep
  link, so Google/Apple sign-in can redirect back.
- **Authentication → Phone** — the same SMS provider serves both clients.

## Stack

- **Next.js 15** (App Router) + **React 19** — the signed-in app is client-side,
  like the RN app, so the query layer is shared rather than reimplemented
- **Tailwind CSS 3** — tokens mirror `refee-mobile/refee/tailwind.config.js`
- **@supabase/supabase-js** — same client library, same queries
- **@stripe/stripe-js** — Elements stands in for the app's native PaymentSheet
- **next/font** — Inter Tight (display) + JetBrains Mono (telemetry)

## What's here

Everything a user can do in the app:

| Area | Screens |
| --- | --- |
| **Auth** | Welcome, phone OTP sign-in, verify, Google/Apple OAuth callback |
| **Onboarding** | Role select, referee setup (6 steps), director setup (3 steps) |
| **Referee** | Home (today/upcoming, earnings), jobs feed (tabs, filters, near-me), job detail (accept / decline / re-confirm / withdraw / message crew), profile (headshot, scorecard, earnings, availability, payouts), edit profile |
| **Director** | Tournaments, tournament create/edit/detail, game create/edit/copy, game detail (applicants, crew messages + read receipts, complete, cancel, pay crew, rate refs), privacy-limited referee view, profile with auto-pay |
| **Messaging** | Inbox / Messages, realtime chat threads, crew threads, read receipts |

Routing mirrors the app's groups: `/auth/*`, `/onboarding/*`, `/app/*`
(referee), `/director/*`. `components/providers/RouteGate.tsx` reproduces the
app's `AuthGate` rules — no session → welcome, no profile → onboarding, then
referee vs director by `primary_role`.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in from the same Supabase project as the app
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command         | What it does                      |
| --------------- | --------------------------------- |
| `npm run dev`   | Start the dev server (hot reload) |
| `npm run build` | Production build                  |
| `npm run start` | Serve the production build        |
| `npm run typecheck` | `tsc --noEmit`                |
| `npm run setup:local` | Point `.env.local` at the app's local Supabase |

## Structure

```
Refee-Web/
├── app/
│   ├── page.tsx              # Marketing landing page
│   ├── layout.tsx            # Fonts + AuthProvider + RouteGate
│   ├── globals.css           # Design tokens, app shell, form styles
│   ├── auth/                 # welcome, sign-in, verify, callback
│   ├── onboarding/           # role-select, referee, director
│   ├── app/                  # Referee app (home, jobs, job/[id], inbox, profile…)
│   └── director/             # Director app (tournaments, game/[id], referee/[id]…)
├── components/
│   ├── providers/            # AuthProvider, RouteGate
│   ├── layout/               # TabBar, ScreenHeader, Telemetry, SetupNotice
│   ├── ui/                   # AppButton, Badge, Field, Icon, ZebraRule
│   ├── job/                  # JobCard + job-detail sections
│   ├── messages/             # ConversationList, ChatThread
│   ├── payments/             # StripePaymentModal
│   └── ratings/              # RateRefereeModal
├── hooks/                    # useJobsFeed, useJobAssignment, useFocusEffect
└── lib/                      # Ported from the app — see below
```

## How the port works

`lib/` is carried over from `refee-mobile/refee/lib/` with the query logic
**unchanged**, so both clients hit the backend identically and RLS behaves the
same. Only the platform edges differ:

| Concern | Mobile | Web |
| --- | --- | --- |
| Session storage | AsyncStorage | `localStorage` |
| OAuth return | `refee://` deep link | `/auth/callback` + PKCE |
| Headshot picker | expo-image-picker | `<input type="file">` |
| Location | expo-location | `navigator.geolocation` |
| Directions | Apple/Google Maps deep link | Google Maps in a new tab |
| Payments | Stripe PaymentSheet | Stripe Elements (same client secrets) |
| Push | Expo push token registered | send-only (the app owns device tokens) |
| Screen focus | `useFocusEffect` | mount + tab-visibility shim |

The design system is the same brutalist sport-tech language: Inter Tight Black
display, JetBrains Mono telemetry, ink/paper/signal/chalk/hi-vis, hard borders
instead of shadows. Signed-in screens keep the app's phone-width column at every
breakpoint, centred on desktop, so the two surfaces read as one product.

## Known gaps

These mirror open items in the app itself (see the mobile repo's
`docs/PROJECT_STATUS.md`), not web-specific shortfalls:

- Web push notifications aren't wired up. The web app *sends* push (so a
  director acting here still reaches a ref's phone) but doesn't register the
  browser for them.
- Payments run in Stripe test mode and need live-mode hardening.
- Feed radius filtering still depends on venue geocoding.
- ESLint isn't configured in this project; `npm run typecheck` and
  `npm run build` are the checks that run today.

## Deploy

Optimized for **Vercel** (zero-config for Next.js). Set the `NEXT_PUBLIC_*`
variables above as project env vars. `npm run build` also produces a standard
Next server you can host anywhere Node runs.
