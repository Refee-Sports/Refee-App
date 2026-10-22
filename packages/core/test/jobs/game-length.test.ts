import { describe, expect, it } from "vitest";
import { HALF_MINUTES, MAX_HALF_MINUTES, QUARTER_MINUTES, formatGameLength } from "../../src/basketball/options";
import { mapDbJobToDetail, type JobDbRow } from "../../src/jobs/map-db-job";

// A game is 2 halves or 4 quarters; a half is at most 20 minutes. The length
// a referee sees comes from that, never from the time block booked for it.
describe("game length", () => {
  it("reads as periods × minutes", () => {
    expect(formatGameLength("halves", 20)).toBe("2 × 20 MIN HALVES");
    expect(formatGameLength("quarters", 8)).toBe("4 × 8 MIN QUARTERS");
  });

  it("shows a dash when the format or minutes are missing", () => {
    expect(formatGameLength(null, 20)).toBe("—");
    expect(formatGameLength("halves", null)).toBe("—");
  });

  it("offers every half length from 8 to 20 minutes", () => {
    expect(MAX_HALF_MINUTES).toBe(20);
    expect(HALF_MINUTES.map(Number)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(QUARTER_MINUTES.length).toBeGreaterThan(0);
  });

  it("job detail uses the format, not the booked time block", () => {
    const row = {
      id: "j", title: "T", sport_id: "basketball", level: "youth", starts_at: new Date().toISOString(),
      venue_name: "Gym", venue_city: "Washington", venue_state: "DC", pay_per_game: 100, num_games: 1,
      crew_size: 2, status: "open", job_type: "single", duration_minutes: 90, game_format: "halves", period_minutes: 18,
    } as unknown as JobDbRow;
    expect(mapDbJobToDetail(row).gameLength).toBe("2 × 18 MIN HALVES");
    expect(mapDbJobToDetail({ ...row, game_format: null, period_minutes: null }).gameLength).toBe("—");
  });
});
