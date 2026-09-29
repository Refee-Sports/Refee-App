# Refee — App Store & Google Play checklist

Everything between the Expo app in `apps/mobile` and a public listing on both
stores, in the order it needs doing. Product-level launch blockers (pricing,
trust & safety, messaging) live in [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md);
this file is only about shipping the binary.

**Status (Sep 28, 2026):** EAS project exists (`@ggatling/refee`, ID in `app.json`);
code prep in §2 is done except the icon/splash artwork. Never built for the
stores yet — the first build is blocked on the Apple/Google accounts (§1), the
artwork, and the production environment variables (§3).

Owners: **G** = Gerda (accounts, dashboards, content) · **C** = Claude (code).

---

## 1. Accounts — start now, these have lead times

- [ ] **G** — Apple Developer Program as an **organization** ($99/yr) so "Refee" is the seller name. Needs a **D-U-N-S number** first — can take 1–2 weeks.
- [ ] **G** — Google Play Console as an **organization** ($25 once). New *personal* accounts must run a closed test with 12 testers for 14 days before production; organization accounts skip that.
- [ ] **G** — Expo account (`ggatling`) — exists. Consider an Expo organization so the project isn't tied to one person.
- [ ] **G** — Create the app records: App Store Connect → New App (bundle ID `com.refee.app`), Play Console → Create app (package `com.refee.app`).

## 2. Code prep in `apps/mobile`

- [x] **C** — `eas init`: done Sep 28 — project `fd10513b-047f-4df3-9169-80c377812980` on the `ggatling` Expo account, written into `app.json` (`extra.eas.projectId` and the `updates.url`). The CLI can't write it itself because `app.config.js` is dynamic, so it was added by hand.
- [ ] **G** — App icon (1024×1024, no transparency for iOS), Android adaptive-icon foreground, and splash image. `assets/` doesn't exist yet. **C** wires them into `app.json` (`icon`, `android.adaptiveIcon.foregroundImage`, `splash.image`) the moment the files land — a store build can't be submitted without an icon.
- [x] **C** — **In-app account deletion** (Apple guideline 5.1.1(v)): "Delete account" screen (`app/account.tsx`), `delete-account` edge function (also empties the private `background-checks` bucket), and the web URL `/delete-account` for Google's requirement.
- [x] **C** — Permission wording in `app.json` plugins: location is *while-using only* (no background), camera and photos say "headshot / background check".
- [x] **C** — `ios.usesAppleSignIn: true` and `ios.config.usesNonExemptEncryption: false`.
- [x] **C** — `expo-updates` + `runtimeVersion: { policy: "appVersion" }`, and an update channel per build profile (`development` / `staging` / `production`).
- [x] **C** — Minimum-supported-version check: migration 0058 (`app_min_versions`, `get_min_app_version`) + an "Update Refee" screen that replaces the app for older installs. Fails open if offline. **G** sets the store URLs as `EXPO_PUBLIC_IOS_STORE_URL` / `EXPO_PUBLIC_ANDROID_STORE_URL` once the listings exist.
- [ ] **G** — `eas.json` submit profile: App Store Connect app ID (`ascAppId`, add under `submit.production.ios`) and the Google Play service-account key (`submit.production.android.serviceAccountKeyPath`). The Android track is preset to `internal` / `draft`.
- [x] **C** — Versioning: `appVersionSource: remote` + `autoIncrement` for production; `version` is now `1.0.0`.
- [x] **C** — Crash reporting: `@sentry/react-native`, initialised in `app/_layout.tsx`. It stays off until **G** sets `EXPO_PUBLIC_SENTRY_DSN` (a Sentry project is a free account) — no PII is attached. To get readable stack traces also set `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` in EAS.
- [x] **C** — The `NSAllowsLocalNetworking` exception (for a Supabase on a laptop) is no longer in production builds (`app.config.js`).
- [x] **C** — Time zones: every mobile screen shows the venue's zone ("1:30 PM ET"); chat uses the viewer's time; tournament create defaults to the venue's zone and offers Atlantic (Puerto Rico); the feed's "This week" follows the venue's week.

## 3. Production configuration

