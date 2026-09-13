import { describe, expect, it } from "vitest";
import {
  reconciliationAction,
  closedDisputeStatus,
  refundStatus,
  transferIdempotencyKey,
} from "../../supabase/functions/_shared/stripe-events";

describe("Stripe webhook reconciliation", () => {
  it("routes successful and failed PaymentIntents", () => {
    expect(reconciliationAction("payment_intent.succeeded")).toBe("settle_payment");
    expect(reconciliationAction("payment_intent.payment_failed")).toBe("mark_payment_failed");
  });

  it("routes transfer lifecycle events", () => {
    expect(reconciliationAction("transfer.created")).toBe("mark_transfer_paid");
    expect(reconciliationAction("transfer.updated")).toBe("mark_transfer_paid");
    expect(reconciliationAction("transfer.reversed")).toBe("mark_transfer_reversed");
  });

  it("routes refund and dispute lifecycle events", () => {
    expect(reconciliationAction("charge.refunded")).toBe("mark_charge_refunded");
    expect(reconciliationAction("charge.dispute.created")).toBe("mark_dispute_opened");
    expect(reconciliationAction("charge.dispute.closed")).toBe("mark_dispute_closed");
  });

  it("classifies partial/full refunds and closed disputes", () => {
    expect(refundStatus(10_000, 2_500)).toBe("partial");
    expect(refundStatus(10_000, 10_000)).toBe("full");
    expect(closedDisputeStatus("won")).toBe("won");
    expect(closedDisputeStatus("lost")).toBe("lost");
  });

  it("ignores unrelated Stripe events safely", () => {
    expect(reconciliationAction("customer.updated")).toBe("ignore");
  });

  it("uses a stable per-assignment/per-charge transfer key", () => {
    expect(transferIdempotencyKey("assignment-1", "pi_123")).toBe(
      "refee-transfer-assignment-1-pi_123"
    );
    expect(transferIdempotencyKey("assignment-1", "pi_123")).toBe(
      transferIdempotencyKey("assignment-1", "pi_123")
    );
    expect(transferIdempotencyKey("assignment-2", "pi_123")).not.toBe(
      transferIdempotencyKey("assignment-1", "pi_123")
    );
  });
});
