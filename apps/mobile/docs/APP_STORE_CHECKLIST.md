# Refee — App Store & Google Play checklist

Everything between the Expo app in `apps/mobile` and a public listing on both
stores, in the order it needs doing. Product-level launch blockers (pricing,
trust & safety, messaging) live in [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md);
this file is only about shipping the binary.

**Status (Sep 13, 2026):** never built for the stores — no EAS project, not on
TestFlight or Play. EAS work starts Sep 14.

Owners: **G** = Gerda (accounts, dashboards, content) · **C** = Claude (code).

---

## 1. Accounts — start now, these have lead times

- [ ] **G** — Apple Developer Program as an **organization** ($99/yr) so "Refee" is the seller name. Needs a **D-U-N-S number** first — can take 1–2 weeks.
- [ ] **G** — Google Play Console as an **organization** ($25 once). New *personal* accounts must run a closed test with 12 testers for 14 days before production; organization accounts skip that.
- [ ] **G** — Expo account (`ggatling`) — exists. Consider an Expo organization so the project isn't tied to one person.
- [ ] **G** — Create the app records: App Store Connect → New App (bundle ID `com.refee.app`), Play Console → Create app (package `com.refee.app`).

## 2. Code prep in `apps/mobile`

- [ ] **C** — `eas init` from `apps/mobile`: adds `extra.eas.projectId` to `app.json`. (EAS builds from the monorepo; installs run at the repo root.)
- [ ] **C** — App icon (1024×1024, no transparency for iOS) and splash screen wired into `app.json`. `assets/` is empty today. **G** supplies the artwork.
- [ ] **C** — **In-app account deletion** (Apple guideline 5.1.1(v)): a "Delete account" screen and a backend function that removes the user's data, plus a web URL for Google's account-deletion requirement.
- [ ] **C** — Permission wording in `app.json` plugins: location ("Show games near you"), photos/camera ("Add a headshot"). Generic defaults risk rejection.
- [ ] **C** — `ios.usesAppleSignIn: true` (Sign in with Apple entitlement; required on iOS when Google sign-in is offered) and `ios.config.usesNonExemptEncryption: false`.
- [ ] **C** — `expo-updates` + `runtimeVersion` policy **before the first store build**, so JS-only fixes can ship without review later.
- [ ] **C** — Minimum-supported-version check at launch (backend row + "Update Refee" screen), so old installs can be forced to update.
- [ ] **C** — `eas.json` submit profile: App Store Connect app ID (`ascAppId`) and the Google Play service-account key path.
- [ ] **C** — Versioning: `appVersionSource: remote` + `autoIncrement` already set for production. Bump `version` in `app.json` (0.1.0 → 1.0.0) for launch.
- [ ] **C** — Time zones: shared job cards/detail already show the venue's zone ("1:30 PM ET"), but 9 mobile screens still format times in Central (home, profile, jobs header, director tournaments + game, assignor game, chat thread + list) and the tournament-create zone picker lacks Atlantic (Puerto Rico). Switch them to `@refee/core/time` like web. Feed "Today / This week" filters (`core/jobs/filters.ts`) still use Central days.

## 3. Production configuration

- [ ] **G** — EAS environment variables for the `production` profile: `EXPO_PUBLIC_SUPABASE_URL` (hosted), `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (**pk_live**), `EXPO_PUBLIC_APP_ENV=production`. The production profile in `eas.json` sets only the last one today.
- [ ] **G** — Push, iOS: let EAS create the APNs key during the first build (`eas credentials`).
- [ ] **G** — Push, Android: create a Firebase project, add the Android app (`com.refee.app`), upload the FCM V1 service-account key to EAS; **C** adds `google-services.json` config.
- [ ] **G** — Supabase → Auth → URL configuration: add the `refee://` redirect (OAuth return to the app).
- [ ] **G** — Supabase → Auth → Phone: a **reviewer test number with a fixed code** on the hosted project. The `(555) 555-01xx` / `123456` numbers exist only on the local stack.
- [ ] **G** — Supabase on the **Pro** plan (free projects pause and cap realtime connections).
- [ ] **G** — Stripe live mode: account activated, live keys in Supabase function secrets and EAS, webhook pointed at production. Refs re-onboard payouts in live mode (test-mode Connect accounts don't carry over).

## 4. Backend readiness

- [ ] Hosted database at the latest migration (0033 column guard pending approval at time of writing).
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
- [ ] **G** — Apple **App Privacy** labels and Google **Data safety** form. Refee collects: phone number, name, precise location (when in use), photos (headshot), messages, payment info (via Stripe), user ID. Linked to the user; not used for tracking.
- [ ] **G** — Age rating / content rating questionnaires.

## 8. Review notes

- [ ] **G** — Reviewer login: the hosted test phone number + code from step 3.
- [ ] **G** — Explain payments: refs are paid for officiating games in person; directors pay via Stripe for real-world services, so in-app purchase does not apply.
- [ ] **G** — Explain location: used only while the app is open, to show nearby games.

## 9. Release & after

- [ ] **G** — Apple: phased release over 7 days. Google: staged rollout (e.g. 20% → 100%).
- [ ] **C** — Crash reporting before launch (e.g. Sentry via `sentry-expo`); none is wired today.
- [ ] **C** — Document the hotfix path: JS-only → `eas update`; native changes → new build + review.

Realistic timeline to first public release: **1–2 weeks**, gated by D-U-N-S and
(for personal Play accounts) the 14-day closed test. Code prep is 2–3 days.
