# REFEE — Pre-Launch Checklist

**Created:** July 8, 2026
**Scope:** Basketball MVP, first paying directors. Grouped by "must fix before real money/users" vs "should have" vs "decide."

---

## 🔴 Blockers — cannot launch without these

### Payments & payouts
- [ ] **Enable Stripe Tax Reporting (1099).** Data is collected at Express onboarding (see Q2 below); we still must turn on Stripe's 1099-K/NEC filing in the dashboard and set whether Stripe or Refee is the filer. Verify the $600 threshold logic and e-delivery consent.
- [ ] **Payment source-of-truth webhook.** Add `payment_intent.succeeded` (and `.payment_failed`, `transfer.*`) webhook → mark `payment_status`/`payout_status`. Today confirm-payout runs only if the client calls back; a killed app can strand a game in `processing`.
- [ ] **First-payout delay UX.** New US Express accounts have a ~7-day hold on the first payout, then rolling ~2-business-day standard payouts. Set ref expectations in the payout UI so "instant" isn't misread as "instant to bank." (See Q1.)
- [ ] **Refund / dispute handling.** Director cancels after paying, or a chargeback lands — no flow exists. At minimum: reverse transfers, define who bears the loss.
- [ ] **Decouple ref pay from director settlement (partial escrow) OR accept the risk explicitly.** Right now a ref only gets paid if the director's card charges at completion. If it declines, the ref is stuck. Either add escrow-at-fill (charge when crew locks) or a clear dunning + guarantee policy. This is also the #1 competitive gap vs Refr.

### Pricing (decided-but-revisit)
- [ ] **Confirm platform fee before launch.** Set to **5%** now (`PLATFORM_FEE_PCT` in `supabase/functions/_shared/pay-math.ts`). Revisit: Refr charges ~3% as an *assigning tool*; we're a *marketplace* (we supply refs), which justifies more. Decide final number + whether to also monetize ref-side instant cash-out.
- [ ] **Fix the fee-vs-Stripe-cost margin (the 5% barely covers Stripe on small games).** The 5% is **Refee revenue** (lands in our platform balance); Stripe's processing fee (**2.9% + $0.30**) is separate and comes out of the same charge, so it eats most of our fee on low-dollar games. Verified on a real $35 game: charged $37.00 → Stripe took $1.37 → we kept $35.63 → transferred $35 to the ref → **net margin $0.63**. Worked example of the squeeze:
  - $35 game → 5% = $2 → after ~$1.37 Stripe → **+$0.63**
  - $20 game → 5% = $1 → after ~$0.91 Stripe → **+$0.09**
  - $15 game → could **break even or go negative** once the flat $0.30 dominates.

  Options (pick before launch):
  1. **Raise the platform %** (e.g. 8–10%) — simplest; marketplace positioning supports it.
  2. **Pass Stripe's fee through** — charge director `crew + our% + Stripe fee` so our % is pure margin (most defensible; director sees a "processing" line).
  3. **Minimum fee floor** — `max(5%, $1.00)` so tiny games still cover the flat $0.30.
  4. **Batch payouts** — one charge per tournament/day instead of per game amortizes the $0.30 across many games.

  Note: the referee always receives the **full** crew amount — Stripe's fee is borne by the platform (separate charge + `source_transaction` transfer), never deducted from the ref.

### Infrastructure
- [ ] **Google Maps Geocoding API key for production.** Dev uses free Nominatim; production needs a real provider for reliability + rate limits. Create a Google Cloud project → enable the **Geocoding API** → billing on → set `GEOCODER=google` and `GOOGLE_MAPS_API_KEY` in the edge-function secrets. Code + `.env.example` slots already wired.
- [ ] **Hosted Supabase project** (currently local Docker only). Move migrations, set prod env.
- [ ] **Real Twilio SMS** for phone OTP (test-OTP map is dev-only).
- [ ] **`ANTHROPIC_API_KEY` / `STRIPE_SECRET_KEY` in prod function secrets**, not committed.
- [ ] **EAS build + App Store / Play Store submission.** Stripe payment sheet + Express onboarding require a real device build (not Expo Go).
- [ ] **pg_cron enabled on hosted Supabase** so `sweep_game_lifecycle` runs server-side, not just on client focus.

