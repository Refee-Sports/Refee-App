# Getting Refee Running Locally

This guide walks through the first-time setup. About 20 minutes start to finish.

## Prerequisites

- **Node 20+** (`node -v`)
- **npm** or **pnpm**
- **Expo Go** app on your phone (App Store / Play Store)
- **Supabase account** (free) — supabase.com
- **Mac users**: Xcode for iOS Simulator (optional)
- **Anyone**: Android Studio + an emulator (optional)

You can run the whole thing on your physical phone via Expo Go without any
of the optional simulator stuff.

## 1. Install dependencies

```bash
cd refee
npm install
```

## 2. Set up Supabase

1. Go to supabase.com → Create new project (free tier)
2. Wait ~2 minutes for it to provision
3. In **Project Settings → API**, copy:
   - Project URL
   - anon / public key
4. Create `.env` from the example:

```bash
cp .env.example .env
```

5. Fill in:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

## 3. Run the database migrations

Two ways to do this:

### Option A: Supabase SQL Editor (simplest)

1. In your Supabase dashboard, go to **SQL Editor**
2. Open `supabase/migrations/0001_initial_schema.sql` in your code editor
3. Copy the whole file, paste into SQL Editor, Run
4. Repeat for `supabase/migrations/0002_rls_policies.sql`

### Option B: Supabase CLI (more reproducible)

```bash
brew install supabase/tap/supabase   # mac
# or: scoop install supabase         # windows

supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## 4. Enable phone auth in Supabase

1. **Authentication → Providers → Phone**
2. Toggle on
3. For local dev, you can use Twilio's test mode or set up a real Twilio account
4. **For testing without spending money**: in Authentication → Settings, you can
   set "Enable Phone Confirmations" to false during development. Then the OTP
   code will appear in the Supabase auth logs — copy it from there.

A simpler dev path: use a service like Vonage or MessageBird which often
have free SMS credits. Twilio is the production choice.

## 5. Start the dev server

```bash
npx expo start
```

A QR code will appear in your terminal.

- **iPhone**: Open Camera app → point at QR → tap the banner that appears
- **Android**: Open Expo Go → tap "Scan QR Code" → point at QR

The app will load on your phone. Save any file in your editor and it
hot-reloads instantly.

## What you should see

1. **Welcome screen** — ink canvas, hi-vis "CALLED UP" tag, three-cell value strip
2. Tap **GET STARTED** → phone entry
3. Enter your real phone number → tap **SEND CODE**
4. You'll receive an SMS (or check Supabase logs for the code if you disabled SMS)
5. Enter the 6 digits → auto-verify → drops you into the app shell with tabs

## Troubleshooting

**"Network request failed"** — Check your `.env` Supabase URL is correct and
your phone is on the same network as your laptop (or use a tunnel).

**OTP not arriving** — Check Supabase Auth logs for the code, or verify your
Twilio integration is set up.

**Fonts look wrong** — Wait a few seconds on first launch; Google Fonts are
downloaded the first time.

**TypeScript errors** — Run `npx expo install --fix` to resync versions.

## Next things to build

In rough priority order:

1. **Onboarding screens** (`app/(onboarding)/*.tsx`) — implement the 8-step flow
   we designed (welcome dropped you here, but for now we route to (app))
2. **Stripe Connect Express** integration — refs need to set up payouts
3. **Persona** identity verification embed
4. **NCSI background check** webhook handler (Supabase Edge Function)
5. **Jobs feed** — translate design 4.2 into the Jobs tab
6. **Job detail** — translate design 4.3 into `app/(app)/job/[id].tsx`
7. **Profile** — translate design 4.1 into the Profile tab

Each of these is its own focused work session.
