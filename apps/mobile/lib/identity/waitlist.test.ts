import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));

import { joinUnder18Waitlist } from "./waitlist";

describe("joining the 16–17 waitlist", () => {
  beforeEach(() => mocks.rpc.mockReset().mockResolvedValue({ error: null }));

  it("sends the age and a tidy state, and nothing else", async () => {
    const result = await joinUnder18Waitlist(17, " ny ");
    expect(result).toEqual({ error: null });
    expect(mocks.rpc).toHaveBeenCalledWith("join_under_18_waitlist", { p_age: 17, p_state: "NY" });
  });

  it("sends no state when none was given", async () => {
    await joinUnder18Waitlist(16);
    expect(mocks.rpc).toHaveBeenCalledWith("join_under_18_waitlist", { p_age: 16, p_state: null });
  });

  it("refuses any other age without calling the server", async () => {
    for (const age of [15, 18, 12, 0, 40]) {
      const result = await joinUnder18Waitlist(age);
      expect(result.error).toMatch(/16 and 17/);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("says something useful when the server says no", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "State must be a two-letter code." } });
    expect((await joinUnder18Waitlist(16, "New York")).error).toBe("Use a two-letter state, like NY.");

    mocks.rpc.mockResolvedValue({ error: { message: "boom: connection reset" } });
    expect((await joinUnder18Waitlist(16)).error).toBe("We couldn't save that. Try again in a moment.");
  });

  it("never leaks the server's raw wording", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "permission denied for table under_18_waitlist" } });
    const { error } = await joinUnder18Waitlist(16);
    expect(error).not.toMatch(/permission|table|under_18/);
  });
});
