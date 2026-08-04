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
- [ ] **Confirm platform fee before launch.** Set to **5%** now (`PLATFORM_FEE_PCT` in `supabase/functions/_shared/util.ts`). Revisit: Refr charges ~3% as an *assigning tool*; we're a *marketplace* (we supply refs), which justifies more. Decide final number + whether to also monetize ref-side instant cash-out.

### Infrastructure
- [ ] **Hosted Supabase project** (currently local Docker only). Move migrations, set prod env.
- [ ] **Real Twilio SMS** for phone OTP (test-OTP map is dev-only).
- [ ] **`ANTHROPIC_API_KEY` / `STRIPE_SECRET_KEY` in prod function secrets**, not committed.
- [ ] **EAS build + App Store / Play Store submission.** Stripe payment sheet + Express onboarding require a real device build (not Expo Go).
- [ ] **pg_cron enabled on hosted Supabase** so `sweep_game_lifecycle` runs server-side, not just on client focus.

### Trust & safety / legal
- [ ] **Terms of Service + Privacy Policy** (marketplace, payments, data). Required for app store review.
- [ ] **Background check / identity verification** decision. Schema has Persona/NCSI placeholders, no integration. Decide: required for launch, or post-MVP with a "pending verification" label (current state).
- [ ] **Late-withdrawal penalty** (already decided we want one; `withdrew_late` is recorded, nothing surfaces it). Pick the mechanic — show-rate %, badge, or strike system.

---

## 🟡 Should have before real users

- [ ] **Push notifications** — availability-matched new games, "you're accepted," re-confirm prompts, new messages, payment received. Needs Expo push tokens (dev build) + edge function sender + `push_tokens` table.
- [ ] **True radius filtering** — feed filters by state today; geocode venues (`venue_lat/lng`) for real miles. Unblocks nearby-game alerts + distance in match scoring.
- [ ] **Game completion nudge** — remind directors to mark complete (or trust the 24h auto-sweep). Depends on push.
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
- [ ] TZ hardcoded to America/Chicago in several screens.
- [ ] Typed-route `as any` casts to clean up once routes stabilize.

---

## Answers captured (July 8, 2026)

**Q: Does instant payout cost more? Where do funds land?**
Our Transfer at completion lands money in the ref's **Stripe connected-account balance immediately** — but that is *not* their bank account. From there, Stripe's **standard automatic payout** (free, ~2 business days, ~7-day hold on the very first one) moves it to their bank. **Instant Payout** to a debit card (~30 min) exists but costs ~1.5% (min $0.50) — someone must eat that (ref via deduction, or us). Recommendation: standard free payouts by default; offer instant as an opt-in ref-side paid feature (mirrors Refr, and becomes revenue). **Action:** stop saying "instant" about bank arrival in the UI (done on game detail).

**Q: Do we collect everything for the 1099 trigger?**
Effectively yes, via Stripe — **not** via our own DB, which is the right liability posture. Express onboarding (our `connect-onboard` fn, `transfers` capability) forces Stripe to collect legal name, DOB, address, and **SSN/TIN** before payouts enable. We deliberately never store SSN (`private_profiles` has legal name/DOB/address fields but SSN is Stripe-only). The **gap is not collection, it's filing**: we haven't enabled Stripe's 1099 Tax Reporting product or chosen filer responsibility. That's a dashboard config task, listed as a blocker above.
