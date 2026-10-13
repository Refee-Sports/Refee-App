import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { fetchOpenJobs } from "./queries";

const HOUR = 3_600_000;

function job(id: string, startsInHours: number) {
  return {
    id,
    hirer_id: "h1",
    sport_id: "basketball",
    title: id,
    job_type: "single",
    level: "high_school",
    starts_at: new Date(Date.now() + startsInHours * HOUR).toISOString(),
    duration_minutes: 120,
    venue_name: "Gym",
    venue_city: "Austin",
    venue_state: "TX",
    pay_per_game: 70,
    num_games: 1,
    crew_size: 2,
    status: "open",
    hirers: { org_name: "League", is_verified: true },
  };
}

/** A jobs query builder that applies .gt() the way PostgREST would. */
function fakeClient(rows: ReturnType<typeof job>[]) {
  return {
    from() {
      let result = rows;
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        gt: (col: string, value: string) => {
          result = result.filter((r: any) => r[col] > value);
          return builder;
        },
        then: (res: any, rej: any) => Promise.resolve({ data: result, error: null }).then(res, rej),
      };
      return builder;
    },
  } as any;
}

describe("the open-games feed", () => {
  it("leaves out games that have already started", async () => {
    const client = fakeClient([job("underway", -0.5), job("tonight", 3), job("next-week", 24 * 7)]);
    const { jobs, error } = await fetchOpenJobs(client, null);
    expect(error).toBeNull();
    expect(jobs.map((j) => j.id)).toEqual(["tonight", "next-week"]);
  });
});

describe("canWithdraw", () => {
  it("is allowed until tip-off and not after", async () => {
    const { canWithdraw } = await import("./queries");
    expect(canWithdraw(new Date(Date.now() + 10 * 60_000).toISOString())).toBe(true);
    expect(canWithdraw(new Date(Date.now() - 60_000).toISOString())).toBe(false);
  });
});
