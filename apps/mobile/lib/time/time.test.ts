import { describe, expect, it } from "vitest";
// Shared core logic; tested here, where CI runs vitest.
import {
  DEFAULT_TIME_ZONE,
  formatDateOnly,
  formatGameDate,
  formatGameTime,
  formatGameTimeWithZone,
  venueDay,
  zoneLabel,
  zoneName,
} from "@refee/core/time";

// ICU puts a narrow no-break space before AM/PM; compare with plain spaces.
const n = (s: string) => s.replace(/\s/g, " ");

describe("venue time zones", () => {
  it("labels the zones Refee serves the same way on every platform", () => {
    expect(zoneLabel("America/New_York")).toBe("ET");
    expect(zoneLabel("America/Chicago")).toBe("CT");
    expect(zoneLabel("America/Denver")).toBe("MT");
    expect(zoneLabel("America/Phoenix")).toBe("MT");
    expect(zoneLabel("America/Los_Angeles")).toBe("PT");
    expect(zoneLabel("America/Anchorage")).toBe("AKT");
    expect(zoneLabel("Pacific/Honolulu")).toBe("HT");
    expect(zoneLabel("America/Puerto_Rico")).toBe("AT");
    expect(zoneName("America/Phoenix")).toBe("Arizona");
    expect(zoneName("America/Puerto_Rico")).toBe("Atlantic");
  });

  it("falls back to Central for rows with no zone", () => {
    expect(DEFAULT_TIME_ZONE).toBe("America/Chicago");
    expect(zoneLabel(null)).toBe("CT");
    expect(zoneLabel(undefined)).toBe("CT");
    expect(zoneLabel("")).toBe("CT");
    expect(n(formatGameTime("2026-09-20T17:30:00Z", null))).toBe("12:30 PM");
  });

  it("uses Intl's abbreviation for a zone outside the table, and never throws on a bad one", () => {
    expect(zoneLabel("Europe/London")).toMatch(/^(GMT|BST)/);
    expect(zoneLabel("Mars/Olympus_Mons")).toBe("Mars/Olympus_Mons");
    expect(zoneName("Europe/London")).toBe("Europe/London");
  });
});

describe("game times at the venue", () => {
  it("shows the same instant as each venue's own wall clock", () => {
    const t = "2026-09-20T17:30:00Z";
    expect(n(formatGameTimeWithZone(t, "America/New_York"))).toBe("1:30 PM ET");
    expect(n(formatGameTimeWithZone(t, "America/Chicago"))).toBe("12:30 PM CT");
    expect(n(formatGameTimeWithZone(t, "America/Los_Angeles"))).toBe("10:30 AM PT");
    expect(n(formatGameTimeWithZone(t, "America/Puerto_Rico"))).toBe("1:30 PM AT");
    expect(n(formatGameTimeWithZone(t, "Pacific/Honolulu"))).toBe("7:30 AM HT");
  });

  it("follows daylight saving where it applies and not where it doesn't", () => {
    // Chicago springs forward at 2 AM on Mar 8, 2026.
    expect(n(formatGameTime("2026-03-08T07:30:00Z", "America/Chicago"))).toBe("1:30 AM");
    expect(n(formatGameTime("2026-03-08T08:30:00Z", "America/Chicago"))).toBe("3:30 AM");
    // Falls back on Nov 1: 1:30 AM happens twice.
    expect(n(formatGameTime("2026-11-01T06:30:00Z", "America/Chicago"))).toBe("1:30 AM");
    expect(n(formatGameTime("2026-11-01T07:30:00Z", "America/Chicago"))).toBe("1:30 AM");
    // Arizona and Puerto Rico keep one offset all year.
    expect(n(formatGameTime("2026-01-15T17:00:00Z", "America/Phoenix"))).toBe("10:00 AM");
    expect(n(formatGameTime("2026-07-15T17:00:00Z", "America/Phoenix"))).toBe("10:00 AM");
    expect(n(formatGameTime("2026-01-15T17:00:00Z", "America/Puerto_Rico"))).toBe("1:00 PM");
    expect(n(formatGameTime("2026-07-15T17:00:00Z", "America/Puerto_Rico"))).toBe("1:00 PM");
  });

  it("puts a late West Coast game on the venue's day, not UTC's", () => {
    const t = "2026-09-21T03:30:00Z"; // 8:30 PM Sep 20 in Los Angeles
    expect(venueDay(t, "America/Los_Angeles")).toBe("2026-09-20");
    expect(venueDay(t, "America/New_York")).toBe("2026-09-20");
    expect(venueDay(t, "America/Puerto_Rico")).toBe("2026-09-20");
    expect(formatGameDate(t, "America/Los_Angeles", { weekday: "short", month: "short", day: "numeric" })).toBe(
      "Sun, Sep 20"
    );
  });
});

describe("date-only values", () => {
  it("shows the stored day everywhere in the Americas", () => {
    expect(formatDateOnly("2026-09-20", { month: "short", day: "numeric" })).toBe("Sep 20");
    expect(formatDateOnly("2026-01-01", { year: "numeric", month: "short", day: "numeric" })).toBe("Jan 1, 2026");
  });

  it("ignores any time part on the value", () => {
    expect(formatDateOnly("2026-09-20T23:59:59-10:00", { month: "short", day: "numeric" })).toBe("Sep 20");
  });

  it("handles leap days", () => {
    expect(formatDateOnly("2028-02-29", { month: "short", day: "numeric" })).toBe("Feb 29");
  });
});
