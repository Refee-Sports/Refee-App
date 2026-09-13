# Refee production launch backlog

**Created:** September 2, 2026  
**Web production target:** September 9, 2026  
**Mobile release-candidate / store-submission target:** September 9, 2026  
**First live tournament must be assignable:** September 20, 2026  
**Canonical backend:** the existing Supabase project and migrations in this repository

**Approved architecture:** ADR 0001 — distinct Expo and Next.js frontends in a
target monorepo, with shared domain/types/tokens and server-authoritative rules.

This is the cross-platform launch backlog for `Refee-App/Refee/refee` and the
sibling `Refee-Web` repository. It complements the detailed payment and mobile
history in `LAUNCH_TICKETS.md`; when priorities conflict, this file governs the
September 2026 launch.

## Problem and launch outcome

Tournament directors and assignors need one reliable system to bring referees
into an organization/roster, build a tournament schedule, staff each game, and
communicate changes. Referees need to accept membership and game invitations,
avoid conflicts, see authoritative schedule/pay information, and use the same
account and data from web or mobile.

Launch is successful only when:

1. A director can create an organization and tournament, invite an assignor,
   accept the assignor's terms, and retain appropriate visibility.
2. An assignor hired inside or outside Refee can create/manage the tournament,
   invite existing or new referees, and staff every game.
3. A referee can join from an email/SMS link, create or link an account, accept
   the roster relationship, and accept/decline each game assignment.
4. Phone, Google, Apple, and email-link authentication resolve to one person and
   one set of roles on both platforms without duplicate profiles.
5. Web and mobile use the same Supabase project, tables, storage, RLS, Edge
   Functions, and business rules. No web-only shadow database is permitted.
6. The three-persona browser and mobile test matrices pass against staging, a
   production migration rehearsal succeeds, and the September 20 tournament is
   entered and staffed in a supervised dress rehearsal.

## Scope rules for the one-week release

Use MoSCoW priority because the fixed launch window makes speculative RICE
inputs less useful. `P0 / MUST` tickets block launch. `P1 / SHOULD` tickets ship
if they protect the first live tournament or substantially reduce support risk.
`P2 / LATER` work must not delay the first tournament.

Launch basketball only. Support responsive web plus iOS; keep Android buildable
but do not delay web/iOS for Play Store approval. Prefer CSV schedule import to
AI/image import for this release. Treat roster membership as a professional
network relationship, not an employment classification.

Status values: `DONE`, `IN PROGRESS`, `READY`, `BLOCKED — DECISION`,
`BLOCKED — EXTERNAL`, and `BLOCKED — WORKSPACE`.

## Ordered backlog

