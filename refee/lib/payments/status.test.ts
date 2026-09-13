import { describe, expect, it } from "vitest";
import { canOfferCrewPayment, paymentNeedsReview } from "./status";

describe("payment review UI guard", () => {
  it("locks payment actions for refund and dispute states", () => {
    expect(paymentNeedsReview("refunded", false)).toBe(true);
    expect(paymentNeedsReview("disputed", false)).toBe(true);
    expect(paymentNeedsReview("paid", true)).toBe(true);
  });

  it("offers payment only for a closed game with unpaid crew and no review lock", () => {
    expect(canOfferCrewPayment({
      isClosed: true,
      paymentStatus: "unpaid",
      reviewRequired: false,
      acceptedCrewCount: 2,
    })).toBe(true);
    expect(canOfferCrewPayment({
      isClosed: true,
      paymentStatus: "refunded",
      reviewRequired: true,
      acceptedCrewCount: 2,
    })).toBe(false);
    expect(canOfferCrewPayment({
      isClosed: true,
      paymentStatus: "disputed",
      reviewRequired: true,
      acceptedCrewCount: 2,
    })).toBe(false);
  });
});
