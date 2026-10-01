# ADR 0002: Assignor modes and who pays whom

- **Status:** Approved
- **Date:** October 1, 2026
- **Decision owner:** Product owner
- **Resolves:** DEC-01, TOURN-01, TOURN-02, MONEY-01 (assignor fee) in `PRODUCTION_LAUNCH_BACKLOG.md`

## Context

Assignors use Refee in three ways, and all three ship at launch (October 2026):

| | Use case | Who owns the tournament | Who pays refs | Who pays the assignor |
|---|---|---|---|---|
| **A** | Assignor runs games for a client who isn't on Refee — Refee is their assigning tool | the assignor | **the assignor, through Refee** | (their client, outside Refee) |
| **B** | A director on Refee hires an assignor to staff their tournament | the director | the director, through Refee | **the director, through Refee** (flat or %) |
| **C** | One person assigns some days and referees other days | — | — | — |

## Decisions

1. **The payer is always a hirer.** Booking charges and payouts already run against
   `hirers` (`hirer_billing.stripe_customer_id`). In case A the assignor gets their
   own hirer row (their assigning business) and saves a card, so
   `chargeGameUpFront` / `settlePrepaidGame` work unchanged. The tournament records
   the offline client's name for display; the client never has an account.
2. **The assignor fee is collected by Refee and paid out by Refee** (case B). It is
   part of the booking charge and is transferred to the assignor's Stripe Connect
   account, the same way crew pay is. Payout accounts belong to the person
   (`private_profiles.stripe_account_id`), so an assignor who already referees is
   already set up.
3. **An assignor may assign themselves**, with no extra approval (case C). The
   roster requirement is skipped for self-assignment; the referee role, identity
   and background-check gates still apply.
4. **Taking on the director or assignor role runs that role's setup.** Adding a role
   without its records (e.g. director without a hirer row) leaves the person on
   screens that can't work. The role switcher routes to the setup instead of only
   inserting into `user_roles`.

## Build order

1. **C** — role setup fix + self-assignment. Smallest, unblocks dual-role testers.
2. **B** — assignor fee in the quote and the settlement (pure maths first, with tests),
   assignor payout onboarding prompt, fee shown on the agreement and statements.
3. **A** — assignor business (hirer row + card), "create tournament for a client"
   on mobile and web, client name on tournament and game screens.

Each step: pgTAP tests for the RLS/RPC changes and Vitest tests for the maths,
written before the code; full suite green before commit.

## Money details (decided October 1, 2026)

- **Platform fee applies to crew pay only.** The director pays crew + 5% of crew +
  the assignor fee; the assignor receives the whole agreed fee.
- **Percentage fee:** that percentage of the crew pay actually earned on each game,
  charged with the game and settled with it (unearned share refunded, like crew pay).
- **Flat fee:** spread across the tournament's games — flat fee ÷ number of games is
  added to each game's booking charge and paid to the assignor when that game
  settles. A cancelled game refunds its share. Rounding remainder lands on the last
  game so the total is exact.