| Order | ID | Priority | Status | Size | Ticket | Depends on | Acceptance evidence |
|---:|---|---|---|---:|---|---|---|
| 1 | DEC-01 | P0 | BLOCKED — DECISION | S | Approve organization, role, and tournament ownership model | — | Answers recorded for Questions 1–3; wireframes and schema use the same nouns and permission boundaries. |
| 2 | TRUST-01 | P0 | BLOCKED — DECISION | S | Approve identity/background-check launch posture and remove unsupported claims | — | Written launch rule exists; every web/mobile claim matches actual verification state; unverified users are never shown as vetted. |
| 3 | MONEY-01 | P0 | BLOCKED — DECISION | S | Approve pricing, assignor fee, settlement-failure, refund, and dispute policy | — | One signed-off fee example covers director charge, Refee fee, assignor fee, referee pay, refund, dispute, and failed settlement. |
| 4 | ACCESS-01 | P0 | BLOCKED — WORKSPACE | S | Make `Refee-Web` writable in this Codex workspace | — | Both repositories can be patched and tested in one task without copying code or bypassing reviewable edits. |
| 5 | ARCH-01 | P1 | READY | L | Consolidate into the approved monorepo without losing either repository's history | ACCESS-01 | `apps/mobile`, `apps/web`, shared packages, and root CI/workspaces exist; old commit history remains discoverable; both apps build before and after the move. This must not delay authorization fixes or the first vertical slice. |
| 6 | DATA-01 | P0 | READY | M | Establish one canonical cross-platform schema contract | DEC-01 | Generated/checked TypeScript database types are consumed by web and mobile; schema version is visible in builds; no duplicated domain types drift silently. |
| 7 | ORG-01 | P0 | BLOCKED — DECISION | L | Add organizations and multi-user memberships | DEC-01, DATA-01 | `organizations` and `organization_memberships` support owner/admin/director/assignor/referee permissions, multiple organizations per user, soft removal, timestamps, and audit actor; SQL tests prove tenant isolation. |
| 8 | ORG-02 | P0 | BLOCKED — DECISION | L | Add secure organization/roster invitations for existing and new users | ORG-01 | Email and/or SMS invite has hashed single-use token, expiry, resend/revoke, idempotent acceptance, contact normalization, account-linking guard, and audit history; no PII is exposed through lookup endpoints. |
| 9 | RBAC-01 | P0 | IN PROGRESS | L | Replace permissive assignor mutations with atomic RPCs and an RLS role matrix | DATA-01 | Local migrations 0030–0031 and mobile callers are implemented; 120 app tests pass. Director staffing/lifecycle, assignor agreement, schedule import, and server-owned pay guards are included. Remaining: execute the 58-case pgTAP matrix and apply to staging/hosted. |
| 10 | AUTH-01 | P0 | READY | M | Configure one Supabase Auth tenant for phone, Google, Apple, and email magic link | DATA-01 | Dev/staging/prod redirect allowlists work; provider secrets are environment-scoped; all four methods create or recover the same profile contract; OAuth cancellation and error states are tested. |
| 11 | AUTH-02 | P0 | BLOCKED — WORKSPACE | M | Implement secure Next.js SSR authentication | ACCESS-01, AUTH-01 | `@supabase/ssr` uses PKCE and request-scoped clients, protected routes refresh cookie sessions, authenticated responses are not publicly cached, and sign-out invalidates the browser session. |
| 12 | AUTH-03 | P0 | IN PROGRESS | M | Finish mobile auth parity and account linking | AUTH-01 | Phone, Google, Apple, and email magic-link UI/callback handling are implemented. Remaining: hosted provider/redirect configuration, signed-release/device proof, reauthenticated identity linking, recovery states, and duplicate-profile regression coverage. |
| 13 | AUTH-04 | P0 | READY | M | Account lifecycle and recovery | AUTH-01 | Users can view linked sign-in methods, recover access, change verified contact data, export required account data, and delete an account with documented financial-record retention behavior. |
| 14 | TOURN-01 | P0 | BLOCKED — DECISION | L | Director-to-assignor tournament agreement lifecycle | DEC-01, MONEY-01, RBAC-01 | Director invites one or more assignors, assignors propose flat/% fee, director accepts exactly one, losing proposals close, both parties see an audit trail, and only authorized actors can cancel/replace the agreement. |
| 15 | TOURN-02 | P0 | BLOCKED — DECISION | L | Assignor creates a tournament for an offline client | DEC-01, RBAC-01 | An assignor hired outside Refee can record the client organization/contact, attest authority, create the event, optionally invite the client to claim visibility, and cannot impersonate an existing organization. |
| 16 | ROSTER-01 | P0 | IN PROGRESS | L | Assignor roster management | ORG-02, RBAC-01 | Existing-user search/invite/remove and referee accept/decline UI now enforce consent through narrow RPCs. Remaining: secure email/SMS invitations for absent users, expiry/resend/revoke, organization scope, eligibility enforcement, notifications, and E2E proof. |
| 17 | STAFF-01 | P0 | IN PROGRESS | L | Safe direct assignment and roster-only self-claim | ROSTER-01, RBAC-01 | Migration 0030 creates consent-based `offered` assignments and atomic roster/conflict/capacity checks. Remaining: qualification/availability enforcement, notifications, SQL execution, and UI/E2E proof. |
| 18 | SCHED-01 | P0 | IN PROGRESS | L | Tournament/game workspace and CSV import | TOURN-01, TOURN-02 | Shared director/accepted-assignor CSV UI, template download, row preview, IANA timezone/DST validation, duplicate detection, and atomic import RPC are implemented; seven parser tests and 13 pgTAP cases were added. Remaining: execute migration/pgTAP against Supabase and complete authenticated device/browser proof. |
| 19 | WEB-01 | P0 | BLOCKED — WORKSPACE | L | Build authenticated responsive application shell | ACCESS-01, AUTH-02 | Role switcher, organization switcher, protected navigation, loading/empty/error states, keyboard navigation, and mobile/desktop layouts match the Refee design system. |
| 20 | WEB-02 | P0 | BLOCKED — WORKSPACE | XL | Build director and assignor workflows on web | WEB-01, TOURN-01, TOURN-02, ROSTER-01, STAFF-01, SCHED-01 | All director/assignor success criteria can be completed in Chrome/Safari without mobile; no hidden mobile-only prerequisite. |
| 21 | WEB-03 | P0 | BLOCKED — WORKSPACE | L | Build referee workflows on web | WEB-01, ROSTER-01, STAFF-01 | Referee can finish onboarding, accept roster invites, set availability, accept/decline/reconfirm assignments, view schedule/crew/pay, and message permitted participants. |
| 22 | MOB-01 | P0 | IN PROGRESS | XL | Complete assignor, organization, roster, and staffing UI on mobile | ORG-01, ROSTER-01, STAFF-01, SCHED-01 | Dedicated assignor routing, tournament/proposal inbox, accepted-event games, roster search/invite/remove, offer/self-claim staffing, messages, and profile are implemented. Remaining: new-user invites, organization model, notification delivery, qualification enforcement, E2E/device proof, and web parity. |
| 23 | PARITY-01 | P0 | READY | M | Cross-platform UI and behavior contract | WEB-01, MOB-01 | Token/component/state inventory maps equivalent web/mobile controls; labels, status meanings, validation, permissions, and destructive confirmations match; documented platform exceptions are approved. |
| 24 | NOTIFY-01 | P0 | READY | L | Transactional invitation and assignment notifications | ORG-02, STAFF-01 | Server sends email/SMS/push for invite, assignment offer, acceptance/decline, material change, reconfirmation, cancellation, and message; dedupe, retry, preference, deep-link, and delivery-log tests pass. |
| 25 | MSG-01 | P0 | IN PROGRESS | M | Finish role-safe messaging | RBAC-01 | Hosted migrations are applied; director↔assignor, director/assignor↔assigned referee, and crew scopes pass the RLS matrix; removed/declined users lose access as specified. |
| 26 | PAY-01 | P0 | IN PROGRESS | L | Make Stripe webhooks the payment source of truth | MONEY-01 | Signed replay tests and real Stripe test-mode event prove one idempotent charge and correct transfers without a client callback. |
| 27 | PAY-02 | P0 | BLOCKED — DECISION | L | Complete refund, dispute, reversal, and failed-settlement handling | MONEY-01, PAY-01 | Chosen liability/reversal policy is implemented; replay/partial refund/dispute/decline tests reconcile ledger and UI without double charge or stranded earned pay. |
| 28 | PAY-03 | P0 | READY | M | Cross-platform statements and payout readiness | PAY-01 | Referee and assignor see per-game gross, adjustments, status, date, payout reference, and totals; director sees invoice/receipt; web/mobile totals reconcile to Stripe and DB. |
| 29 | TEST-01 | P0 | IN PROGRESS | L | SQL migration and RLS integration suite | RBAC-01 | A 58-case staffing/director/lifecycle/agreement/schedule-import pgTAP matrix exists and CI is configured to run it. Remaining: Docker execution, clean reset, tenant/invite-expiry/payment coverage, and hosted proof. |
| 30 | TEST-02 | P0 | READY | L | Browser E2E suite for three personas | WEB-02, WEB-03 | Playwright runs phone/Google test auth paths and full director→assignor→referee journey, including failure/permission cases, against ephemeral/local and staging environments. |
| 31 | TEST-03 | P0 | READY | L | Mobile E2E and physical-device matrix | MOB-01 | Maestro/Detox covers critical journeys; signed iOS build passes OAuth, SMS, push, deep links, camera/photo, Stripe, foreground/background, offline/retry, and largest text checks on physical devices. |
| 32 | TEST-04 | P0 | READY | M | September 20 dress rehearsal and launch sign-off | TEST-01, TEST-02, TEST-03 | Production-like organization, assignor, referees, tournament, and schedule are entered; all participants complete invite/assignment actions; rollback/support owner and sign-off evidence are recorded. |
| 33 | SEC-01 | P0 | IN PROGRESS | L | Security and privacy launch gate | AUTH-02, RBAC-01, TEST-01 | Compatible Expo 54 patches reduced the production audit from 40 advisories (2 critical) to 28 (0 critical), and quality plus web/iOS exports still pass. Remaining SDK/toolchain advisories require an Expo upgrade or documented non-runtime risk acceptance; secrets/RLS/storage/functions, rate limits, audit log, headers, PII/retention, backup restore, and incident contacts still need full evidence. |
| 34 | OPS-01 | P0 | BLOCKED — EXTERNAL | L | Production Supabase, migrations, backups, and observability | TEST-01, SEC-01 | Staging→production migration rehearsal and rollback succeed; PITR/backups configured; error/performance/audit dashboards and actionable alerts exist; lifecycle cron and Edge Function health are observed. |
| 35 | OPS-02 | P0 | BLOCKED — EXTERNAL | L | Deploy production web and domain | WEB-02, WEB-03, SEC-01 | Production build passes; domain/TLS, environment variables, auth redirects, robots/sitemap/OG, uptime check, error monitoring, analytics consent, and rollback are verified. |
| 36 | LEGAL-01 | P0 | BLOCKED — EXTERNAL | M | Publish launch legal/support surfaces | MONEY-01, TRUST-01 | Counsel-approved Terms, Privacy, refund/cancellation, independent-contractor/marketplace position, contact/support, consent version, and account-deletion instructions are linked on web/mobile/store. |
| 37 | STORE-01 | P0 | BLOCKED — EXTERNAL | L | Submit iOS release candidate | AUTH-03, TEST-03, LEGAL-01 | Signed EAS build installs; App Store privacy answers, screenshots, review notes/account, Sign in with Apple, account deletion, push, Stripe flows, and policy URLs pass preflight and submission is accepted for review. |
| 38 | SUPPORT-01 | P0 | READY | M | First-tournament operating runbook | TEST-04, OPS-01 | Named on-call owner, escalation contacts, invite resend/manual recovery, staffing override with audit, payment hold/retry, cancellation/no-show, data correction, rollback, and user communication steps are rehearsed. |
| 39 | QUALITY-01 | P0 | DONE | S | Mobile repository quality baseline | — | `npm run quality` passed September 2, 2026: lint, TypeScript, 15 files / 120 tests; web and iOS production exports succeed after schedule-import dependencies; the welcome and phone/email sign-in states pass a browser smoke check. SQL, signed-device, and E2E gates remain incomplete. |
| 40 | WEB-QUALITY-01 | P0 | BLOCKED — WORKSPACE | M | Web quality and CI baseline | ACCESS-01 | ESLint, TypeScript, unit/component tests, Playwright smoke, accessibility scan, and production build run in CI with no warnings or hidden network dependencies. |
| 41 | A11Y-01 | P1 | READY | M | Accessibility and responsive QA | WEB-02, MOB-01 | WCAG 2.2 AA checks for web; VoiceOver, Dynamic Type, touch targets, focus order, contrast, reduced motion, and error announcements pass critical journeys. |
| 42 | PERF-01 | P1 | READY | M | Performance budgets and load checks | WEB-02, OPS-01 | Web Core Vitals budget is defined; roster/game lists remain usable at launch-scale; invite and staffing concurrency tests meet agreed latency/error budgets. |
| 43 | IMPORT-02 | P2 | READY | XL | AI/XLSX/image schedule import | SCHED-01 | Non-CSV inputs create reviewable drafts with confidence and never write unconfirmed games. Explicitly post-launch. |
| 44 | MULTISPORT-01 | P2 | READY | XL | Enable sports beyond basketball | — | Per-sport rules, certifications, positions, UI, and tests exist. Explicitly post-launch. |

