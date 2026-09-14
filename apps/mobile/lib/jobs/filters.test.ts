import { describe, it, expect } from "vitest";
import type { JobListRow } from "./types";
import {
  isThisWeekAtVenue,
  parseDistanceMiles,
  isThisWeekChicago,
  matchesU18Plus,
  applyJobFeedFilters,
  activeRadiusMiles,
  type JobFeedFilterId,
} from "./filters";

/** Minimal valid row; override just the fields a test cares about. */
function row(overrides: Partial<JobListRow> = {}): JobListRow {
  return {
    id: "j1",
    jobId: "JOB#1",
    tab: "available",
    title: "GAME",
    org: "ORG",
    pay: "50",
    payUnit: "/ GAME",
    date: "MON 9/1",
    time: "6:00 AM · 32M",
    crew: "2-PERSON",
    dist: "10 MI",
    tags: [],
    footerCta: "VIEW →",
    footerCtaTone: "muted",
    startsAtIso: "2026-08-12T18:00:00Z",
    payPerGame: 50,
    crewSize: 2,
    level: "youth",
    ageGroup: "U12",
    distanceMiles: 10,
    ...overrides,
  };
}

describe("parseDistanceMiles", () => {
  it("parses integer and decimal miles", () => {
    expect(parseDistanceMiles("25 MI")).toBe(25);
    expect(parseDistanceMiles("3.4 MI")).toBe(3.4);
    expect(parseDistanceMiles("0 MI")).toBe(0);
  });

  it("is case-insensitive and tolerates no space", () => {
    expect(parseDistanceMiles("12mi")).toBe(12);
    expect(parseDistanceMiles("7 mi")).toBe(7);
  });

  it("returns null when there is no distance", () => {
    expect(parseDistanceMiles("—")).toBeNull();
    expect(parseDistanceMiles("")).toBeNull();
  });
});

describe("isThisWeekChicago (Sun–Sat, America/Chicago)", () => {
  // now = Wed 2026-08-12; its week runs Sun 8/9 – Sat 8/15.
  const now = new Date("2026-08-12T18:00:00Z");

  it("includes the same day", () => {
    expect(isThisWeekChicago("2026-08-12T20:00:00Z", now)).toBe(true);
  });

  it("includes Saturday (end of week)", () => {
    expect(isThisWeekChicago("2026-08-15T18:00:00Z", now)).toBe(true);
  });

  it("includes Sunday (start of week)", () => {
    expect(isThisWeekChicago("2026-08-09T18:00:00Z", now)).toBe(true);
  });

  it("excludes the next Sunday (next week)", () => {
    expect(isThisWeekChicago("2026-08-16T18:00:00Z", now)).toBe(false);
  });

  it("excludes the prior Saturday (last week)", () => {
    expect(isThisWeekChicago("2026-08-08T18:00:00Z", now)).toBe(false);
  });
});

describe("matchesU18Plus", () => {
  it("matches adult / high-school / pro-am levels regardless of age group", () => {
    expect(matchesU18Plus(row({ level: "adult", ageGroup: null, tags: [] }))).toBe(true);
    expect(matchesU18Plus(row({ level: "high_school", ageGroup: null, tags: [] }))).toBe(true);
    expect(matchesU18Plus(row({ level: "pro_am", ageGroup: null, tags: [] }))).toBe(true);
  });

  it("matches U18 and older by age group", () => {
    expect(matchesU18Plus(row({ level: "youth", ageGroup: "U18", tags: [] }))).toBe(true);
    expect(matchesU18Plus(row({ level: "youth", ageGroup: "U19", tags: [] }))).toBe(true);
    expect(matchesU18Plus(row({ level: "youth", ageGroup: "HS", tags: [] }))).toBe(true);
  });

  it("rejects under-18 age groups", () => {
    expect(matchesU18Plus(row({ level: "youth", ageGroup: "U12", tags: [] }))).toBe(false);
    expect(matchesU18Plus(row({ level: "youth", ageGroup: "U17", tags: [] }))).toBe(false);
  });

  it("falls back to tags when age group is absent", () => {
    expect(matchesU18Plus(row({ level: "youth", ageGroup: null, tags: ["U18"] }))).toBe(true);
    expect(matchesU18Plus(row({ level: "youth", ageGroup: null, tags: ["U14"] }))).toBe(false);
  });
});

describe("applyJobFeedFilters", () => {
  const active = (...ids: JobFeedFilterId[]) => new Set<JobFeedFilterId>(ids);

  it("returns all rows when no filter is active", () => {
    const rows = [row(), row({ id: "j2" })];
    expect(applyJobFeedFilters(rows, active())).toHaveLength(2);
  });

  it("radius_25 keeps rows within 25mi and drops farther ones", () => {
    const rows = [
      row({ id: "near", distanceMiles: 10 }),
      row({ id: "edge", distanceMiles: 25 }),
      row({ id: "far", distanceMiles: 40 }),
    ];
    const kept = applyJobFeedFilters(rows, active("radius_25")).map((r) => r.id);
    expect(kept).toEqual(["near", "edge"]);
  });

  it("radius_25 keeps rows with unknown distance (null passes through)", () => {
    const rows = [row({ id: "unknown", distanceMiles: null })];
    expect(applyJobFeedFilters(rows, active("radius_25"))).toHaveLength(1);
  });

  it("pay_100 keeps only rows paying at least $100", () => {
    const rows = [row({ id: "lo", payPerGame: 99 }), row({ id: "hi", payPerGame: 100 })];
    const kept = applyJobFeedFilters(rows, active("pay_100")).map((r) => r.id);
    expect(kept).toEqual(["hi"]);
  });

  it("crew_3 keeps only 3+ person crews", () => {
    const rows = [row({ id: "two", crewSize: 2 }), row({ id: "three", crewSize: 3 })];
    const kept = applyJobFeedFilters(rows, active("crew_3")).map((r) => r.id);
    expect(kept).toEqual(["three"]);
  });

  it("ANDs multiple active filters (a row must satisfy all)", () => {
    const rows = [
      row({ id: "match", payPerGame: 120, crewSize: 3 }),
      row({ id: "cheap", payPerGame: 80, crewSize: 3 }),
      row({ id: "small", payPerGame: 120, crewSize: 2 }),
    ];
    const kept = applyJobFeedFilters(rows, active("pay_100", "crew_3")).map((r) => r.id);
    expect(kept).toEqual(["match"]);
  });
});

describe("activeRadiusMiles", () => {
  it("returns 25 when the radius filter is on", () => {
    expect(activeRadiusMiles(new Set<JobFeedFilterId>(["radius_25"]))).toBe(25);
  });

  it("returns null when the radius filter is off", () => {
    expect(activeRadiusMiles(new Set<JobFeedFilterId>(["pay_100"]))).toBeNull();
    expect(activeRadiusMiles(new Set<JobFeedFilterId>())).toBeNull();
  });
});

describe("isThisWeekAtVenue", () => {
  it("uses the venue's calendar week, not Central's", () => {
    const now = new Date("2026-09-19T18:00:00Z"); // Saturday Sep 19 in every US zone
    const lateSaturdayLA = "2026-09-20T06:30:00Z"; // Sat 11:30 PM PT = Sun 1:30 AM CT
    expect(isThisWeekAtVenue(lateSaturdayLA, "America/Los_Angeles", now)).toBe(true);
    expect(isThisWeekChicago(lateSaturdayLA, now)).toBe(false);
  });
});
