import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureSupabase } from "@refee/core/client";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));

configureSupabase({ from: mocks.from, rpc: mocks.rpc } as never);

import { fetchRefereePublicView } from "@refee/core/director/queries";

/** A chainable stand-in for a supabase query: every step returns itself, awaiting yields `result`. */
function table(result: { data: unknown; error?: unknown }) {
  const q: any = {
    select: () => q,
    eq: () => q,
    maybeSingle: () => Promise.resolve({ error: null, ...result }),
    then: (res: (v: unknown) => unknown) => Promise.resolve({ error: null, ...result }).then(res),
  };
  return q;
}

const PROFILE = {
  id: "ref-1", first_name: "Alex", last_initial: "R", display_name: "Alex R",
  avatar_url: null, city: "Austin", state: "TX", rating: 4.8, rating_count: 12, is_verified: true,
};

function setup(sports: unknown) {
  mocks.from.mockImplementation((name: string) => {
    if (name === "public_profiles") return table({ data: PROFILE });
    if (name === "ref_sports") return table({ data: sports });
    return table({ data: [] });
  });
}

describe("fetchRefereePublicView leagues worked", () => {
  beforeEach(() => { mocks.from.mockReset(); });

  it("includes the leagues the referee entered", async () => {
    setup([{ leagues_worked: "AAU, YMCA" }]);
    const { ref } = await fetchRefereePublicView("ref-1");
    expect(ref?.leagues_worked).toBe("AAU, YMCA");
  });

  it("is null when none were entered or there is no sport row", async () => {
    setup([{ leagues_worked: null }]);
    expect((await fetchRefereePublicView("ref-1")).ref?.leagues_worked).toBeNull();
    setup([]);
    expect((await fetchRefereePublicView("ref-1")).ref?.leagues_worked).toBeNull();
  });
});

describe("fetchRefereePublicView show rate", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.rpc.mockReset();
    setup([]);
  });

  it("includes the referee's show-rate counts", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ ref_id: "ref-1", kept: 12, late_withdrawals: 1, no_shows: 0 }], error: null });
    const { ref } = await fetchRefereePublicView("ref-1");
    expect(mocks.rpc).toHaveBeenCalledWith("referee_reliability", { p_ref_ids: ["ref-1"] });
    expect(ref?.reliability).toEqual({ kept: 12, late_withdrawals: 1, no_shows: 0 });
  });

  it("still shows the profile if the show rate can't be loaded", async () => {
    mocks.rpc.mockRejectedValue(new Error("offline"));
    const { ref, error } = await fetchRefereePublicView("ref-1");
    expect(error).toBeNull();
    expect(ref?.reliability).toBeNull();
  });
});
