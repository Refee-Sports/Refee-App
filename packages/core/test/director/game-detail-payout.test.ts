import { describe, expect, it, vi } from "vitest";
import { configureSupabase } from "@refee/core/client";

// The game screen and the payment-issues list must agree on whether the crew
// was paid. Both read each ref's own payout_status; the game-level
// payment_status only says the director's card was charged.
const row = {
  id: "job-1",
  status: "completed",
  payment_status: "paid",
  starts_at: "2026-10-16T15:00:00Z",
  completed_at: "2026-10-16T17:00:00Z",
  duration_minutes: 90,
  payout_window_hours: 48,
  timezone: "America/New_York",
  job_assignments: [
    { status: "completed", payout_status: "paid" },
    { status: "completed", payout_status: "pending" },
    { status: "declined", payout_status: null },
  ],
};
const maybeSingle = vi.fn(async () => ({ data: row, error: null }));
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
configureSupabase({ from: vi.fn(() => ({ select })) } as never);

import { fetchGameById } from "@refee/core/director/queries";
import { payoutDisplay } from "@refee/core/director/game-status";

describe("game detail payout", () => {
  it("loads each worked ref's payout, not just the game's charge", async () => {
    const { game } = await fetchGameById("job-1");
    expect(select).toHaveBeenCalledWith(expect.stringContaining("job_assignments(status, payout_status)"));
    expect(game?.refPayouts).toEqual(["paid", "pending"]);
  });

  it("a charged game with a ref still unpaid is not 'crew paid'", async () => {
    const { game } = await fetchGameById("job-1");
    const now = new Date("2026-10-22T12:00:00Z").getTime();
    expect(payoutDisplay(game!, now).tone).toBe("overdue");
  });
});
