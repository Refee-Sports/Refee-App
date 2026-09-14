import { describe, expect, it } from "vitest";
import { deletionBlocker, needsRefund, type DeletableGame } from "../../../../supabase/functions/_shared/deletion";

const game = (patch: Partial<DeletableGame> = {}): DeletableGame => ({
  title: "Friars vs Knights",
  status: "open",
  payment_status: "unpaid",
  refunded_amount_cents: 0,
  payment_dispute_status: "none",
  payment_issue_requires_review: false,
  ...patch,
});

describe("deleting a game", () => {
  it("is allowed before any referee accepts, charged or not", () => {
    expect(deletionBlocker(game(), 0)).toBeNull();
    expect(deletionBlocker(game({ payment_status: "prepaid" }), 0)).toBeNull();
    expect(deletionBlocker(game({ payment_status: "failed" }), 0)).toBeNull();
    expect(deletionBlocker(game({ payment_status: "refunded", refunded_amount_cents: 15750 }), 0)).toBeNull();
    expect(deletionBlocker(game({ status: "cancelled" }), 0)).toBeNull();
  });

  it("stops once a referee has accepted, and points to Cancel", () => {
    expect(deletionBlocker(game(), 1)).toBe(
      'A referee has accepted "Friars vs Knights", so it can\'t be deleted. Cancel it instead.'
    );
    expect(deletionBlocker(game({ payment_status: "prepaid" }), 3)).toMatch(/Cancel it instead/);
  });

  it("refuses games that have been played", () => {
    expect(deletionBlocker(game({ status: "completed" }), 0)).toMatch(/Completed games can't be deleted/);
  });

  it("waits out a charge that's in flight", () => {
    expect(deletionBlocker(game({ payment_status: "processing" }), 0)).toMatch(/Try again in a minute/);
  });

  it("refuses when money has moved beyond a refundable booking charge", () => {
    expect(deletionBlocker(game({ payment_status: "paid" }), 0)).toMatch(/already paid out/);
    expect(deletionBlocker(game({ payment_dispute_status: "open" }), 0)).toMatch(/open payment dispute/);
    expect(deletionBlocker(game({ payment_issue_requires_review: true }), 0)).toMatch(/under review/);
  });

  it("puts the accepted-referee reason first, since that's the one to act on", () => {
    expect(deletionBlocker(game({ status: "completed", payment_status: "paid" }), 2)).toMatch(/A referee has accepted/);
  });
});

describe("refunding before a delete", () => {
  it("refunds a booking charge that hasn't been refunded", () => {
    expect(needsRefund({ payment_status: "prepaid", refunded_amount_cents: 0 })).toBe(true);
    expect(needsRefund({ payment_status: "prepaid", refunded_amount_cents: null })).toBe(true);
  });

  it("never refunds twice, and has nothing to refund otherwise", () => {
    expect(needsRefund({ payment_status: "prepaid", refunded_amount_cents: 15750 })).toBe(false);
    for (const status of ["unpaid", "failed", "refunded", "processing", "paid", null]) {
      expect(needsRefund({ payment_status: status, refunded_amount_cents: 0 })).toBe(false);
    }
  });
});
