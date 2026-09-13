import { describe, it, expect, vi, afterEach } from "vitest";

// queries.ts imports the supabase client (React Native polyfills) at module load.
// findScheduleConflict takes its client as an argument, so we inject a fake and
// only stub the module-level import to keep things Node-friendly.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import {
  acceptJob,
  declineJob,
  findScheduleConflict,
  isLateWithdrawal,
  mapCrewAssignment,
  WITHDRAW_FREE_WINDOW_HOURS,
} from "./queries";

type Existing = { job_id: string; title: string; starts_at: string; duration_minutes: number | null };

/**
 * Minimal stand-in for the supabase query builder used by findScheduleConflict.
 * The "jobs" query ends in .maybeSingle(); the "job_assignments" query is awaited
 * directly (so the builder is thenable).
 */
function fakeSupabase(
  target: { starts_at: string; duration_minutes: number | null } | null,
  mine: Existing[],
  rpcResult: { data: string | null; error: { message: string } | null } = {
    data: "accepted",
    error: null,
  }
) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
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
    rpc,
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

describe("server-authoritative job responses", () => {
  it("accepts through respond_to_job after the friendly client conflict check", async () => {
    const client = fakeSupabase(target, [], { data: "pending", error: null });

    const result = await acceptJob(client, "ref1", "job1");

    expect(client.rpc).toHaveBeenCalledWith("respond_to_job", {
      p_job_id: "job1",
      p_accept: true,
    });
    expect(result).toEqual({ status: "pending", error: null });
  });

  it("declines through respond_to_job and never authors an assignment row directly", async () => {
    const client = fakeSupabase(target, [], { data: "declined", error: null });

    const result = await declineJob(client, "ref1", "job1");

    expect(client.rpc).toHaveBeenCalledWith("respond_to_job", {
      p_job_id: "job1",
      p_accept: false,
    });
    expect(result).toEqual({ status: "declined", error: null });
  });

  it("surfaces an authorization failure from the database", async () => {
    const client = fakeSupabase(target, [], {
      data: null,
      error: { message: "This game is limited to the assignor roster" },
    });

    const result = await acceptJob(client, "ref1", "job1");

    expect(result.status).toBeNull();
    expect(result.error?.message).toBe("This game is limited to the assignor roster");
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

describe("mapCrewAssignment", () => {
  const profile = {
    first_name: "Alex",
    last_initial: "R",
    display_name: "Alex R.",
    rating: 4.8,
  };

  it("keeps an awaiting-reconfirm referee visible with an explicit state", () => {
    expect(
      mapCrewAssignment(
        { ref_id: "ref1", role: "crew_chief", status: "needs_reconfirm", profile },
        "ref1"
      )
    ).toMatchObject({
      refId: "ref1",
      displayName: "ALEX R.",
      status: "! RE-CONFIRM",
      isMe: true,
    });
  });

  it("keeps accepted crew locked", () => {
    expect(
      mapCrewAssignment(
        { ref_id: "ref2", role: "official", status: "accepted", profile },
        "ref1"
      )
    ).toMatchObject({ status: "● LOCKED", isMe: false });
  });
});
