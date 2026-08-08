# REFEE — Testing

**Status as of July 8, 2026:** No automated tests exist (no framework, no test files, no `test` script). All verification so far has been manual + `tsc --noEmit`. This doc holds (1) the manual test reminders and (2) the recommended automated-test plan.

---

## 🔔 REMINDER: Push notifications need a physical-device test

Push **cannot** be verified in Expo Go (SDK 53+) or the simulator — the code no-ops there by design. It must be tested on a real phone via an **EAS dev build**.

**When:** before relying on push for any launch-critical flow.

**Steps:**
1. `eas build --profile development --platform ios` (or `android`) — needs an Expo account + EAS CLI (`npm i -g eas-cli`, `eas login`).
2. Install the dev build on a physical device.
3. Ensure an EAS `projectId` exists in `app.json`/`app.config` (the token code reads `expoConfig.extra.eas.projectId`). If missing, `eas build` adds it.
4. Sign in → accept the OS notification permission prompt → confirm a row appears in the `push_tokens` table.
5. Trigger each wired notification and confirm a banner arrives:
   - **Accepted:** as a director, approve a pending ref → that ref's device should buzz.
   - **Re-confirm:** edit a confirmed game's time/venue/pay → confirmed refs notified.
   - **New message:** send a crew/DM message → other participants notified.
6. Background the app and repeat (foreground vs background delivery differ).

**Not yet wired (build later):** availability-matched new-game alerts, payment-received push. And before production, move push sends from client-invoked `send-push` to DB triggers so a client can't notify arbitrary users.

---

## Automated tests — recommended plan (not yet built)

Priority order by risk × value. Start with pure logic (fast, no device/DB needed).

### Tier 1 — pure functions (unit, Jest/Vitest)
- **Earnings math** (`lib/referee/queries.ts`, `lib/home/queries.ts`): period bucketing (week/month/year), pending vs earned, cancellation-fee inclusion.
- **Schedule-conflict guard** (`findScheduleConflict` in `lib/jobs/queries.ts`): overlapping windows, back-to-back edges, default-duration handling.
- **Distance filter** (`distanceMiles` in `lib/geo/geocode.ts`): known city pairs within tolerance.
- **Platform fee** (`PLATFORM_FEE_PCT` usage): 5% rounding on odd totals.
- **Availability bitmask** (`dayBit`/`daysLabel`, `snapRadius`).

### Tier 2 — edge function logic (integration)
- `pay-crew` / `auto-pay`: correct crew total + fee, `processing` lock prevents double-charge, declined-card rollback.
- `withdraw_from_job` RPC: late-flag threshold, slot reopen, RLS (ref can't reopen others' jobs).
- `sweep_game_lifecycle`: only completes games >24h past end; locks pay.
- Use Stripe test mode + a local Supabase instance.

### Tier 3 — critical flows (E2E, later)
- Accept → complete → auto-pay → payout.
- Director edit → ref re-confirm.
- Feed filtering end-to-end (state fallback + radius).
Tooling: Detox or Maestro once flows stabilize.

### Suggested setup
```
npm i -D jest @types/jest ts-jest        # or vitest
```
Add `"test": "jest"` to package.json. Put Tier-1 specs next to the code as `*.test.ts`. This is the highest-leverage first step — the earnings and conflict logic are where a silent bug costs real money.
