import { describe, expect, it, vi } from "vitest";
import { loadOpenJobsWithFallback } from "@refee/core/jobs/queries";
import type { JobListRow } from "@refee/core/jobs/types";

const HERE = { lat: 30.27, lng: -97.74 };

type Result = { jobs: Partial<JobListRow>[]; error: Error | null; homeUnknown?: boolean };

function fetcher(results: Result[]) {
  return vi.fn(async (_origin?: { lat: number; lng: number }) => results.shift()! as { jobs: JobListRow[]; error: Error | null; homeUnknown?: boolean });
}

describe("loadOpenJobsWithFallback", () => {
  it("uses the home pin when there is one", async () => {
    const fetchJobs = fetcher([{ jobs: [{ id: "a" }], error: null, homeUnknown: false }]);
    const live = vi.fn();
    const r = await loadOpenJobsWithFallback({ fetchJobs, getLiveCoords: live, userId: "u1" });
    expect(r).toMatchObject({ liveFallback: false, result: { jobs: [{ id: "a" }] } });
    expect(live).not.toHaveBeenCalled();
  });

  it("measures from the device when there's no home pin and location is already allowed", async () => {
    const fetchJobs = fetcher([
      { jobs: [], error: null, homeUnknown: true },
      { jobs: [{ id: "near" }], error: null, homeUnknown: false },
    ]);
    const r = await loadOpenJobsWithFallback({
      fetchJobs,
      getLiveCoords: async () => ({ ok: true, coords: HERE }),
      userId: "u1",
    });
    expect(fetchJobs).toHaveBeenLastCalledWith(HERE);
    expect(r).toMatchObject({ liveFallback: true, result: { jobs: [{ id: "near" }] } });
  });

  it("stays on same-city when location isn't allowed", async () => {
    const fetchJobs = fetcher([{ jobs: [{ id: "city" }], error: null, homeUnknown: true }]);
    const r = await loadOpenJobsWithFallback({
      fetchJobs,
      getLiveCoords: async () => ({ ok: false }),
      userId: "u1",
    });
    expect(fetchJobs).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ liveFallback: false, result: { homeUnknown: true } });
  });

  it("never second-guesses a location the referee chose, or a signed-out feed, or an error", async () => {
    const live = vi.fn(async () => ({ ok: true as const, coords: HERE }));
    await loadOpenJobsWithFallback({
      fetchJobs: fetcher([{ jobs: [], error: null, homeUnknown: true }]),
      getLiveCoords: live,
      userId: "u1",
      origin: HERE,
    });
    await loadOpenJobsWithFallback({
      fetchJobs: fetcher([{ jobs: [], error: null, homeUnknown: true }]),
      getLiveCoords: live,
      userId: null,
    });
    await loadOpenJobsWithFallback({
      fetchJobs: fetcher([{ jobs: [], error: new Error("offline"), homeUnknown: true }]),
      getLiveCoords: live,
      userId: "u1",
    });
    expect(live).not.toHaveBeenCalled();
  });

  it("keeps the first result if the live-location reload fails", async () => {
    const r = await loadOpenJobsWithFallback({
      fetchJobs: fetcher([
        { jobs: [{ id: "city" }], error: null, homeUnknown: true },
        { jobs: [], error: new Error("offline") },
      ]),
      getLiveCoords: async () => ({ ok: true, coords: HERE }),
      userId: "u1",
    });
    expect(r).toMatchObject({ liveFallback: false, result: { jobs: [{ id: "city" }] } });
  });
});
