import { describe, it, expect } from "vitest";
import { mapDbJobToListRow, mapDbJobToDetail, type JobDbRow } from "./map-db-job";

function dbRow(overrides: Partial<JobDbRow> = {}): JobDbRow {
  return {
    id: "11112222-3333-4444-5555-666677778888",
    hirer_id: "h1",
    sport_id: "basketball",
    title: "Team Loaded vs Boo Williams",
    job_type: "tournament",
    level: "high_school",
    age_group: "HS",
    gender: "boys",
    ruleset: "nfhs",
    starts_at: "2026-09-01T11:15:00Z", // 6:15 AM CT
    ends_at: null,
    duration_minutes: 64,
    venue_name: "Bishop Ireton Court 1",
    venue_address: "201 Cambridge Rd, Alexandria, VA",
    venue_city: "Alexandria",
    venue_state: "VA",
    venue_lat: 38.8,
    venue_lng: -77.05,
    pay_per_game: 35,
    num_games: 2,
    payout_window_hours: null,
    crew_size: 3,
    status: "open",
    is_featured: false,
    hirer_note: null,
    uniform_requirements: null,
    parking_info: null,
    closes_at: null,
    hirers: { org_name: "Refee Basketball League", is_verified: true },
    ...overrides,
  };
}

describe("mapDbJobToListRow", () => {
  it("derives per-game pay, crew, and a JOB# code from the id", () => {
    const r = mapDbJobToListRow(dbRow());
    expect(r.payPerGame).toBe(35);
    expect(r.pay).toBe("35");
    expect(r.crew).toBe("3-PERSON");
    expect(r.crewSize).toBe(3);
    expect(r.jobId).toBe("JOB#11112222");
  });

  it("labels pay as / DAY only for multi_day jobs", () => {
    expect(mapDbJobToListRow(dbRow({ job_type: "tournament" })).payUnit).toBe("/ GAME");
    expect(mapDbJobToListRow(dbRow({ job_type: "multi_day" })).payUnit).toBe("/ DAY");
  });

  it("uppercases the org and carries the verified flag", () => {
    const r = mapDbJobToListRow(dbRow());
    expect(r.org).toBe("REFEE BASKETBALL LEAGUE");
    expect(r.orgVerified).toBe(true);
  });

  it("marks featured rows with the FEATURED variant + tag", () => {
    const plain = mapDbJobToListRow(dbRow({ is_featured: false }));
    expect(plain.variant).toBe("default");
    const feat = mapDbJobToListRow(dbRow({ is_featured: true }));
    expect(feat.variant).toBe("featured");
    expect(feat.tagLeft).toBe("FEATURED");
  });

  it("starts distance unknown (null) until geocoding fills it in", () => {
    expect(mapDbJobToListRow(dbRow()).distanceMiles).toBeNull();
  });
});

describe("mapDbJobToDetail", () => {
  it("computes payTotal as per-game pay × number of games", () => {
    const d = mapDbJobToDetail(dbRow({ pay_per_game: 35, num_games: 2 }));
    expect(d.payTotal).toBe(70);
    expect(d.payPerGame).toBe(35);
    expect(d.numGames).toBe(2);
  });

  it("defaults the payout window to 48h when the column is null", () => {
    expect(mapDbJobToDetail(dbRow({ payout_window_hours: null })).payoutHours).toBe(48);
    expect(mapDbJobToDetail(dbRow({ payout_window_hours: 24 })).payoutHours).toBe(24);
  });

  it("renders the start time in Central Time", () => {
    // 11:15 UTC on 2026-09-01 is 06:15 CDT.
    expect(mapDbJobToDetail(dbRow()).whenSecondary).toBe("6:15 AM CT");
  });

  it("reports open slots equal to crew size", () => {
    expect(mapDbJobToDetail(dbRow({ crew_size: 3 })).slotsOpen).toBe(3);
  });

  it("shows N SLOTS LEFT in the telemetry line", () => {
    expect(mapDbJobToDetail(dbRow({ crew_size: 3 })).telemetryLeft).toContain("3 SLOTS LEFT");
    expect(mapDbJobToDetail(dbRow({ crew_size: 1 })).telemetryLeft).toContain("1 SLOT LEFT");
  });

  it("falls back to ORGANIZER when the hirer join is missing", () => {
    expect(mapDbJobToDetail(dbRow({ hirers: null })).org).toBe("ORGANIZER");
    expect(mapDbJobToDetail(dbRow({ hirers: null })).orgVerified).toBe(false);
  });
});
