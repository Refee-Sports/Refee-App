import { describe, expect, it } from "vitest";
// Shared core logic; tested here, where CI runs vitest.
import { ledgerTotals, payoutLabel, toLedgerRows } from "@refee/core/referee/queries";

const job = (patch: Record<string, unknown> = {}) => ({
  id: "j1",
  title: "Lions vs Tigers",
  starts_at: "2026-10-04T17:00:00Z",
  timezone: "America/New_York",
  pay_per_game: 60,
  hirers: { org_name: "Metro Hoops" },
  ...patch,
});

const row = (patch: Record<string, unknown> = {}) => ({
  id: "a1",
  status: "completed",
  amount_due: null,
  payout_status: "pending",
  paid_at: null,
  jobs: job(),
  ...patch,
});

describe("toLedgerRows", () => {
  it("lists each worked game with what it paid and where the money stands", () => {
    expect(toLedgerRows([row({ amount_due: 65, payout_status: "paid", paid_at: "2026-10-05T12:00:00Z" })])).toEqual([
      {
        assignmentId: "a1",
        jobId: "j1",
        title: "Lions vs Tigers",
        orgName: "Metro Hoops",
        startsAt: "2026-10-04T17:00:00Z",
        timeZone: "America/New_York",
        kind: "game",
        amount: 65,
        payout: "paid",
        paidAt: "2026-10-05T12:00:00Z",
      },
    ]);
  });

  it("falls back to the game's posted pay when no amount was locked in", () => {
    expect(toLedgerRows([row()])[0].amount).toBe(60);
  });

  it("includes a late-cancellation fee, but not a cancelled game that owed nothing", () => {
    const rows = toLedgerRows([
      row({ id: "fee", status: "cancelled", amount_due: 30 }),
      row({ id: "nothing", status: "cancelled", amount_due: 0 }),
      row({ id: "upcoming", status: "accepted" }),
    ]);
    expect(rows.map((r) => [r.assignmentId, r.kind, r.amount])).toEqual([["fee", "late_cancel", 30]]);
  });

  it("puts the newest game first and treats an unknown payout state as owed", () => {
    const rows = toLedgerRows([
      row({ id: "old", jobs: job({ starts_at: "2026-09-01T17:00:00Z" }), payout_status: null }),
      row({ id: "new", jobs: job({ starts_at: "2026-10-10T17:00:00Z" }) }),
    ]);
    expect(rows.map((r) => r.assignmentId)).toEqual(["new", "old"]);
    expect(rows[1].payout).toBe("pending");
  });
});

describe("ledgerTotals", () => {
  it("splits paid money from money still owed", () => {
    const rows = toLedgerRows([
      row({ id: "p", amount_due: 60, payout_status: "paid" }),
      row({ id: "s", amount_due: 50, payout_status: "processing" }),
      row({ id: "o", amount_due: 40, payout_status: "pending" }),
      row({ id: "f", amount_due: 30, payout_status: "failed" }),
    ]);
    expect(ledgerTotals(rows)).toEqual({ paid: 60, owed: 120, games: 4 });
  });

  it("doesn't count a fee as a game worked", () => {
    const rows = toLedgerRows([row({ status: "cancelled", amount_due: 30, payout_status: "paid" })]);
    expect(ledgerTotals(rows)).toEqual({ paid: 30, owed: 0, games: 0 });
  });
});

describe("payoutLabel", () => {
  it("says when it was paid, in plain words", () => {
    const [paid] = toLedgerRows([row({ payout_status: "paid", paid_at: "2026-10-05T12:00:00Z" })]);
    expect(payoutLabel(paid)).toBe("Paid Oct 5");
    const [sending] = toLedgerRows([row({ payout_status: "processing" })]);
    expect(payoutLabel(sending)).toBe("Sending to your Stripe account");
    const [owed] = toLedgerRows([row()]);
    expect(payoutLabel(owed)).toBe("Owed · paid within 48 hours of the game");
    const [failed] = toLedgerRows([row({ payout_status: "failed" })]);
    expect(payoutLabel(failed)).toBe("Payment failed · Refee is fixing it");
  });
});
