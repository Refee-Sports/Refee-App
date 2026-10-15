# REFEE Launch Tickets

**Source:** `docs/LAUNCH_CHECKLIST.md` (Aug 31, 2026 audit)

Status values: **READY**, **IN PROGRESS**, **BLOCKED — EXTERNAL**, **BLOCKED — DECISION**, **BACKLOG**, **DONE**.

## P0 — launch blockers

| ID | Status | Ticket | Acceptance evidence |
|---|---|---|---|
| PAY-01 | IN PROGRESS | Make Stripe webhooks the payment source of truth | Local implementation + signed replay test pass. Remaining acceptance: deploy/register test and live endpoints, then prove a real test-mode success completes transfers without a client callback. |
| PAY-02 | IN PROGRESS | Refund and dispute handling | Local 0026/webhook state reconciliation, replay protection, manual-review flag, second-charge UI lock, unit tests, and signed-event smoke matrix pass. Remaining: approve loss liability/transfer-reversal policy, implement reversals, deploy events, and collect Stripe test-mode evidence. |
| PAY-03 | BLOCKED — DECISION | Protect referee pay from director settlement failure | Choose escrow-at-fill or a written dunning/guarantee policy; implement the chosen flow and test declined-card behavior without stranding referee earnings. |
| PRICE-01 | BLOCKED — DECISION | Finalize sustainable launch pricing | Pick fee %, processing-fee pass-through/floor, and instant cash-out economics; math tests prove non-negative margin across supported game prices; UI and Stripe totals agree. |
| MSG-01 | IN PROGRESS | Enforce role-based, one-way messaging end to end | Local UI, thread split, migration, and SQL RLS smoke matrix pass. Remaining acceptance: apply 0024 to hosted and repeat the role matrix. |
| LEGAL-01 | BLOCKED — EXTERNAL | Publish Terms of Service and Privacy Policy | Counsel-approved public URLs exist, are linked in onboarding/settings and store listings, and consent/version evidence is retained. Must now also cover biometric processing: ID verification runs a face match and liveness check, and Illinois (BIPA, private right of action) and Texas (CUBI) require notice and consent before capture. The verify screens carry a notice; the policy text does not exist yet. |
| TRUST-01 | DONE | Decide launch identity/background-check posture | Decided: Didit ID verification for every role at sign-up, 18+, background checks deferred. Shipped in migrations 0041-0045 and the two Didit functions; gates enforced in Postgres, badges follow the check, profiles read PENDING VERIFICATION until approved. Live in production and proven with a signed Didit delivery. |
| TRUST-02 | DONE (Oct 15, 2026) | Ship late-withdrawal reliability mechanic | Chose a show rate (no badge, no strikes): games kept vs late withdrawals (inside 48h) and no-shows over the last 365 days; "New referee" under 3 games. `referee_reliability` (0069, pgTAP) gives counts only. Shown on director applicant cards (red under 90%) and on the referee's own profile; the withdraw warnings name it. Nothing is blocked or charged. |
| ASSIGN-01 | READY | Harden assignor schema and RLS | Review migrations 0019/0020; add DB tests for invitation lifecycle, fee types, roster access, and unauthorized writes; apply to hosted only after verification. |
| ASSIGN-02 | READY | Director-to-assignor proposal lifecycle | Director invites, assignor proposes flat/% fee, director accepts one; state transitions, conflicts, and payout basis are tested. |
| ASSIGN-03 | READY | Invite-only roster management | Assignor can invite/remove; referee can accept/decline; no self-request path; audit and RLS tests pass. |
| ASSIGN-04 | READY | Enforce roster-gated jobs and alerts | Feed, claim RPC, direct assignment, and push selection all exclude non-roster referees for assignor-managed work; DB-level bypass attempts fail. |
| ASSIGN-05 | BACKLOG | Assignor event/game workspace | Assignor creates external events without a Refee director, imports/adds games, and uses direct or roster-claim staffing. |
| ASSIGN-06 | BACKLOG | Assignor payout and end-to-end flow | Flat/% payout math, completion trigger, ledger entry, and full director→assignor→roster→game E2E test pass. |
| BULK-01 | READY | CSV template, parser, validation preview | Directors and assignors download a template, upload CSV, see row errors/geocoding/date bounds, and create only confirmed valid rows; parser and transaction tests pass. |
| BULK-02 | BACKLOG | Flexible AI schedule import | CSV/XLSX/text/image parsing produces structured draft games with confidence/errors and requires human confirmation before writes. |

## P0 — production operations

