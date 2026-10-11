import { describe, expect, it } from "vitest";
import { jobAvailability } from "@refee/core/jobs/availability";

const NOW = new Date("2026-10-10T12:00:00Z");
const base = { status: "open", startsAtIso: "2026-10-12T15:00:00Z", crewSize: 2, confirmedCount: 0 };

describe("whether a game can still be taken", () => {
  it("is available while it is open, upcoming, and has room", () => {
    expect(jobAvailability(base, NOW)).toEqual({ available: true });
    expect(jobAvailability({ ...base, confirmedCount: 1 }, NOW)).toEqual({ available: true });
  });

  it("is full once the confirmed crew reaches the crew size", () => {
    const result = jobAvailability({ ...base, confirmedCount: 2 }, NOW);
    expect(result).toMatchObject({ available: false, reason: "full", message: "This game is already full." });
    expect(jobAvailability({ ...base, confirmedCount: 3 }, NOW)).toMatchObject({ reason: "full" });
  });

  it("is gone when it was cancelled", () => {
    expect(jobAvailability({ ...base, status: "cancelled" }, NOW)).toMatchObject({
      available: false,
      reason: "cancelled",
      message: "This game was cancelled.",
    });
  });

  it("is gone when it is already over", () => {
    expect(jobAvailability({ ...base, status: "completed" }, NOW)).toMatchObject({
      available: false,
      reason: "over",
      message: "This game is already over.",
    });
  });

  it("is gone once it has started", () => {
    expect(jobAvailability({ ...base, startsAtIso: "2026-10-10T11:59:00Z" }, NOW)).toMatchObject({
      available: false,
      reason: "started",
      message: "This game has already started.",
    });
  });

  it("doesn't mind a missing start time or status", () => {
    expect(jobAvailability({ crewSize: 2, confirmedCount: 0 }, NOW)).toEqual({ available: true });
    expect(jobAvailability({ status: null, startsAtIso: null, crewSize: 2, confirmedCount: 0 }, NOW)).toEqual({ available: true });
  });

  it("says why in the most useful order: cancelled, then over, then started, then full", () => {
    const worst = { status: "cancelled", startsAtIso: "2026-10-10T11:00:00Z", crewSize: 1, confirmedCount: 1 };
    expect(jobAvailability(worst, NOW)).toMatchObject({ reason: "cancelled" });
    expect(jobAvailability({ ...worst, status: "completed" }, NOW)).toMatchObject({ reason: "over" });
    expect(jobAvailability({ ...worst, status: "open" }, NOW)).toMatchObject({ reason: "started" });
    expect(jobAvailability({ ...worst, status: "open", startsAtIso: "2026-10-12T15:00:00Z" }, NOW)).toMatchObject({ reason: "full" });
  });
});
