import { describe, expect, it, vi } from "vitest";
import { configureSupabase } from "@refee/core/client";

configureSupabase({} as never);

import { fetchOpenJobs } from "@refee/core/jobs/queries";

const AUSTIN = { lat: 30.2672, lng: -97.7431 };
const ROUND_ROCK = { lat: 30.5083, lng: -97.6789 }; // ~17 mi from Austin
const EL_PASO = { lat: 31.7619, lng: -106.485 }; // ~520 mi from Austin

function job(id: string, city: string, state: string, at: { lat: number; lng: number } | null) {
  return {
    id,
    hirer_id: "h1",
    sport_id: "basketball",
    title: id,
    job_type: "single",
    level: "high_school",
    starts_at: new Date(Date.now() + 48 * 3_600_000).toISOString(),
    duration_minutes: 120,
    venue_name: "Gym",
    venue_address: "100 Main St",
    venue_zip: "78701",
    venue_city: city,
    venue_state: state,
    venue_lat: at?.lat ?? null,
    venue_lng: at?.lng ?? null,
    pay_per_game: 70,
    num_games: 1,
    crew_size: 2,
    status: "open",
    hirers: { org_name: "League", is_verified: true },
  };
}

const JOBS = [
  job("round-rock", "Round Rock", "TX", ROUND_ROCK),
  job("el-paso", "El Paso", "TX", EL_PASO),
  job("austin-unpinned", "Austin", "TX", null),
  job("houston-unpinned", "Houston", "TX", null),
];

/** A query builder per table, resolving to whatever that table holds. */
function fakeClient(tables: Record<string, unknown>) {
  return {
    from(table: string) {
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        gt: () => builder,
        order: () => builder,
        maybeSingle: () => Promise.resolve({ data: tables[table] ?? null, error: null }),
        then: (res: any, rej: any) =>
          Promise.resolve({ data: tables[table] ?? [], error: null }).then(res, rej),
      };
      return builder;
    },
  } as any;
}

function ref(home: { lat: number; lng: number } | null) {
  return fakeClient({
    jobs: JOBS,
    job_assignments: [],
    public_profiles: { city: "Austin", state: "TX" },
    private_profiles: { home_lat: home?.lat ?? null, home_lng: home?.lng ?? null },
    availability_prefs: { travel_radius_miles: 25, min_pay_per_game: 0, available_days: 0 },
  });
}

describe("feed location matching", () => {
  it("uses the mile radius when both ends are on the map", async () => {
    const { jobs, homeUnknown } = await fetchOpenJobs(ref(AUSTIN), "u1");
    expect(jobs.map((j) => j.id)).toContain("round-rock");
    expect(jobs.map((j) => j.id)).not.toContain("el-paso");
    expect(homeUnknown).toBe(false);
  });

  it("matches an unpinned venue by the referee's own city, not the whole state", async () => {
    const { jobs } = await fetchOpenJobs(ref(AUSTIN), "u1");
    expect(jobs.map((j) => j.id)).toContain("austin-unpinned");
    expect(jobs.map((j) => j.id)).not.toContain("houston-unpinned");
  });

  it("without a home pin, shows only games in the referee's city and flags it", async () => {
    const { jobs, homeUnknown } = await fetchOpenJobs(ref(null), "u1");
    expect(jobs.map((j) => j.id).sort()).toEqual(["austin-unpinned"]);
    expect(homeUnknown).toBe(true);
  });

  it("a live location stands in for a missing home pin", async () => {
    const { jobs, homeUnknown } = await fetchOpenJobs(ref(null), "u1", AUSTIN);
    expect(jobs.map((j) => j.id)).toContain("round-rock");
    expect(jobs.map((j) => j.id)).not.toContain("el-paso");
    expect(homeUnknown).toBe(false);
  });
});

describe("roster-only games in the feed", () => {
  const rosterGame = {
    ...job("roster-only", "Round Rock", "TX", ROUND_ROCK),
    tournaments: { assignor_id: "assignor1", assignor_status: "accepted" },
  };
  const pendingAssignor = {
    ...job("assignor-not-hired", "Round Rock", "TX", ROUND_ROCK),
    tournaments: { assignor_id: "assignor1", assignor_status: "pending" },
  };
  const client = (rosters: unknown[]) =>
    fakeClient({
      jobs: [rosterGame, pendingAssignor, job("public", "Round Rock", "TX", ROUND_ROCK)],
      job_assignments: [],
      assignor_rosters: rosters,
      public_profiles: { city: "Austin", state: "TX" },
      private_profiles: AUSTIN && { home_lat: AUSTIN.lat, home_lng: AUSTIN.lng },
      availability_prefs: { travel_radius_miles: 25, min_pay_per_game: 0, available_days: 0 },
    });

  it("hides a game an assignor runs from referees who aren't on their roster", async () => {
    const { jobs } = await fetchOpenJobs(client([]), "u1");
    expect(jobs.map((j) => j.id).sort()).toEqual(["assignor-not-hired", "public"]);
  });

  it("shows it to the assignor's roster", async () => {
    const { jobs } = await fetchOpenJobs(client([{ assignor_id: "assignor1" }]), "u1");
    expect(jobs.map((j) => j.id)).toContain("roster-only");
  });

  it("shows it to the assignor themselves", async () => {
    const { jobs } = await fetchOpenJobs(client([]), "assignor1");
    expect(jobs.map((j) => j.id)).toContain("roster-only");
  });
});

describe("games without a full venue address", () => {
  it("never appear, since nobody can be booked on them", async () => {
    const noZip = { ...job("no-zip", "Round Rock", "TX", ROUND_ROCK), venue_zip: null };
    const noStreet = { ...job("no-street", "Round Rock", "TX", ROUND_ROCK), venue_address: " " };
    const client = fakeClient({
      jobs: [noZip, noStreet, job("complete", "Round Rock", "TX", ROUND_ROCK)],
      job_assignments: [],
      public_profiles: { city: "Austin", state: "TX" },
      private_profiles: { home_lat: AUSTIN.lat, home_lng: AUSTIN.lng },
      availability_prefs: { travel_radius_miles: 25, min_pay_per_game: 0, available_days: 0 },
    });
    const { jobs } = await fetchOpenJobs(client, "u1");
    expect(jobs.map((j) => j.id)).toEqual(["complete"]);
  });
});
