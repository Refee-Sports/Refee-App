# REFEE — Project Status & Gap Analysis

**Last updated:** July 7, 2026
**Stage:** Pre-launch MVP — feature-complete for local testing, not yet production-deployed
**Launch sport:** Basketball

---

## 1. What Refee Is

A two-sided gig marketplace for sports officials. Tournament directors post games; referees find, accept, and work them. Privacy-first: a referee's legal identity is never exposed to organizers (first name + last initial only, enforced at the database level).

**Tech stack:** Expo v54 / React Native 0.81 · Expo Router v6 · NativeWind v4 (Tailwind) · Supabase (Postgres + RLS + Realtime + Storage) · Zustand v4
**Design system:** Brutalist sport-tech — InterTight display font, JetBrains Mono labels, ink/paper/signal/chalk/hi-vis palette, borders-not-shadows

---

## 2. Completed Features

### Auth & Onboarding
- [x] Phone OTP sign-in (test OTP map for local dev) + Google/Apple OAuth
- [x] Role selection: Referee vs Tournament Director
- [x] Referee onboarding: name → location → sport → rate → certs → levels
- [x] Director onboarding: contact → organization (name + type) → location
- [x] Role-aware routing (referee app vs director app after login)

### Referee Experience
- [x] **Jobs feed** — filtered to: ref's state, at/above their min pay, excludes games already accepted/applied/declined
- [x] **Accept / decline** — green accept, red decline; declined games never reappear
- [x] **Schedule-conflict guard** — can't accept a game overlapping an already-accepted game's time window
- [x] **Profile** — headshot upload (tap avatar → photo library → Supabase Storage), scorecard (rating / reviews / verified), stat strip
- [x] **Earnings** — Uber-style: tap to cycle EARNED/WK → /MO → /YR; PENDING banner (accepted upcoming games × pay); home screen PAID/PENDING card
- [x] **Availability** — day-of-week chips (SUN–SAT) + weekday/weekend/all quick-sets, radius presets (10/25/50/100 mi), min pay floor, available/unavailable toggle
- [x] **Upcoming games** — on home (today/upcoming) and profile, with crew-message shortcut
- [x] **Re-confirm flow** — if a director changes time/venue/pay after acceptance, ref sees "⚠ DETAILS CHANGED" and must RE-CONFIRM or DROP OUT
- [x] **NEW REF badge** — no rating number shown until 5 ratings received

### Director Experience
- [x] **Tournaments** — create (calendar range picker, single or multi-day), edit, status workflow (draft → open → staffing → staffed → in progress → completed)
- [x] **Games** — create with: level picker, required ruleset chips (NFHS / NCAA-M / NCAA-W / PRO) + rule modifications, crew size 2/3, pay, calendar date + tip-off time dropdown (15-min steps), 4-quarters/2-halves format + minutes per period, venue (required), uniform, notes, auto-accept toggle
- [x] **Edit game** — prefilled form; material changes (time/venue/pay) auto-flip confirmed refs to "AWAITING RE-CONFIRM" + post a crew-thread warning
- [x] **Copy game** — one tap duplicates everything except date/time for fast tournament build-out
- [x] **Applicant management** — pending/accepted/declined sections, approve (green) / decline (red), auto-accept bypass
- [x] **Privacy-limited referee view** — first name + last initial, headshot, city/state, rating (or NEW REF), certs, levels. No PII.
- [x] **Ratings** — after game start: rate each ref 1–5 on On-Time / Professionalism / Game Management (overall = average; call quality deliberately excluded as too subjective)

### Messaging (both roles)
- [x] DMs: director ↔ accepted ref; assignor ↔ ref
- [x] Crew group threads per game (director + all accepted refs; refs on same crew can talk)
- [x] Entry points: game detail (director), job detail + profile cards (referee)
- [x] Inbox tab (referee) / Messages tab (director) with unread dots, crew badges
- [x] Realtime delivery (Supabase channels), optimistic send, read tracking

### Database (12 migrations)
| # | Contents |
|---|----------|
| 0001 | Core schema: profiles (public/private split), sports, jobs, assignments, ratings, hirers |
| 0002 | RLS policies |
| 0003 | One hirer per user |
| 0004 | Roles, levels, tournaments, assignors |
| 0005 | RLS recursion fix |
| 0006 | Demo job date refresh |
| 0007 | `auto_accept` on jobs |
| 0008 | Messaging (conversations, participants, messages + RLS + realtime) |
| 0009 | Rating categories (on_time, professionalism, game_management) |
| 0010 | Game format (quarters/halves, period_minutes) |
| 0011 | Avatars storage bucket + policies |
| 0012 | Ruleset + ruleset_modifications (jobs + tournaments) |

### Test Users (local only — OTP always `123456`)
| Phone | Who | Scenario |
|-------|-----|----------|
| (555) 555-0100 | Alex R — Austin TX | Established ref: certs, levels, availability |
| (555) 555-0101 | Jordan H — Texas Hoops Org | Director with demo jobs |
| (555) 555-0102 | Sam T — Denver CO | Brand-new ref (empty states) |
| (555) 555-0103 | Marcus J — Houston TX | Earnings: $450 wk / $850 mo / $1,375 yr |
| (555) 555-0104 | Devon K — San Antonio TX | 3 accepted upcoming games |
| (555) 555-0105 | Taylor W — DFW Hoops Coalition | Director 2: tournament + games seeded |

---

## 3. Gaps