## Current evidence and known gaps

- Mobile `npm run quality` passes 120 unit tests. A 58-case staffing/director/
  lifecycle/agreement/schedule-import pgTAP suite now exists, but Docker is stopped so it has not executed; no end-to-end
  suite yet proves the launch journey.
- Mobile implements phone OTP, Google/Apple entry points, and email magic-link
  callback handling, but hosted provider/redirect configuration, release-build
  proof, recovery, and safe identity linking are not evidenced.
- Mobile no longer promises a guaranteed 48-hour payout while settlement-risk
  policy is unresolved; the welcome experience now promises payout visibility.
- Migration 0030 removes generic referee/assignor staffing mutations and adds
  consent-based offers plus atomic roster, conflict, and capacity checks. It is
  locally implemented but not yet database-executed or deployed.
- Migration 0031 and the shared schedule importer add explicit tournament
  timezones plus preview-first, all-or-nothing CSV creation for directors and
  accepted assignors. Web/iOS exports pass, but the RPC is not yet executed
  because local Supabase remains unavailable.
- Production dependency remediation updated Expo 54 and compatible transitive
  packages without changing SDK major, reducing `npm audit --omit=dev` from 40
  advisories (2 critical) to 28 (0 critical). The remaining 9 high and 19
  moderate findings are Expo/Metro/React Navigation build-tool chains whose
  automatic fix requires breaking SDK/router changes; do not use `--force`
  during the one-week stabilization window without an explicit upgrade branch
  and full native regression pass.
