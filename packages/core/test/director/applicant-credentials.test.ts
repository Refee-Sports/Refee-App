import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureSupabase } from "@refee/core/client";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));

configureSupabase({ from: mocks.from, rpc: mocks.rpc } as never);

import { fetchGameApplicants } from "@refee/core/director/queries";

function table(result: { data: unknown }) {
  const q: any = {
    select: () => q,
    eq: () => q,
    in: () => q,
    order: () => q,
    then: (res: (v: unknown) => unknown) => Promise.resolve({ error: null, ...result }).then(res),
  };
  return q;
}

const ASSIGNMENTS = [
  { id: "a1", ref_id: "ref-1", status: "pending", applied_at: "2026-10-01T00:00:00Z", responded_at: null,
    late_minutes: null, withdrew_late: null,
    public_profiles: { first_name: "Alex", last_initial: "R", display_name: "Alex R", avatar_url: null, rating: 4.8, city: "Austin", state: "TX" } },
  { id: "a2", ref_id: "ref-2", status: "pending", applied_at: "2026-10-01T01:00:00Z", responded_at: null,
    late_minutes: null, withdrew_late: null,
    public_profiles: { first_name: "Sam", last_initial: "T", display_name: "Sam T", avatar_url: null, rating: 0, city: "Austin", state: "TX" } },
];

describe("applicant cards show credentials", () => {
  beforeEach(() => {
    mocks.rpc.mockReset().mockResolvedValue({ data: [], error: null });
    mocks.from.mockReset().mockImplementation((name: string) => {
      if (name === "job_assignments") return table({ data: ASSIGNMENTS });
      if (name === "certifications") return table({ data: [{ ref_id: "ref-1", org_name: "iaabo" }, { ref_id: "ref-1", org_name: "nfhs" }] });
      if (name === "ref_levels") return table({ data: [{ ref_id: "ref-1", level_id: "high_school" }] });
      if (name === "ref_sports") return table({ data: [{ ref_id: "ref-1", leagues_worked: "AAU, YMCA" }] });
      return table({ data: [] });
    });
  });

  it("attaches each applicant's show-rate counts, and none for a referee with no answer", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ ref_id: "ref-1", kept: 9, late_withdrawals: 1, no_shows: 0 }], error: null });
    const { applicants } = await fetchGameApplicants("job-1");
    expect(mocks.rpc).toHaveBeenCalledWith("referee_reliability", { p_ref_ids: ["ref-1", "ref-2"] });
    expect(applicants[0].reliability).toEqual({ kept: 9, late_withdrawals: 1, no_shows: 0 });
    expect(applicants[1].reliability).toBeNull();
  });

  it("still lists applicants when the show rate can't be loaded", async () => {
    mocks.rpc.mockRejectedValue(new Error("offline"));
    const { applicants, error } = await fetchGameApplicants("job-1");
    expect(error).toBeNull();
    expect(applicants).toHaveLength(2);
  });

  it("attaches each applicant's certs, levels and leagues worked", async () => {
    const { applicants, error } = await fetchGameApplicants("job-1");
    expect(error).toBeNull();
    expect(applicants[0].credentials).toEqual({
      certs: ["iaabo", "nfhs"],
      levels: ["high_school"],
      leaguesWorked: "AAU, YMCA",
    });
  });

  it("gives empty credentials to an applicant who entered none", async () => {
    const { applicants } = await fetchGameApplicants("job-1");
    expect(applicants[1].credentials).toEqual({ certs: [], levels: [], leaguesWorked: null });
  });
});

describe("credentialsLine", () => {
  it("reads as one short line for the card", async () => {
    const { credentialsLine } = await import("@refee/core/director/queries");
    expect(credentialsLine({ certs: ["iaabo", "nfhs"], levels: ["high_school", "youth_rec"], leaguesWorked: null }))
      .toBe("IAABO · NFHS · HIGH SCHOOL · YOUTH REC");
    expect(credentialsLine({ certs: [], levels: [], leaguesWorked: null })).toBe("");
    expect(credentialsLine(undefined)).toBe("");
  });
});