### 🔴 Blocking launch (must have)

1. **Payments — ✅ BUILT in Stripe test mode (July 2026), needs live-mode hardening.**
   Working locally: director pays at completion via PaymentSheet (crew total + 10% fee), refs onboard to Stripe Express from profile, instant Transfers on payment, held-payout release for late onboarders, bust fees flow through the same rail. See `docs/STRIPE_LOCAL.md`. Remaining for production: `payment_intent.succeeded` webhook as source of truth, refunds/disputes, live-mode transfer balance timing, Connect platform review.

2. **Production infrastructure.**
   Everything runs on local Supabase (Docker). Needs: hosted Supabase project, real Twilio SMS for OTP (config placeholder exists), EAS build + App Store / Play Store submission, env management for prod keys.

3. **Push notifications.**
   No push at all. In-app messaging covers some of it, but core loops depend on push: new-game alerts matching a ref's availability/radius, "you've been accepted," re-confirm prompts, new messages. Needs Expo push tokens (dev build, not Expo Go) + a Supabase Edge Function sender + a `push_tokens` table.

4. **True radius filtering.**
   Feed filters by **state**, not miles. The 10/25/50/100 radius presets are stored but unused in queries. Needs geocoding on venue addresses (`venue_lat/lng` columns exist, are empty) + Haversine distance in the feed query. Also blocks "notify refs of nearby games."

### 🟡 Should have before real users

5. **Location check-in for timeliness.** Planned: use device location to check refs into games and auto-feed the On-Time rating. Needs expo-location, geofence radius per venue (depends on geocoding, #4), check-in UI. `on_time` rating column is ready for it.
6. ~~**Game/tournament cancellation.**~~ ✅ DONE (migration 0013): director CANCEL GAME button; cancelling within 1h of tip-off (`CANCEL_FEE_WINDOW_HOURS`) pays confirmed refs a 50% bust fee (recorded as `amount_due`, paid when Stripe lands); earlier cancels pay nothing; crew thread auto-notified.
7. ~~**Ref withdrawal.**~~ ✅ DONE: WITHDRAW on accepted job detail via security-definer RPC — free >24h before tip-off, flagged `withdrew_late` inside 24h (reliability record); slot auto-reopens (open/partially_filled) and crew thread is notified.
8. ~~**Game completion.**~~ ✅ DONE: director MARK GAME COMPLETED button (after start) locks in full pay; auto-complete sweep marks any game completed 24h after its scheduled end (pg_cron hourly when available + client RPC fallback on home/tournaments screen focus).
9. ~~**Rating prompts.**~~ ✅ DONE: completed games show a "GAME COMPLETED — RATE YOUR CREW" banner with unrated count; rated state now persists (loaded from ratings table, not just session memory). Push nudge still pending on #3.
10. **needs_reconfirm refs and crew count.** Crew list on the referee job detail only shows accepted/pending; a ref awaiting re-confirm drops off the visible crew. Cosmetic but confusing.
11. **Late-withdrawal penalty.** DECIDED: there WILL be a penalty (per Gerda, July 2026) — design deferred. `withdrew_late` is already recorded on every late withdrawal, so history accrues from day one. Options when we pick this up: show-rate % on public profile (completed ÷ (completed + late withdrawals)), a reliability badge tier, temporary feed deprioritization, or a strike system (e.g., 3 late withdrawals in 90 days = 1-week pause).

### 🟢 Nice to have / later

11. **Assignor role** — schema + routing exist (proposals, fees, pro-assignor badges) but no assignor UI was ever built. Decide: cut from MVP or build.
12. **Invited / Saved job tabs** — feed tabs exist but run on mock data; no real invite or save mechanism.
13. **Rolling rating window** — ratings currently average all-time; the agreed design was last-50-games so refs can recover from a bad stretch.
14. **Report/block, dispute flow** — no trust & safety tooling (no-show handling exists only as an enum value).
15. **Background checks / identity verification** — schema placeholders (Persona, NCSI) with no integration.
16. **Multi-sport** — sports table is seeded (soccer, football, volleyball, baseball inactive); UI is basketball-only by design for launch.
17. **Cross-tournament game copy** — copy currently lands in the same tournament only.
18. **Earnings history detail** — totals only; no per-game earnings ledger/statement view.

### ⚠️ Technical debt worth knowing about
- **Typed-route casts** — new route groups use `as any` on router pushes; harmless but should be cleaned up once routes stabilize.
- **Client-side filtering** — earnings periods, feed state/pay filters, and conflict checks all filter in the app after fetching. Fine at MVP scale; move server-side (RPC/views) as data grows.
- **No automated tests** — zero test coverage; the earnings math, conflict guard, and re-confirm flow are the highest-value targets for unit tests.
- **Mock data fallback** — the jobs feed silently falls back to mock jobs when the DB returns zero rows, which can mask real "no jobs" states during testing.
- **TZ hardcoded** — display formatting pins to America/Chicago in several screens.

---

## 4. Suggested Order of Attack

1. **Game completion + withdrawal + cancellation** (closes the earnings/ratings loop; no external dependencies)
2. **Push notifications** (dev build + tokens + edge function — unlocks #3, #9, and availability alerts)
3. **Geocoding + radius filtering** (fixes the core discovery experience)
4. **Payments** (largest scope — start product decisions now, build after the loops above are closed)
5. **Production deploy** (hosted Supabase + Twilio + EAS builds)
6. **Location check-in** (after geocoding and push exist)
