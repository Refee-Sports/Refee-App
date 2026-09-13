import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  sendPush: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: mocks.rpc },
}));
vi.mock("@/lib/geo/geocode", () => ({ geocodeAddress: vi.fn() }));
vi.mock("@/lib/push/notifications", () => ({ sendPush: mocks.sendPush }));

import {
  acceptAssignorProposal,
  cancelGame,
  completeGame,
  declineApplicantForGame,
  declineAssignorProposal,
  inviteAssignorToTournament,
} from "./queries";

describe("director lifecycle mutations use server-authoritative RPCs", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.sendPush.mockReset();
  });

  it("declines an application without directly updating assignment columns", async () => {
    mocks.rpc.mockResolvedValue({ data: "declined", error: null });

    await expect(declineApplicantForGame("job-1", "ref-1")).resolves.toEqual({ error: null });
    expect(mocks.rpc).toHaveBeenCalledWith("director_respond_to_application", {
      p_job_id: "job-1",
      p_ref_id: "ref-1",
      p_accept: false,
    });
  });

  it("completes a game with server-calculated pay before posting the crew note", async () => {
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "complete_game"
        ? { data: { title: "Final", amount_due: 125 }, error: null }
        : { data: null, error: null }
    );

    await expect(completeGame("job-1", "director-1")).resolves.toEqual({ error: null });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "complete_game", { p_job_id: "job-1" });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "post_crew_note", {
      p_job_id: "job-1",
      p_body: expect.stringContaining("Pay of $125 per ref is locked in"),
    });
  });

  it("uses the server cancellation result for the bust-fee message", async () => {
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "cancel_game"
        ? { data: { title: "Semifinal", fee_paid: true, fee_amount: 50 }, error: null }
        : { data: null, error: null }
    );

    await expect(cancelGame("job-2", "director-1")).resolves.toEqual({
      error: null,
      feePaid: true,
      feeAmount: 50,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "cancel_game", { p_job_id: "job-2" });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "post_crew_note", {
      p_job_id: "job-2",
      p_body: expect.stringContaining("A 50% fee ($50) is owed"),
    });
  });

  it("does not post a crew note when the lifecycle RPC is rejected", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Director game not found" } });

    const result = await completeGame("job-1", "director-1");

    expect(result.error?.message).toBe("Director game not found");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("creates the tournament invitation and proposal in one server transaction", async () => {
    mocks.rpc.mockResolvedValue({ data: "proposal-1", error: null });

    await inviteAssignorToTournament("tournament-1", "assignor-1", {
      feeType: "flat",
      feeAmount: 450,
    });

    expect(mocks.rpc).toHaveBeenCalledWith("director_invite_assignor", {
      p_tournament_id: "tournament-1",
      p_assignor_id: "assignor-1",
      p_fee_type: "flat",
      p_fee_amount: 450,
      p_fee_pct: null,
    });
  });

  it("accepts proposal terms from the locked database row", async () => {
    mocks.rpc.mockResolvedValue({ data: "accepted", error: null });

    await acceptAssignorProposal("proposal-1");

    expect(mocks.rpc).toHaveBeenCalledWith("director_respond_to_assignor_proposal", {
      p_proposal_id: "proposal-1",
      p_accept: true,
    });
  });

  it("declines a proposal through the same authorization boundary", async () => {
    mocks.rpc.mockResolvedValue({ data: "declined", error: null });

    await declineAssignorProposal("proposal-1");

    expect(mocks.rpc).toHaveBeenCalledWith("director_respond_to_assignor_proposal", {
      p_proposal_id: "proposal-1",
      p_accept: false,
    });
  });
});