### Messaging
- [ ] **Conversation-creation RLS bug.** Director tapping **MESSAGE CREW** on a game throws `new row violates row-level security policy for table "conversations"`. The insert policy is `created_by = auth.uid()` (migration 0008); a valid director crew message is being rejected. Fix the policy/insert path so directors (and refs) can create crew threads.
- [ ] **Role-based messaging permissions (in progress).** Rules: referee↔referee ✅, assignor↔referee ✅ (both ways), **director→referee only** (referees can't message directors — reduces director inbox load). Enforce in the app (hide/disable send affordances via `canMessage`) **and** server-side in RLS (a message-insert policy checking the sender's role may message every other participant's role). Pure rules live in `lib/messages/permissions.ts`.

### Trust & safety / legal
- [ ] **Terms of Service + Privacy Policy** (marketplace, payments, data). Required for app store review.
- [ ] **Background check / identity verification** decision. Schema has Persona/NCSI placeholders, no integration. Decide: required for launch, or post-MVP with a "pending verification" label (current state).
- [ ] **Late-withdrawal penalty** (already decided we want one; `withdrew_late` is recorded, nothing surfaces it). Pick the mechanic — show-rate %, badge, or strike system.

---

## 🟡 Should have before real users

- [x] **Push notifications** — ✅ infra built (migration 0016 `push_tokens`, `send-push` edge fn, `lib/push/notifications.ts`, token register on login / unregister on sign-out). Triggers wired: accepted, re-confirm, new message. **Fires only in an EAS dev build** — not Expo Go (SDK 53+). Remaining: availability-matched new-game alerts (needs the match-scoring pass), payment-received trigger, and move sends to DB triggers for production security.
- [x] **True radius filtering** — ✅ done. Geocode edge fn (Nominatim default, `GEOCODER=google` swap), venues geocoded on game create/edit, ref home on profile save, Haversine filter in feed with state fallback; real miles shown on cards. Migration 0015 (`home_lat/lng`). Seed rows backfilled.
- [x] **Hybrid location (home + live "near me")** — ✅ done. HOME/NEAR ME toggle on jobs feed; near-me requests device location (`expo-location`) and re-filters around it; denial falls back to home with a note. Home is the default (works with no location permission).
- [x] **Game completion nudge** — ✅ in-app banner on director tournaments screen lists ended-but-open games (pre-24h-sweep window) with tap-to-complete. Push version rides on the push infra above.
- [ ] **needs_reconfirm crew visibility** — a ref awaiting re-confirm drops off the referee-side crew list. Cosmetic but confusing.
- [ ] **Mileage** (optional pay component) — Refr has it; some assignors expect it.
- [ ] **Earnings ledger** — per-game statement view, not just totals (helps refs reconcile against their own 1099).

## 🟢 Nice to have / post-launch
- [ ] Assignor role UI (schema exists, no screens — decide cut vs build).
- [ ] Invited / Saved job tabs on real data (currently mock).
- [ ] Rolling rating window (last 50 games) vs all-time.
- [ ] AI Tournament Builder + match scoring (see AI_ROADMAP.md).
- [ ] Multi-sport (basketball-only by design for launch).

## ⚠️ Technical debt
- [ ] Automated tests — zero coverage. Highest-value targets: earnings math, conflict guard, fee calc, re-confirm/withdraw flows.
- [ ] Mock-data fallback in jobs feed can mask a real "no jobs" state.
- [ ] TZ hardcoded to America/Chicago in several screens (games are venue-local — should follow the venue, not CT).
- [ ] Dynamic Type only partially supported: scaling is capped at 1.4× (`lib/ui/text-scaling.ts`) so layouts survive, but ~75 fixed `lineHeight`/fixed-height rows still clip at large sizes. Make them flexible to raise the cap toward full support.
- [ ] Typed-route `as any` casts to clean up once routes stabilize.

---

## Answers captured (July 8, 2026)

**Q: Does instant payout cost more? Where do funds land?**
Our Transfer at completion lands money in the ref's **Stripe connected-account balance immediately** — but that is *not* their bank account. From there, Stripe's **standard automatic payout** (free, ~2 business days, ~7-day hold on the very first one) moves it to their bank. **Instant Payout** to a debit card (~30 min) exists but costs ~1.5% (min $0.50) — someone must eat that (ref via deduction, or us). Recommendation: standard free payouts by default; offer instant as an opt-in ref-side paid feature (mirrors Refr, and becomes revenue). **Action:** stop saying "instant" about bank arrival in the UI (done on game detail).

**Q: Do we collect everything for the 1099 trigger?**
Effectively yes, via Stripe — **not** via our own DB, which is the right liability posture. Express onboarding (our `connect-onboard` fn, `transfers` capability) forces Stripe to collect legal name, DOB, address, and **SSN/TIN** before payouts enable. We deliberately never store SSN (`private_profiles` has legal name/DOB/address fields but SSN is Stripe-only). The **gap is not collection, it's filing**: we haven't enabled Stripe's 1099 Tax Reporting product or chosen filer responsibility. That's a dashboard config task, listed as a blocker above.
