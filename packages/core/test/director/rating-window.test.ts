import { describe, expect, it } from "vitest";
import { canRateReferee } from "@refee/core/director/game-status";

// A director rates a referee only once the game is over: the game is
// completed, the ref worked it, and its scheduled end has passed — marking a
// game completed at tip-off doesn't open rating early.
const game = { status: "completed", starts_at: "2026-10-21T18:00:00Z", duration_minutes: 90 };
const at = (iso: string) => Date.parse(iso);

describe("canRateReferee", () => {
  it("waits for the scheduled end, even on a completed game", () => {
    expect(canRateReferee(game, "completed", at("2026-10-21T18:30:00Z"))).toBe(false);
    expect(canRateReferee(game, "completed", at("2026-10-21T19:30:00Z"))).toBe(true);
  });
  it("needs the game completed and the ref to have worked it", () => {
    expect(canRateReferee({ ...game, status: "open" }, "completed", at("2026-10-22T00:00:00Z"))).toBe(false);
    expect(canRateReferee(game, "accepted", at("2026-10-22T00:00:00Z"))).toBe(false);
  });
  it("uses a 2-hour block when the length isn't set", () => {
    const g = { ...game, duration_minutes: null };
    expect(canRateReferee(g, "completed", at("2026-10-21T19:59:00Z"))).toBe(false);
    expect(canRateReferee(g, "completed", at("2026-10-21T20:00:00Z"))).toBe(true);
  });
});
