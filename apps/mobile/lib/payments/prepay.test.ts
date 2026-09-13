import { describe, it, expect } from "vitest";
// Pure module shared with the Deno edge functions.
import { prepayQuote, prepaySettlement } from "../../../../supabase/functions/_shared/prepay";

describe("prepayQuote", () => {
  it("charges every crew slot at the posted pay, plus the 5% fee", () => {
    // 3 refs × $85 = $255 crew, fee round(12.75) = $13
    expect(prepayQuote(3, 85)).toEqual({ crewCents: 25500, feeCents: 1300, totalCents: 26800 });
  });

  it("multiplies by the number of games", () => {
    expect(prepayQuote(2, 100, 3)).toEqual({ crewCents: 60000, feeCents: 3000, totalCents: 63000 });
  });

  it("charges nothing for a zero-pay or zero-crew game", () => {
    expect(prepayQuote(0, 85).totalCents).toBe(0);
    expect(prepayQuote(3, 0).totalCents).toBe(0);
  });
});

describe("prepaySettlement", () => {
  const prepaid = { crewCents: 25500, feeCents: 1300 }; // 3 × $85 + $13

  it("refunds nothing when the whole crew worked", () => {
    expect(prepaySettlement(prepaid, 25500)).toEqual({ refundCents: 0, shortfallCents: 0 });
  });

  it("refunds unfilled slots and their share of the fee", () => {
    // 1 of 3 worked: $170 crew back, fee kept on $85 = round(1300/3) = 433¢
    expect(prepaySettlement(prepaid, 8500)).toEqual({
      refundCents: 17000 + (1300 - 433),
      shortfallCents: 0,
    });
  });

  it("refunds everything when nobody is owed (early cancellation)", () => {
    expect(prepaySettlement(prepaid, 0)).toEqual({ refundCents: 26800, shortfallCents: 0 });
  });

  it("keeps a late-cancellation fee and refunds the rest", () => {
    // 2 confirmed refs each owed 50% of $85 = $42.50 → but amount_due is whole
    // dollars in the DB, so 2 × $43 = $86 owed.
    const r = prepaySettlement(prepaid, 8600);
    expect(r.shortfallCents).toBe(0);
    expect(r.refundCents).toBe(25500 - 8600 + (1300 - Math.round((1300 * 8600) / 25500)));
  });

  it("reports a shortfall instead of drawing past the charge", () => {
    expect(prepaySettlement(prepaid, 30000)).toEqual({ refundCents: 0, shortfallCents: 4500 });
  });
});