| ID | Status | Ticket | Acceptance evidence |
|---|---|---|---|
| OPS-01 | BLOCKED — EXTERNAL | Configure Stripe Tax Reporting | Filer responsibility, 1099-K/NEC rules, $600 logic, and e-delivery consent are configured and evidenced in live Stripe. |
| OPS-02 | BLOCKED — EXTERNAL | Configure production secrets | Hosted functions contain Stripe, webhook, Anthropic, Google geocoding, and service credentials; logs/config prove presence without revealing values. |
| OPS-03 | BLOCKED — EXTERNAL | Harden production OTP | Real Twilio Verify succeeds on physical devices; launch builds do not accept the shared QA OTP except an explicitly allow-listed non-production path. |
| OPS-04 | BLOCKED — EXTERNAL | Enable and observe lifecycle cron | Hosted `pg_cron` invokes `sweep_game_lifecycle`; job history and an aged test game prove server-side completion. |
| OPS-05 | BLOCKED — EXTERNAL | EAS and store release candidates | Signed iOS/Android builds install on devices; Stripe onboarding/PaymentSheet and push matrix pass; store submissions include policies and review credentials. |
| SEC-01 | DONE (Oct 15, 2026) | Remediate dependency audit findings | Non-breaking fixes applied (`npm audit fix`): the critical `shell-quote` and `sharp` (Next's image optimizer, the one runtime exposure) are fixed. Accepted for now: the remaining highs are build and test tooling (Metro, Jest, Babel, Tailwind's file watcher, Expo CLI, `node-forge` in expo-updates code signing, PostCSS at CSS build time). None ships to a phone or runs on Vercel at request time. Clearing them needs Expo SDK 57 / React Native 0.88, Tailwind 4 (breaks NativeWind) and Next 16; do that as a planned SDK upgrade, not an audit fix. |

## P1 — first-user quality