- A clean local Supabase rebuild was attempted on September 3. Docker removed
  the old database container, but registry rate limits and Docker Desktop
  internal read-only/I/O errors prevented image restoration. CI remains
  configured to run start → clean reset → all pgTAP tests on a fresh runner;
  the local Docker engine must be repaired/restarted before using the local
  backend again.
- Roster invitations still require an existing profile; secure email/SMS
  invitations for people who have not signed up remain a launch gap.
- The current `hirers` model is one user per organization record. It cannot
  represent shared organizations, multiple directors/assignors, or membership
  lifecycle/audit requirements.
- `Refee-Web` is a marketing-only Next.js app. `/login` is disabled and no
  authenticated role workflow exists.
- Mobile now has a dedicated assignor route group for proposals, tournaments,
  roster management, staffing, messages, and profile. Referees can act on
  roster invitations and assignment offers; these flows still need device/E2E
  proof and cross-platform parity.
- Web copy currently claims users are vetted/background-checked while the
  mobile project status says Persona/NCSI are placeholders. The claim must be
  removed immediately or the screening feature must be implemented and proven.
- The web `npm run lint` script opens an interactive `next lint` setup prompt;
  it is not a repeatable CI gate and did not produce a lint result.
- Local Supabase integration checks are currently unavailable because the
  Docker daemon is not running. No clean migration reset or RLS suite has been
  proven in this audit.