- [ ] **G** — EAS environment variables for the `production` profile: `EXPO_PUBLIC_SUPABASE_URL` (hosted), `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (**pk_live**), `EXPO_PUBLIC_APP_ENV=production`. The production profile in `eas.json` sets only the last one today.
- [ ] **G** — Push, iOS: let EAS create the APNs key during the first build (`eas credentials`).
- [ ] **G** — Push, Android: create a Firebase project, add the Android app (`com.refee.app`), upload the FCM V1 service-account key to EAS; **C** adds `google-services.json` config.
- [ ] **G** — Supabase → Auth → URL configuration: add the `refee://` redirect (OAuth return to the app).
- [ ] **G** — Sign-in is Apple, Google and an emailed code (no phone). Follow [AUTH.md](AUTH.md): custom SMTP, the code email template, attach emails to existing phone-only accounts, switch the phone provider off. For App Review, create a dedicated review mailbox and put its login in the review notes — there is no fixed-code test number any more.
- [ ] **G** — Supabase on the **Pro** plan (free projects pause and cap realtime connections).
- [ ] **G** — Stripe live mode: account activated, live keys in Supabase function secrets and EAS, webhook pointed at production. Refs re-onboard payouts in live mode (test-mode Connect accounts don't carry over).

## 4. Backend readiness

- [ ] Hosted database at the latest migration. **0057** (headshot required at sign-up, background-check uploads, roster email/QR invites, roster announcements) and **0058** (minimum app version) are applied locally and not yet pushed — back up, `supabase db push --linked --dry-run`, then push. Deploy the `send-roster-invites` function and set `RESEND_API_KEY` (and optionally `ROSTER_INVITE_FROM`, `WEB_URL`) or email invites will say they weren't sent.
- [ ] **G** — Add `RESEND_API_KEY` (resend.com, free tier is fine) to the Supabase function secrets so invited people without an account get an email.
- [ ] From the first store release on: **no migration may remove a column, policy or function a supported app version uses.** Add the new thing → ship both apps → raise the minimum version → remove the old thing.

## 5. Build & submit

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build  --profile production --platform all
npx eas-cli submit --platform ios       # → App Store Connect / TestFlight
npx eas-cli submit --platform android   # → Play Console testing track
```

- [ ] **C/G** — First production build for both platforms succeeds.
- [ ] **G** — Keep signing credentials managed by EAS (losing the Android upload key is painful).

## 6. Test

- [ ] **G** — TestFlight internal testing (team) → external testing (short beta review).
- [ ] **G** — Play internal testing → closed testing (12 testers × 14 days if the account is personal) → production.
- [ ] **G** — Run [TESTING.md](TESTING.md) on a real iPhone and Android phone against hosted: sign-up, accept a job, director approval, crew chat, push, payout onboarding, account deletion.

## 7. Store listings

- [ ] **G** — Name, subtitle, description, keywords, category (Sports), support URL, marketing URL.
- [ ] **G/C** — Privacy policy and terms pages hosted by the web app (`/privacy`, `/terms`); **G** writes the text, **C** builds the pages.
- [ ] **G** — Screenshots: iPhone 6.9" (required set), Android phone (min 2), Play feature graphic 1024×500.
- [ ] **G** — Apple **App Privacy** labels and Google **Data safety** form. Refee collects: phone number, email (optional, when a Google/Apple sign-in is linked or invited by email), name, date of birth, precise location (when in use), photos (headshot), a background-check document referees choose to upload (private; only the owner can open it — others see only "current until <date>"), messages, payment info (via Stripe), government-ID verification (via Didit), user ID. Linked to the user; not used for tracking.
- [ ] **G** — Age rating / content rating questionnaires.

## 8. Review notes

- [ ] **G** — Reviewer login: the hosted test phone number + code from step 3.
- [ ] **G** — Explain payments: refs are paid for officiating games in person; directors pay via Stripe for real-world services, so in-app purchase does not apply.
- [ ] **G** — Explain location: used only while the app is open, to show nearby games.

## 9. Release & after

- [ ] **G** — Apple: phased release over 7 days. Google: staged rollout (e.g. 20% → 100%).
- [x] **C** — Crash reporting: wired (Sentry, off until the DSN is set — see §2).
- [x] **C** — Hotfix path: a JS-only fix ships with `npx eas-cli update --channel production --message "…"` from `apps/mobile` and reaches installs of the *same* `version` within minutes, with no store review (`runtimeVersion` policy is `appVersion`). Anything native — a new library, a permission, an `app.json` plugin change, an SDK upgrade — needs a new build, a `version` bump and store review. To force everyone off a broken release: raise `app_min_versions` in Supabase (that is what the "Update Refee" screen reads).

Realistic timeline to first public release: **1–2 weeks**, gated by D-U-N-S and
(for personal Play accounts) the 14-day closed test. Code prep is 2–3 days.
