import { describe, it, expect } from "vitest";
import type { FeedTab, JobListRow } from "./types";
import { resolveTabRows, resolveCounts } from "./feed-source";

function row(id: string, tab: FeedTab): JobListRow {
  return {
    id,
    jobId: `JOB#${id}`,
    tab,
    title: id,
    org: "ORG",
    pay: "50",
    payUnit: "/ GAME",
    date: "MON 9/1",
    time: "6:00 AM",
    crew: "2-PERSON",
    dist: "—",
    tags: [],
    footerCta: "VIEW →",
    footerCtaTone: "muted",
    startsAtIso: "2026-09-01T00:00:00Z",
    payPerGame: 50,
    crewSize: 2,
    level: "youth",
    ageGroup: null,
    distanceMiles: null,
  };
}

const mockRows = [
  row("mock-a", "available"),
  row("mock-b", "available"),
  row("mock-inv", "invited"),
  row("mock-sav", "saved"),
];

describe("resolveTabRows — mock data is offline-only", () => {
  it("when configured, available shows real DB rows exactly (no mock)", () => {
    const db = [row("real-1", "available")];
    const out = resolveTabRows({ configured: true, tab: "available", dbAvailable: db, dbInvited: [], mockRows });
    expect(out.map((r) => r.id)).toEqual(["real-1"]);
  });

  it("when configured and DB is empty, available is EMPTY (never falls back to mock)", () => {
    const out = resolveTabRows({ configured: true, tab: "available", dbAvailable: [], dbInvited: [], mockRows });
    expect(out).toEqual([]);
  });

  it("when configured, invited uses real offers and saved stays empty", () => {
    const offer = row("offer-1", "invited");
    expect(resolveTabRows({ configured: true, tab: "invited", dbAvailable: [], dbInvited: [offer], mockRows })).toEqual([offer]);
    expect(resolveTabRows({ configured: true, tab: "saved", dbAvailable: [], dbInvited: [offer], mockRows })).toEqual([]);
  });

  it("when NOT configured, falls back to the mock demo list per tab", () => {
    expect(
      resolveTabRows({ configured: false, tab: "available", dbAvailable: [], dbInvited: [], mockRows }).map((r) => r.id)
    ).toEqual(["mock-a", "mock-b"]);
    expect(
      resolveTabRows({ configured: false, tab: "invited", dbAvailable: [], dbInvited: [], mockRows }).map((r) => r.id)
    ).toEqual(["mock-inv"]);
  });
});

describe("resolveCounts", () => {
  it("when configured, available and invited counts come from their DB rows", () => {
    const db = [row("r1", "available"), row("r2", "available")];
    const invited = [row("offer-1", "invited")];
    expect(resolveCounts({ configured: true, dbAvailable: db, dbInvited: invited, mockRows })).toEqual({
      available: 2,
      invited: 1,
      saved: 0,
    });
  });

  it("when configured with an empty DB, available count is zero (not the mock count)", () => {
    expect(resolveCounts({ configured: true, dbAvailable: [], dbInvited: [], mockRows })).toEqual({
      available: 0,
      invited: 0,
      saved: 0,
    });
  });

  it("when NOT configured, counts come from the mock demo list", () => {
    expect(resolveCounts({ configured: false, dbAvailable: [], dbInvited: [], mockRows })).toEqual({
      available: 2,
      invited: 1,
      saved: 1,
    });
  });
});
