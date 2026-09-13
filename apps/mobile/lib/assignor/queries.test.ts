import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: mocks.rpc },
}));

import {
  directAssignRefToGame,
  inviteToRoster,
  removeFromRoster,
  removeRefFromGame,
  respondToRosterInvite,
  setGameStaffingMode,
  submitProposal,
  withdrawProposal,
} from "./queries";

describe("assignor mutations use the staffing authorization boundary", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: null, error: null });
  });

  it("invites an existing referee using the authenticated assignor identity", async () => {
    await expect(inviteToRoster("untrusted-client-id", "ref-1")).resolves.toEqual({ error: null });
    expect(mocks.rpc).toHaveBeenCalledWith("invite_existing_ref_to_roster", {
      p_ref_id: "ref-1",
    });
  });

  it("removes a roster relationship through its narrow RPC", async () => {
    await removeFromRoster("roster-1");
    expect(mocks.rpc).toHaveBeenCalledWith("remove_ref_from_roster", {
      p_roster_id: "roster-1",
    });
  });

  it("lets a referee respond without sending a mutable referee id", async () => {
    await respondToRosterInvite("roster-1", true);
    expect(mocks.rpc).toHaveBeenCalledWith("respond_to_roster_invite", {
      p_roster_id: "roster-1",
      p_accept: true,
    });
  });

  it("changes only the staffing mode through the server operation", async () => {
    await setGameStaffingMode("job-1", "self_assign");
    expect(mocks.rpc).toHaveBeenCalledWith("set_assignor_staffing_mode", {
      p_job_id: "job-1",
      p_mode: "self_assign",
    });
  });

  it("creates an offer rather than an accepted assignment", async () => {
    await directAssignRefToGame("job-1", "ref-1", "crew_chief");
    expect(mocks.rpc).toHaveBeenCalledWith("offer_ref_to_game", {
      p_job_id: "job-1",
      p_ref_id: "ref-1",
      p_role: "crew_chief",
    });
  });

  it("removes a game assignment through the authorized server operation", async () => {
    await removeRefFromGame("assignment-1");
    expect(mocks.rpc).toHaveBeenCalledWith("remove_ref_from_assignor_game", {
      p_assignment_id: "assignment-1",
    });
  });

  it("submits proposal terms atomically without trusting the assignor id", async () => {
    await submitProposal("tournament-1", "untrusted-client-id", {
      feeType: "percentage",
      feePct: 12.5,
      message: "I can staff this event",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("submit_assignor_proposal", {
      p_tournament_id: "tournament-1",
      p_fee_type: "percentage",
      p_fee_amount: null,
      p_fee_pct: 12.5,
      p_message: "I can staff this event",
    });
  });

  it("withdraws only the authenticated assignor's proposal", async () => {
    await withdrawProposal("tournament-1", "untrusted-client-id");
    expect(mocks.rpc).toHaveBeenCalledWith("withdraw_assignor_proposal", {
      p_tournament_id: "tournament-1",
    });
  });

  it("preserves database authorization errors for the UI", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "Crew is already full" } });

    const result = await directAssignRefToGame("job-1", "ref-1");

    expect(result.error?.message).toBe("Crew is already full");
  });
});
