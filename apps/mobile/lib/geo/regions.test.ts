import { describe, expect, it } from "vitest";
import { isServiceRegion, REGION_CODE_ERROR, US_REGIONS, US_STATES } from "@refee/core/geo/regions";

describe("service regions", () => {
  it("covers the 50 states, DC and Puerto Rico — 52 in all, no duplicates", () => {
    expect(US_REGIONS).toHaveLength(52);
    expect(new Set(US_STATES).size).toBe(52);
    expect(new Set(US_REGIONS.map((r) => r.name)).size).toBe(52);
    expect(US_STATES).toEqual(expect.arrayContaining(["DC", "PR", "AK", "HI", "NY", "TX"]));
  });

  it("uses two-letter uppercase codes only", () => {
    for (const code of US_STATES) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it("leaves out territories Refee doesn't serve", () => {
    for (const code of ["GU", "VI", "AS", "MP", "UM", "AA", "AE", "AP"]) expect(isServiceRegion(code)).toBe(false);
  });

  it("accepts any case and stray spaces", () => {
    expect(isServiceRegion("ny")).toBe(true);
    expect(isServiceRegion(" dc ")).toBe(true);
    expect(isServiceRegion("Pr")).toBe(true);
  });

  it("rejects names, partial codes and blanks", () => {
    for (const bad of ["", " ", "N", "NYC", "New York", "Texas", "T X"]) expect(isServiceRegion(bad)).toBe(false);
  });

  it("tells people DC and PR are allowed", () => {
    expect(REGION_CODE_ERROR).toMatch(/DC and PR/);
  });
});
