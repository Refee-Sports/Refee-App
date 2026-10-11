import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/lib/supabase", () => ({ supabase: { from: mocks.from } }));

import { fetchRefereePublicView } from "./queries";

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
