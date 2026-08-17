import { describe, it, expect, vi, afterEach } from "vitest";

// queries.ts imports the supabase client (React Native polyfills) at module load.
// findScheduleConflict takes its client as an argument, so we inject a fake and
// only stub the module-level import to keep things Node-friendly.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { findScheduleConflict, isLateWithdrawal, WITHDRAW_FREE_WINDOW_HOURS } from "./queries";

type Existing = { job_id: string; title: string; starts_at: string; duration_minutes: number | null };

/**
 * Minimal stand-in for the supabase query builder used by findScheduleConflict.
 * The "jobs" query ends in .maybeSingle(); the "job_assignments" query is awaited
 * directly (so the builder is thenable).
 */
function fakeSupabase(target: { starts_at: string; duration_minutes: number | null } | null, mine: Existing[]) {
  return {
    from(table: string) {
      const result =
        table === "jobs"
          ? { data: target, error: null }
          : { data: mine.map((m) => ({ job_id: m.job_id, jobs: { title: m.title, starts_at: m.starts_at, duration_minutes: m.duration_minutes } })), error: null };
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => Promise.resolve(result),
        then: (res: any, rej: any) => Promise.resolve(result).then(res, rej),
      };
      return builder;
    },
  } as any;
}

const target = { starts_at: "2026-09-01T15:00:00Z", duration_minutes: 64 }; // window 15:00–16:04

describe("findScheduleConflict (overlap detection)", () => {
  it("flags an accepted game that overlaps the target window", async () => {
    const { conflictTitle } = await findScheduleConflict(
      fakeSupabase(target, [
        { job_id: "b", title: "Overlapping Game", starts_at: "2026-09-01T15:30:00Z", duration_minutes: 60 },
      ]),
      "ref1",
      "a"
    );
    expect(conflictTitle).toBe("Overlapping Game");
  });

  it("does not flag a back-to-back game ending exactly at the target start", async () => {
    const { conflictTitle } = await findScheduleConflict(
      fakeSupabase(target, [
        { job_id: "b", title: "Earlier", starts_at: "2026-09-01T14:00:00Z", duration_minutes: 60 }, // 14:00–15:00
      ]),
      "ref1",
      "a"
    );
    expect(conflictTitle).toBeNull();
  });

  it("does not flag a game starting exactly at the target end", async () => {
    const { conflictTitle } = await findScheduleConflict(
      fakeSupabase(target, [
        { job_id: "b", title: "Later", starts_at: "2026-09-01T16:04:00Z", duration_minutes: 60 }, // 16:04–17:04
      ]),
      "ref1",
      "a"
    );
    expect(conflictTitle).toBeNull();
  });

  it("ignores the target job itself (re-accepting an already-accepted game)", async () => {
    const { conflictTitle } = await findScheduleConflict(
      fakeSupabase(target, [
        { job_id: "a", title: "Self", starts_at: "2026-09-01T15:00:00Z", duration_minutes: 64 },
      ]),
      "ref1",
      "a"
    );
    expect(conflictTitle).toBeNull();
  });

  it("uses the 120-minute default when duration is null", async () => {
    // Existing game with null duration starting 30m before → 2h window overlaps.
    const { conflictTitle } = await findScheduleConflict(
      fakeSupabase(target, [
        { job_id: "b", title: "No-Duration Game", starts_at: "2026-09-01T14:30:00Z", duration_minutes: null }, // 14:30–16:30
      ]),
      "ref1",
      "a"
    );
    expect(conflictTitle).toBe("No-Duration Game");
  });

  it("returns null when the ref has no accepted games", async () => {
    const { conflictTitle, error } = await findScheduleConflict(fakeSupabase(target, []), "ref1", "a");
    expect(conflictTitle).toBeNull();
    expect(error).toBeNull();
  });

  it("returns null when the target job is missing", async () => {
    const { conflictTitle } = await findScheduleConflict(fakeSupabase(null, []), "ref1", "a");
    expect(conflictTitle).toBeNull();
  });
});

describe("isLateWithdrawal", () => {
  afterEach(() => vi.useRealTimers());

  it(`flags withdrawals inside the ${WITHDRAW_FREE_WINDOW_HOURS}h window`, () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    // Game 12h out — inside the 24h window.
    expect(isLateWithdrawal("2026-09-01T12:00:00Z")).toBe(true);
  });

  it("does not flag withdrawals comfortably before the window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    // Game 48h out — outside the 24h window.
    expect(isLateWithdrawal("2026-09-03T00:00:00Z")).toBe(false);
  });
});