- The web repository is outside the writable workspace root for this task. It
  can be audited, but implementation requires adding it as a writable project
  root or moving this task to that saved project.

## Open product questions with recommended defaults

1. **What is an organization?** Recommended: a tenant with one owner and many
   members; `director`, `assignor`, and `referee` are scoped membership roles,
   while a user's platform capabilities may span multiple organizations.
2. **Can one person hold multiple roles?** Recommended: yes, with an explicit
   role/organization switcher and least-privilege permissions per context.
3. **Can an assignor create a tournament when hired offline?** Recommended: yes.
   Record the client as an unclaimed organization/contact, require an authority
   attestation, and let the client claim visibility later. Do not imply the
   client approved payment terms until it actually does.
4. **Does “add a referee” bypass consent?** Recommended: no. Adding contact info
   creates a pending invitation; roster membership and every direct game offer
   require the referee to accept.
5. **Which invitation channels launch?** Recommended: email plus SMS. Email is
   cheaper and easier to recover; SMS is important for game-day urgency. Both
   should lead to the same single-use acceptance flow.
6. **Which login methods launch?** Recommended: phone OTP, Google, Apple, and
   email magic link. Do not add Microsoft/Facebook in the one-week release
   without demonstrated demand. Apple remains necessary alongside Google for
   the iOS release posture.
7. **What makes a referee eligible for a roster/game?** Recommended: acceptance,
   active account, required certification/level, non-conflicting schedule, and
   the approved screening state. Availability should warn for direct offers and
   hard-block self-claim; decide whether assignors may override with audit.
8. **Are referees organization members or independent roster contacts?**
   Recommended: call the relationship a roster affiliation unless counsel has
   approved employment-like organization language.
9. **Who owes referee pay if the director's settlement fails?** A written choice
   is required before real-money launch: prefund/escrow is the safer default;
   otherwise define guarantee, dunning, holds, and loss ownership.
10. **What percentage/flat fees and refund rules apply?** Provide one real
    September 20 example so UI, ledger, Stripe, invoices, and support language
    can be tested against the same numbers.
11. **Will identity/background checks be complete at launch?** Recommended: if
    no, remove every vetted/background-checked claim and display a neutral
    `not verified`/`verification pending` state. Never infer verification from
    credentials uploaded by the user.
12. **Can minors referee?** If yes, guardian consent, age gating, data handling,
    payments, communications, and screening require a separate approved policy;
    the safest one-week default is 18+.

## Working order

1. Resolve DEC-01, TRUST-01, and MONEY-01 while engineering starts DATA-01,
   RBAC-01, AUTH-01, and test infrastructure.
2. Make `Refee-Web` writable, then build AUTH-02 and WEB-01 in parallel with the
   organization/invitation backend.
3. Complete the thin vertical slice: organization → invite assignor → invite
   referee → create one game → offer → referee accepts → all roles see it.
4. Add full schedule import, roster staffing, notifications, messaging, and
   payments; expand the same slice into browser/mobile E2E coverage.
5. Rehearse migrations and the actual September 20 tournament on staging,
   deploy web, submit iOS, and operate from the first-tournament runbook.