| ID | Status | Ticket | Acceptance evidence |
|---|---|---|---|
| PAY-04 | DONE | Set accurate first-payout expectations | Payout setup/ready surfaces state first-bank/standard timing; director alerts say transfer to Stripe, not instant bank pay; rendered screenshot captured. |
| CREW-01 | DONE | Show `needs_reconfirm` referees in crew | Crew query includes awaiting-reconfirm, visible `! RE-CONFIRM` state and mapper regression tests pass; rendered screenshot captured. |
| EARN-01 | DONE (Oct 15, 2026) | Add referee earnings ledger | Earnings statement on mobile (`/earnings`) and web (`/app/earnings`): every game and late-cancel fee, amount, paid / sending / owed / failed, totals paid vs owed. Unit-tested mapping. Not yet: CSV export (story 9.2). |
| PAY-05 | BACKLOG | Optional mileage component | Mileage policy, calculation source, approval, charge, payout, and statement line are consistent and tested. |
| PUSH-01 | DONE (Oct 15, 2026): new-game alerts, notification switches, applicant push to director/assignor, payout-sent push to referee | Complete production push triggers | Payout push is sent server-side from every path that marks a payout paid, once per payout (guarded update). Still owed: the physical-device foreground/background matrix. |
| IDV-01 | BLOCKED — EXTERNAL | Rotate the live Didit API key | The key in production was pasted into a chat transcript. Create a new key in Didit (My Application → API Keys), revoke the old one, then update DIDIT_API_KEY in Supabase Edge Function secrets. |
| IDV-02 | READY | Prove one real verification end to end in production | A person signs up on refee-web.vercel.app and completes a check with their own ID (uses one of 500 free monthly checks). Confirms the last unproven step: the webhook writing an approval onto a real account. Everything either side of it is already proven — session creation, signed delivery, ledger write, gates. |
| IDV-03 | BLOCKED — EXTERNAL | Live Stripe publishable key for mobile builds | eas.json staging/production carry Supabase but no Stripe key; only the test key exists (development profile). A store build needs the live one before payments work. |
| SEC-01 | DONE | Close the pre-launch security audit findings | Five findings fixed, tested and live in production (migrations 0046-0049). Any signed-in account could push an arbitrary notification to every user on the platform; every referee's geocoded home address was readable in bulk; the Stripe billing handle sat on a table its owner can write; the signed-out key still held full DML including TRUNCATE on 22 tables; the money and notification endpoints had no ceiling. Verified after deploy: anon is refused every table except the three reference lists. |
| SEC-02 | BLOCKED — EXTERNAL | Register the live Stripe webhook and set its secret | Confirmed by probing the deployed function: it answers 400 "Webhook is not configured", so STRIPE_WEBHOOK_SECRET is unset and **no Stripe event is processed in production** — a successful charge never settles the game, a failure never marks it failed, refunds and disputes never land. Two steps, not one: the endpoint does not exist in Stripe yet, and the signing secret only exists once it does. Exact URL, the eight events to select, and the verification curl are in docs/DEPLOY_HOSTED.md. Blocks PAY-01 and PAY-02. |
| ADMIN-01 | DONE | Staff dashboard | /admin over eight security-definer functions (0050/0051): verification queue, account lookup and suspension, payment issues, metrics. Staff are a hand-written row in a table no client can read or write, never a user_roles value. Proven by calling the RPCs straight at the API with an ordinary referee's token: all refused 403. Suspension rides is_identity_verified so it closes every existing gate, and never deletes an account. |
| STAGE-01 | BLOCKED — DECISION | Stand up a staging project | All three EAS profiles and the web app point at the production project, so a "staging" build talks to live data. docs/STAGING.md and scripts/setup-staging.sh are written and ready; the one remaining step is creating the project, which may need a paid plan since the org already holds two. Staging mirrors prod's schema and config with synthetic data — never a copy of real accounts. |
| SSO-01 | BLOCKED — EXTERNAL | Enable Google sign-in | Only email and phone are enabled on the hosted project; the Google and Apple providers were never configured. Both apps already implement the flow and degrade gracefully when a provider is off. Needs an OAuth client from Google Cloud (redirect URI https://rwqodozmniqjvkyjtcaw.supabase.co/auth/v1/callback) pasted into Supabase → Auth → Providers. Apple deferred by decision, but note the App Store requires Sign in with Apple in any iOS app offering third-party sign-in. |
| TRUST-03 | DECIDED (Oct 3, 2026): 18+ at launch, 16–17 waitlist; supervised tier deferred, needs counsel | Decide whether 16–17-year-old officials get a supervised tier | Refee is 18+ today (migration 0043, enforced at sign-up and again against the date of birth Didit reads off the ID). Many working youth-sports referees are 16–17, so this excludes part of the real workforce — including from adult and rec games where age matters least. Decision needed on whether a supervised under-18 tier exists and which games it may work. Acceptance: policy names the permitted games and supervision; `is_adult` becomes a tier rather than one 18+ cut; pay and contracting for minors resolved with counsel (a minor cannot hold the Stripe payout account they are paid through); Didit's Adaptive Age Verification template replaces the flat check; gate tests cover each tier. |

**TRUST-03 follow-up (Oct 3, 2026):** launch stays 18+. 16- and 17-year-olds who enter their birthday at sign-up are offered an email list (migration 0060 `under_18_waitlist`, `join_under_18_waitlist`; stores account email, age 16/17, optional state; never a date of birth; not offered under 16; removed with the account). Counsel to review the Privacy wording and state rules on contacting minors before a tier is designed. Migration 0060 is applied **locally only**.

## Product decisions — Oct 3, 2026 (from the referee user-story review)

1. **Accepting a game stays apply → director/assignor approves** (auto-accept optional). Not instant-accept.
2. **Withdrawal window is 48 hours** (was 24). Free before it; recorded as late inside it. The penalty itself is still open (TRUST-02). Shipped in migration 0061, `WITHDRAW_FREE_WINDOW_HOURS`, and both apps' withdraw copy.
3. **A game completes 2 hours after its scheduled end** (was 24), with no director confirmation needed. Completing locks in each referee's pay, which is when the money lands in the referee's **holding balance**. It is *not* sent to the bank at that point: the referee withdraws it, or a **weekly payout** runs. Completion timing shipped in 0061. **Holding balance, withdraw button and weekly payout are not built** (new ticket PAY-06).
4. **Distance stays straight-line miles** (Haversine), not drive distance.
5. **Payout timing is to be confirmed with the processor** (Stripe) before any copy promises it. Until then, copy says what the docs say: first bank deposit can take about a week.

**PAY-06 (new, BACKLOG, depends on decision 5):** referee holding balance with manual withdrawal and an optional weekly payout. Needs Stripe's payout-schedule behavior confirmed (manual vs weekly on Express accounts, availability rules, any instant-payout fee). Also needs: a Withdraw action, balance and per-game status in the app, the "payment sent" notification, and updating `run-payouts`, which still assumes automatic payouts inside 48 hours.

Migrations 0060 (16–17 waitlist) and 0061 are applied **locally only**. Staging is at 0049 and production at an unknown level; both need 0050–0061 through the normal backup-and-push process.

**New-game alerts and notification switches (Oct 3, 2026, user stories 5.1 and 5.2)** — built and tested locally; **not deployed**.
- Migration 0062: `notification_preferences` (new games / crew messages / game updates; no row = all on; owner-only) and `new_game_alerts` (one alert per game per referee), plus four backend-only functions. Who hears about a game is decided in the database from the feed's rules (distance, available day, minimum rate) plus: verified, not suspended, no clash with a confirmed game, not already answered, on the roster for assignor-run events (none for `assignor_direct`), and new-game alerts not turned off. The sport and the on-duty switch are not used (the switch starts off for everyone).
- Edge function `notify-new-games` (new) and `send-push` (now takes `kind` and skips people who turned that kind off). **Both must be deployed** to hosted/staging along with migrations 0050–0062.
- `createGame` and both schedule imports call it after posting. Best-effort; never blocks posting.
- Mobile: Notifications screen (profile → NOTIFICATIONS) with three switches (new-games switch shown to referees only); tapping a notification now opens the right screen (new game, confirmation, change, message) — previously nothing handled a tap; the game screen shows "NO LONGER AVAILABLE" when the game is full, started, over or cancelled.
- Not done: web has no notification settings page (push is native-only); not yet seen on a physical device (push needs an EAS dev build); the "payment sent" push (story 8.2) still needs building; per-person daily cap on alerts isn't built (the poster is capped at 100 announcements a day).

## Director decisions — Oct 3, 2026 (from the director user-story review)

1. **Charge at booking.** A game is charged when published, not at completion. The charge is crew pay + the 5% platform fee, shown as its own line before publishing; a failed payment means the game is not published. Resolves the "escrow-at-fill vs dunning" question in PAY-03. `prepay-game` and `prepayGame()` exist (core + web game page); mobile does not call it yet. Cancelling a prepaid game needs partial refunds, which depend on PAY-02 (refund handling, still in progress).
2. **Director cancellation rules change** from the current "within 1 hour: 50%" to: free more than 24 h before start; **25%** of each referee's pay within 24 h; **50%** after the start. Remainder returned to the director. The "after a referee has arrived" trigger needs location check-in, which is not built, so use the start time. Code still has `CANCEL_FEE_WINDOW_HOURS = 1` and a 50% fee in `cancel_game` until this is built. The confirmation screen must show what the director will owe and what is returned.
3. **Directors send one-way information** about a game or an event; they do **not** take part in crew chat. Matches the built design (MSG-01). An event-wide director message is not built (only the assignor roster announcement exists).
4. **Wording:** "escrow" is replaced by "held until the game is complete." How the money is held is **undecided** and needs Stripe and counsel.

## P2 — technical debt and post-launch

| ID | Status | Ticket | Acceptance evidence |
|---|---|---|---|
| TEST-01 | READY | Close money/lifecycle test gaps | Earnings bucketing, reconfirm, withdraw, RLS, and edge-function integration coverage are green locally and in CI. |
| QUALITY-01 | DONE | Restore a clean repository-wide quality gate | Repo-wide lint has zero errors/warnings; `npm run quality` passes lint, TypeScript, and 91 tests; CI also verifies a production Expo web export. |
| TZ-01 | DONE (Oct 15, 2026) | Venue-local timezone model | Already stored per game (0035) and used by every game display. Last gap fixed: editing a game prefilled the device's clock, so a director in another zone would shift the game on save; now `venueWallClock` prefills the venue's time. |
| A11Y-01 | READY | Restore fuller Dynamic Type support | Fixed-height clipping is removed from key flows, scale cap is raised, and screenshots pass at largest supported sizes. |
| JOBS-01 | BACKLOG | Real invited/saved jobs | Persistence, tabs, empty/error states, and filters use real data with tests. |
| PROFILE-01 | BACKLOG | Face-only avatar validation | Uploads fail safely when face rules are not met; privacy, bias, retry, and override policy are documented. |
| RATING-01 | BACKLOG | Rolling 50-game rating | Public aggregate uses the most recent 50 completed rated games with stable tie ordering and migration/query tests. |
| WEB-01 | DONE | Restore Expo web UI QA target | Install `react-native-web`; isolate native Stripe/Dynamic Type internals; use Zustand's CJS entry; mobile-width local sign-in and feature screenshots render successfully. |

## Working order

1. PAY-01 and MSG-01 (data integrity/security; no product decision required).
2. PAY-02, PAY-04, CREW-01, EARN-01, TEST-01.
3. Resolve PAY-03, PRICE-01, TRUST-01, and TRUST-02 product decisions.
4. ASSIGN-01 through ASSIGN-06, then BULK-01.
5. Complete OPS-01 through OPS-05 against hosted/live systems before launch approval.
