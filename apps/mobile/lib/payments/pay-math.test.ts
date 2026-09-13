import { describe, it, expect } from "vitest";
// Pure module shared with the Deno edge functions (imported there with a .ts
// extension). No runtime deps, so it imports cleanly in Node too.
import {
  PLATFORM_FEE_PCT,
  platformFee,
  chargeTotal,
  decidePayment,
} from "../../../../supabase/functions/_shared/pay-math";

describe("platformFee", () => {
  it("is 5% of crew total, rounded to whole dollars", () => {
    expect(PLATFORM_FEE_PCT).toBe(0.05);
    expect(platformFee(35)).toBe(2); // round(1.75) = 2
    expect(platformFee(100)).toBe(5);
    expect(platformFee(0)).toBe(0);
  });

  it("rounds half up", () => {
    expect(platformFee(30)).toBe(2); // round(1.5) = 2
    expect(platformFee(29)).toBe(1); // round(1.45) = 1
  });
});

describe("chargeTotal", () => {
  it("is crew pay plus the platform fee", () => {
    expect(chargeTotal(35)).toBe(37); // 35 + 2  (matches the $37 Stripe charge)
    expect(chargeTotal(100)).toBe(105);
    expect(chargeTotal(0)).toBe(0);
  });

  it("never deducts the platform fee from the referee (fee is the director's add-on)", () => {
    // The ref is owed the full crew amount; chargeTotal only ADDS the fee on top.
    const crew = 40;
    expect(chargeTotal(crew) - crew).toBe(platformFee(crew));
  });

  // Documents the thin-margin problem on small games (see LAUNCH_CHECKLIST.md).
  // Stripe's real cost is ~2.9% + $0.30; our fee here is only the platform take,
  // so these pin how little headroom is left before Stripe's cut.
  it("leaves very thin platform headroom on small games", () => {
    expect(chargeTotal(20)).toBe(21); // fee $1 — barely covers Stripe on a $21 charge
    expect(chargeTotal(15)).toBe(16); // fee $1 (round(0.75)=1)
    expect(chargeTotal(10)).toBe(11); // fee $1 (round(0.5)=1) — near break-even vs Stripe
    expect(chargeTotal(5)).toBe(5); // fee $0 (round(0.25)=0) — platform LOSES money after Stripe
  });
});

describe("decidePayment — idempotency guard against double-charge", () => {
  it("charges when no successful charge exists yet, and resets on failure to allow retry", () => {
    expect(decidePayment(false)).toEqual({ shouldCharge: true, resetToUnpaidOnError: true });
  });

  it("never re-charges once a charge has succeeded; stays 'processing' on transfer failure", () => {
    // This is the core fix: a charge succeeded but the transfer failed. We must
    // NOT charge again and must NOT reset to 'unpaid' (which would re-charge).
    expect(decidePayment(true)).toEqual({ shouldCharge: false, resetToUnpaidOnError: false });
  });
});
