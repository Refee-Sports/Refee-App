import { describe, expect, it } from "vitest";
import { showRate } from "@refee/core/referee/reliability";

describe("showRate", () => {
  it("is the share of confirmed games the referee kept", () => {
    expect(showRate({ kept: 18, late_withdrawals: 1, no_shows: 1 })).toEqual({
      rate: 90,
      label: "90% show rate",
      detail: "1 late drop-out · 1 no-show in the last year",
    });
  });

  it("reads as a clean record when nothing went wrong", () => {
    expect(showRate({ kept: 12, late_withdrawals: 0, no_shows: 0 })).toEqual({
      rate: 100,
      label: "100% show rate",
      detail: "Kept every game in the last year",
    });
  });

  it("doesn't judge a referee on fewer than 3 games", () => {
    expect(showRate({ kept: 1, late_withdrawals: 1, no_shows: 0 })).toEqual({
      rate: null,
      label: "New referee",
      detail: "Fewer than 3 games in the last year",
    });
    expect(showRate(null).rate).toBeNull();
  });

  it("pluralizes and rounds down so a lapse is never hidden", () => {
    expect(showRate({ kept: 197, late_withdrawals: 2, no_shows: 0 })).toMatchObject({
      rate: 98,
      detail: "2 late drop-outs in the last year",
    });
    expect(showRate({ kept: 0, late_withdrawals: 0, no_shows: 3 }).detail).toBe("3 no-shows in the last year");
  });
});
