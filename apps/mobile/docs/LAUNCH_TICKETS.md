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
| LEGAL-01 | BLOCKED — EXTERNAL | Publish Terms of Service and Privacy Policy | Counsel-approved public URLs exist, are linked in onboarding/settings and store listings, and consent/version evidence is retained. |
| TRUST-01 | BLOCKED — DECISION | Decide launch identity/background-check posture | Launch requirement or post-MVP policy is approved; UI truthfully represents verification state; no unverified badge implies checks occurred. |
| TRUST-02 | BLOCKED — DECISION | Ship late-withdrawal reliability mechanic | Choose show rate, badge, or strikes; define lookback/appeal rules; implement and test late vs on-time withdrawals. |
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
| SEC-01 | READY | Remediate dependency audit findings | Triage 2 critical / 14 high production-tree audit findings; apply non-breaking transitive fixes, resolve Expo SDK-bound advisories through a compatibility-tested SDK upgrade, and document any accepted build-tool-only exposure. |

## P1 — first-user quality

| ID | Status | Ticket | Acceptance evidence |
|---|---|---|---|
| PAY-04 | DONE | Set accurate first-payout expectations | Payout setup/ready surfaces state first-bank/standard timing; director alerts say transfer to Stripe, not instant bank pay; rendered screenshot captured. |
| CREW-01 | DONE | Show `needs_reconfirm` referees in crew | Crew query includes awaiting-reconfirm, visible `! RE-CONFIRM` state and mapper regression tests pass; rendered screenshot captured. |
| EARN-01 | READY | Add referee earnings ledger | Per-game gross/status/date/payout reference totals reconcile to summary periods; cancelled/bust/held cases are tested. |
| PAY-05 | BACKLOG | Optional mileage component | Mileage policy, calculation source, approval, charge, payout, and statement line are consistent and tested. |
| PUSH-01 | READY | Complete production push triggers | Availability-matched jobs and payment-received pushes are server-triggered; a physical-device foreground/background matrix passes. |

## P2 — technical debt and post-launch

| ID | Status | Ticket | Acceptance evidence |
|---|---|---|---|
| TEST-01 | READY | Close money/lifecycle test gaps | Earnings bucketing, reconfirm, withdraw, RLS, and edge-function integration coverage are green locally and in CI. |
| QUALITY-01 | DONE | Restore a clean repository-wide quality gate | Repo-wide lint has zero errors/warnings; `npm run quality` passes lint, TypeScript, and 91 tests; CI also verifies a production Expo web export. |
| TZ-01 | READY | Venue-local timezone model | Venue timezone is stored/derived and every display/filter uses it; DST and cross-zone tests pass. |
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
