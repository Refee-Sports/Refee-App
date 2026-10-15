import { describe, expect, it } from "vitest";
// Shared core logic; tested here, where CI runs vitest.
import { countdownLabel, newSinceYesterday, summarizeRefereeDashboard } from "@refee/core/referee/dashboard";

const NOW = new Date("2026-10-15T15:00:00Z");

const job = (patch: Record<string, unknown> = {}) => ({
  id: "j1",
  title: "Lions vs Tigers",
  starts_at: "2026-10-10T17:00:00Z",
  timezone: "America/Chicago",
  level: "high_school",
  num_games: 1,
  pay_per_game: 60,
  venue_name: "Main Gym",
  venue_address: "1 South Ave",
  venue_city: "Austin",
  venue_state: "TX",
  arrival_notes: "Side door",
  ...patch,
});

const a = (patch: Record<string, unknown> = {}) => ({
  status: "completed",
  amount_due: 60,
  payout_status: "paid",
  application_outcome: null,
  jobs: job(),
  ...patch,
});

describe("summarizeRefereeDashboard: money", () => {
  it("splits paid from owed, for this month and this year", () => {
    const d = summarizeRefereeDashboard({
      assignments: [
        a(),
        a({ payout_status: "pending", amount_due: 50 }),
        a({ jobs: job({ starts_at: "2026-03-01T17:00:00Z" }), amount_due: 40 }),
        a({ status: "cancelled", amount_due: 30, payout_status: "pending" }),
        a({ status: "cancelled", amount_due: 0 }),
        a({ status: "accepted", jobs: job({ starts_at: "2026-10-20T17:00:00Z" }) }),
      ],
      ratings: [],
      now: NOW,
    });
    expect(d.money.month).toEqual({ paid: 60, owed: 80 });
    expect(d.money.year).toEqual({ paid: 100, owed: 80 });
  });
});

describe("summarizeRefereeDashboard: games by level", () => {
  it("counts games worked, most first, and ignores fees and upcoming games", () => {
    const d = summarizeRefereeDashboard({
      assignments: [
        a(),
        a({ jobs: job({ level: "youth_rec" }) }),
        a({ jobs: job({ level: "youth_rec", num_games: 2 }) }),
        a({ status: "cancelled", amount_due: 30 }),
        a({ status: "accepted" }),
        a({ jobs: job({ starts_at: "2026-02-01T17:00:00Z", level: "adult" }) }),
      ],
      ratings: [],
      now: NOW,
    });
    expect(d.gamesByLevel.month).toEqual([
      { level: "youth_rec", games: 3 },
      { level: "high_school", games: 1 },
    ]);
    expect(d.gamesByLevel.year).toEqual([
      { level: "youth_rec", games: 3 },
      { level: "high_school", games: 1 },
      { level: "adult", games: 1 },
    ]);
  });
});

describe("summarizeRefereeDashboard: approval rate", () => {
  it("counts only organizers' decisions", () => {
    const outcomes = ["approved", "approved", "approved", "declined", "withdrawn", "closed", null];
    const d = summarizeRefereeDashboard({
      assignments: outcomes.map((o) => a({ application_outcome: o })),
      ratings: [],
      now: NOW,
    });
    expect(d.approval).toEqual({ approved: 3, decided: 4, rate: 75 });
  });

  it("waits for 3 decisions before showing a rate", () => {
    const d = summarizeRefereeDashboard({
      assignments: [a({ application_outcome: "approved" }), a({ application_outcome: "declined" })],
      ratings: [],
      now: NOW,
    });
    expect(d.approval.rate).toBeNull();
  });
});

describe("summarizeRefereeDashboard: rating trend", () => {
  const rating = (overall: number, day: number) => ({ overall, ratedAt: new Date(Date.UTC(2026, 8, day)).toISOString() });

  it("averages the last 10 ratings and the 10 before them", () => {
    const ratings = [
      ...Array.from({ length: 10 }, (_, i) => rating(5, 20 + i)),
      ...Array.from({ length: 10 }, (_, i) => rating(4, 1 + i)),
    ];
    expect(summarizeRefereeDashboard({ assignments: [], ratings, now: NOW }).rating).toEqual({
      recent: 5,
      recentCount: 10,
      previous: 4,
    });
  });

  it("has no previous figure until there are more than 10", () => {
    const d = summarizeRefereeDashboard({ assignments: [], ratings: [rating(4, 1), rating(5, 2)], now: NOW });
    expect(d.rating).toEqual({ recent: 4.5, recentCount: 2, previous: null });
    expect(summarizeRefereeDashboard({ assignments: [], ratings: [], now: NOW }).rating).toBeNull();
  });
});

describe("summarizeRefereeDashboard: next game", () => {
  it("is the soonest confirmed game that hasn't started", () => {
    const d = summarizeRefereeDashboard({
      assignments: [
        a({ status: "accepted", jobs: job({ id: "later", starts_at: "2026-10-20T17:00:00Z" }) }),
        a({ status: "needs_reconfirm", jobs: job({ id: "soon", starts_at: "2026-10-16T17:00:00Z" }) }),
        a({ status: "pending", jobs: job({ id: "applied", starts_at: "2026-10-15T18:00:00Z" }) }),
        a({ status: "accepted", jobs: job({ id: "started", starts_at: "2026-10-15T14:00:00Z" }) }),
      ],
      ratings: [],
      now: NOW,
    });
    expect(d.nextGame).toMatchObject({ jobId: "soon", needsReconfirm: true, arrivalNotes: "Side door" });
  });
});

describe("countdownLabel", () => {
  it("reads naturally at every distance", () => {
    const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();
    expect(countdownLabel(at(3 * 86_400_000 + 3_600_000), NOW)).toBe("in 3 days");
    expect(countdownLabel(at(30 * 3_600_000), NOW)).toBe("tomorrow");
    expect(countdownLabel(at(5 * 3_600_000 + 60_000), NOW)).toBe("in 5 hours");
    expect(countdownLabel(at(3_600_000 + 60_000), NOW)).toBe("in 1 hour");
    expect(countdownLabel(at(40 * 60_000), NOW)).toBe("in 40 min");
    expect(countdownLabel(at(-60_000), NOW)).toBe("now");
  });
});

describe("newSinceYesterday", () => {
  it("counts games posted in the last 24 hours", () => {
    const rows = [
      { postedAtIso: "2026-10-15T10:00:00Z" },
      { postedAtIso: "2026-10-14T16:00:00Z" },
      { postedAtIso: "2026-10-13T10:00:00Z" },
      { postedAtIso: null },
    ];
    expect(newSinceYesterday(rows, NOW)).toBe(2);
  });
});
