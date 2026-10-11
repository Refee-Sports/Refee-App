import { describe, expect, it } from "vitest";
import { LEAGUES_WORKED_MAX, cleanLeaguesWorked } from "@refee/core/profile/leagues";

describe("cleanLeaguesWorked", () => {
  it("returns null for empty or whitespace-only input", () => {
    expect(cleanLeaguesWorked("")).toBeNull();
    expect(cleanLeaguesWorked("   \n ")).toBeNull();
  });

  it("trims and collapses runs of whitespace", () => {
    expect(cleanLeaguesWorked("  AAU   Boys,\n YMCA  ")).toBe("AAU Boys, YMCA");
  });

  it("caps the length", () => {
    const out = cleanLeaguesWorked("x".repeat(LEAGUES_WORKED_MAX + 50));
    expect(out).toHaveLength(LEAGUES_WORKED_MAX);
  });
});
