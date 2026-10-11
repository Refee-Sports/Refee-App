import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke }, from: vi.fn() },
}));

import { cancelGame, completeGame, markNoShow } from "./queries";

function rpcReturns(map: Record<string, unknown>) {
  mocks.rpc.mockImplementation((name: string) =>
    Promise.resolve({ data: map[name] ?? null, error: null })
  );
}

describe("game-day pushes to referees", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.invoke.mockReset().mockResolvedValue({ data: {}, error: null });
  });

  it("cancelling a game tells every confirmed ref", async () => {
    rpcReturns({ cancel_game: { title: "Sat Game", fee_paid: false, fee_amount: 0, ref_ids: ["r1", "r2"] } });
    const { error } = await cancelGame("job-1", "dir-1");
    expect(error).toBeNull();
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    const { body } = mocks.invoke.mock.calls[0][1];
    expect(body.userIds).toEqual(["r1", "r2"]);
    expect(body.kind).toBe("game_updates");
    expect(body.title).toMatch(/cancel/i);
    expect(body.body).toMatch(/Sat Game/);
  });

  it("a late cancel says a fee is owed", async () => {
    rpcReturns({ cancel_game: { title: "Sat Game", fee_paid: true, fee_amount: 35, ref_ids: ["r1"] } });
    await cancelGame("job-1", "dir-1");
    expect(mocks.invoke.mock.calls[0][1].body.body).toMatch(/\$35/);
  });

  it("completing a game tells the refs their pay is locked in", async () => {
    rpcReturns({ complete_game: { title: "Sat Game", amount_due: 70, ref_ids: ["r1", "r2"] } });
    await completeGame("job-1", "dir-1");
    const { body } = mocks.invoke.mock.calls[0][1];
    expect(body.userIds).toEqual(["r1", "r2"]);
    expect(body.body).toMatch(/\$70/);
  });

  it("sends nothing when no ref was confirmed", async () => {
    rpcReturns({ cancel_game: { title: "Sat Game", fee_paid: false, fee_amount: 0, ref_ids: [] } });
    await cancelGame("job-1", "dir-1");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("marking a no-show records it and tells that ref", async () => {
    rpcReturns({ mark_no_show: { title: "Sat Game", ref_id: "r1" } });
    const { error } = await markNoShow("job-1", "r1");
    expect(error).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledWith("mark_no_show", { p_job_id: "job-1", p_ref_id: "r1" });
    expect(mocks.invoke.mock.calls[0][1].body.userIds).toEqual(["r1"]);
  });

  it("surfaces the reason when a no-show is refused", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "A no-show can only be recorded once the game has started." } });
    const { error } = await markNoShow("job-1", "r1");
    expect(error?.message).toMatch(/started/);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
