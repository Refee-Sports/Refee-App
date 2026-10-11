import { describe, expect, it } from "vitest";
import {
  buildNewGameNotification,
  chunk,
  groupAlertsByUser,
  type AlertJob,
} from "../../../../supabase/functions/_shared/new-game-alerts";

const job = (patch: Partial<AlertJob> = {}): AlertJob => ({
  id: "job-1",
  title: "U14 Rec — Court 2",
  starts_at: "2026-10-10T15:00:00Z", // 10:00 AM in Chicago
  timezone: "America/Chicago",
  pay_per_game: 72,
  distanceMiles: 12,
  ...patch,
});

describe("one new game", () => {
  it("names the game, when, the pay and how far", () => {
    const n = buildNewGameNotification([job()]);
    expect(n.title).toBe("New game near you");
    expect(n.body).toBe("U14 Rec — Court 2 · Sat, Oct 10 · 10:00 AM · $72 · 12 mi");
  });

  it("opens that game when tapped", () => {
    expect(buildNewGameNotification([job()]).data).toEqual({ type: "new_game", jobId: "job-1" });
  });

  it("shows the time at the venue, not in UTC", () => {
    const n = buildNewGameNotification([job({ starts_at: "2026-10-10T23:30:00Z", timezone: "America/New_York" })]);
    expect(n.body).toContain("7:30 PM");
  });

  it("leaves out the pay and the distance when they are not known", () => {
    const n = buildNewGameNotification([job({ pay_per_game: null, distanceMiles: null })]);
    expect(n.body).toBe("U14 Rec — Court 2 · Sat, Oct 10 · 10:00 AM");
  });

  it("keeps a very long title from filling the notification", () => {
    const n = buildNewGameNotification([job({ title: "A".repeat(120) })]);
    expect(n.body.split(" · ")[0].length).toBeLessThanOrEqual(60);
    expect(n.body.split(" · ")[0].endsWith("…")).toBe(true);
  });

  it("falls back to Central time when a game has no time zone", () => {
    const n = buildNewGameNotification([job({ timezone: null })]);
    expect(n.body).toContain("10:00 AM");
  });
});

describe("several new games at once", () => {
  const many = [
    job({ id: "b", starts_at: "2026-10-11T15:00:00Z", pay_per_game: 90, distanceMiles: 20 }),
    job({ id: "a", starts_at: "2026-10-10T15:00:00Z", pay_per_game: 65, distanceMiles: 4 }),
    job({ id: "c", starts_at: "2026-10-12T15:00:00Z", pay_per_game: null, distanceMiles: null }),
  ];

  it("sends one notification, not one per game", () => {
    const n = buildNewGameNotification(many);
    expect(n.title).toBe("3 new games match your preferences");
  });

  it("starts with the earliest game and gives the pay range", () => {
    const n = buildNewGameNotification(many);
    expect(n.body).toBe("First on Sat, Oct 10 · $65–$90 · nearest 4 mi");
  });

  it("opens the feed, since there is no single game to open", () => {
    expect(buildNewGameNotification(many).data).toEqual({ type: "new_games" });
  });

  it("copes with no pay or distance on any of them", () => {
    const n = buildNewGameNotification([job({ pay_per_game: null, distanceMiles: null }), job({ id: "z", pay_per_game: null, distanceMiles: null })]);
    expect(n.body).toBe("First on Sat, Oct 10");
  });
});

describe("grouping alerts by person", () => {
  it("collects each person's games, in the order given", () => {
    const grouped = groupAlertsByUser([
      { userId: "u1", jobId: "late", miles: 5 },
      { userId: "u2", jobId: "late", miles: 9 },
      { userId: "u1", jobId: "early", miles: 7 },
    ]);
    expect([...grouped.keys()].sort()).toEqual(["u1", "u2"]);
    expect(grouped.get("u1")).toEqual([
      { jobId: "late", miles: 5 },
      { jobId: "early", miles: 7 },
    ]);
    expect(grouped.get("u2")).toEqual([{ jobId: "late", miles: 9 }]);
  });
});

describe("chunk", () => {
  it("splits a list into batches no bigger than the limit", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
    expect(chunk([1], 100)).toEqual([[1]]);
  });
});
