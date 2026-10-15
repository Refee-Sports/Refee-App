import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureSupabase } from "@refee/core/client";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

configureSupabase({ rpc: mocks.rpc } as never);

import { assignMyself, canAssignMyself } from "@refee/core/assignor/queries";

const ME = "11111111-1111-4111-8111-111111111101";

describe("canAssignMyself", () => {
  const base = { userId: ME, roles: ["assignor", "referee"] as const, crewRefIds: [], crewSize: 2 };

  it("offers it to an assignor who also referees, when a slot is open", () => {
    expect(canAssignMyself({ ...base, roles: [...base.roles] })).toBe(true);
  });

  it("doesn't offer it without the referee role", () => {
    expect(canAssignMyself({ ...base, roles: ["assignor"] })).toBe(false);
  });

  it("doesn't offer it once they're on the crew", () => {
    expect(canAssignMyself({ ...base, roles: [...base.roles], crewRefIds: [ME] })).toBe(false);
  });

  it("doesn't offer it when the crew is full", () => {
    expect(canAssignMyself({ ...base, roles: [...base.roles], crewRefIds: ["a", "b"] })).toBe(false);
  });
});

describe("assignMyself", () => {
  beforeEach(() => mocks.rpc.mockReset());

  it("places themselves directly in offer-from-roster mode", async () => {
    mocks.rpc.mockResolvedValue({ data: "assignment-id", error: null });
    const result = await assignMyself("job-1", ME, "assignor_direct");
    expect(mocks.rpc).toHaveBeenCalledWith("offer_ref_to_game", {
      p_job_id: "job-1",
      p_ref_id: ME,
      p_role: "official",
    });
    expect(result.error).toBeNull();
  });

  it("claims the game like a roster member in self-claim mode", async () => {
    mocks.rpc.mockResolvedValue({ data: "accepted", error: null });
    const result = await assignMyself("job-1", ME, "self_assign");
    expect(mocks.rpc).toHaveBeenCalledWith("respond_to_job", { p_job_id: "job-1", p_accept: true });
    expect(result.error).toBeNull();
  });

  it("passes the database's reason through", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Referee has a schedule conflict" } });
    const result = await assignMyself("job-1", ME, "assignor_direct");
    expect(result.error?.message).toBe("Referee has a schedule conflict");
  });
});
