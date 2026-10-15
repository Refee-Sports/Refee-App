import { describe, expect, it } from "vitest";
import { PLATFORM_FEE_PCT as APP_FEE, summarizeDirectorDashboard, waitingLabel } from "@refee/core/director/dashboard";
import { PLATFORM_FEE_PCT as SERVER_FEE } from "../../../../supabase/functions/_shared/pay-math";
import type { DirectorGameRow } from "@refee/core/director/queries";

const NOW = new Date("2026-10-15T15:00:00Z");
const DAY = 86_400_000;

const game = (patch: Partial<DirectorGameRow> & Record<string, unknown>) =>
  ({
    id: "g1",
    title: "Lions vs Tigers",
    status: "open",
    crew_size: 2,
    pay_per_game: 60,
    starts_at: new Date(NOW.getTime() + 3 * DAY).toISOString(),
    timezone: "America/Chicago",
    tournament_id: null,
    tournaments: null,
    payment_status: "unpaid",
    prepaid_crew_cents: 0,
    prepaid_fee_cents: 0,
    refunded_amount_cents: 0,
    confirmedCount: 0,
    ...patch,
  }) as unknown as DirectorGameRow;

describe("the app shows the same fee the server charges", () => {
  it("matches pay-math", () => {
    expect(APP_FEE).toBe(SERVER_FEE);
  });
});

describe("coverage", () => {
  it("lists upcoming games still short of referees, the next 7 days first", () => {
    const d = summarizeDirectorDashboard(
      [
        game({ id: "full", confirmedCount: 2 }),
        game({ id: "later", starts_at: new Date(NOW.getTime() + 10 * DAY).toISOString(), confirmedCount: 0 }),
        game({ id: "soon", starts_at: new Date(NOW.getTime() + 2 * DAY).toISOString(), confirmedCount: 1 }),
        game({ id: "past", starts_at: new Date(NOW.getTime() - DAY).toISOString() }),
        game({ id: "called-off", status: "cancelled" }),
      ],
      NOW
    );
    expect(d.coverage.upcoming).toBe(3);
    expect(d.coverage.staffed).toBe(1);
    expect(d.coverage.openSlots).toBe(3);
    expect(d.coverage.short.map((g) => [g.gameId, g.urgent, g.confirmed, g.crew])).toEqual([
      ["soon", true, 1, 2],
      ["later", false, 0, 2],
    ]);
    expect(d.coverage.urgentCount).toBe(1);
  });
});

describe("spend", () => {
  it("separates what's been charged from what's still to come, with Refee's fee called out", () => {
    const d = summarizeDirectorDashboard(
      [
        // Charged at booking: $120 crew + $6 fee.
        game({ id: "charged", payment_status: "prepaid", prepaid_crew_cents: 12000, prepaid_fee_cents: 600 }),
        // Not charged yet: 2 × $60 = $120 crew, 5% = $6 fee.
        game({ id: "pending" }),
        // Called off before anyone was charged.
        game({ id: "cancelled", status: "cancelled" }),
      ],
      NOW
    );
    expect(d.spend.month).toEqual({ charged: 126, pending: 126, fee: 12, total: 252 });
  });

  it("takes refunds off what was charged", () => {
    const d = summarizeDirectorDashboard(
      [game({ payment_status: "paid", prepaid_crew_cents: 12000, prepaid_fee_cents: 600, refunded_amount_cents: 6000 })],
      NOW
    );
    expect(d.spend.month.charged).toBe(66);
  });

  it("totals each tournament, biggest first, and leaves single games out of that list", () => {
    const d = summarizeDirectorDashboard(
      [
        game({ id: "a1", tournament_id: "t1", tournaments: { name: "Fall Classic" } }),
        game({ id: "a2", tournament_id: "t1", tournaments: { name: "Fall Classic" } }),
        game({ id: "b1", tournament_id: "t2", tournaments: { name: "Hoops Fest" } }),
        game({ id: "solo" }),
      ],
      NOW
    );
    expect(d.spend.tournaments.map((t) => [t.name, t.total])).toEqual([
      ["Fall Classic", 252],
      ["Hoops Fest", 126],
    ]);
  });

  it("counts this month by when the game is played", () => {
    const d = summarizeDirectorDashboard([game({ starts_at: "2026-11-20T17:00:00Z" })], NOW);
    expect(d.spend.month.total).toBe(0);
  });
});

describe("waitingLabel", () => {
  it("says how long an applicant has waited", () => {
    const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
    expect(waitingLabel(ago(20 * 60_000), NOW)).toBe("waiting 20 min");
    expect(waitingLabel(ago(5 * 3_600_000), NOW)).toBe("waiting 5 hours");
    expect(waitingLabel(ago(3_600_000), NOW)).toBe("waiting 1 hour");
    expect(waitingLabel(ago(3 * DAY), NOW)).toBe("waiting 3 days");
    expect(waitingLabel(ago(DAY + 1000), NOW)).toBe("waiting 1 day");
  });
});
