import { describe, expect, it, vi } from "vitest";
import { configureSupabase } from "@refee/core/client";

configureSupabase({} as never);

import { canReportRunningLate, declineJob, reportRunningLate, withdrawFromJob } from "@refee/core/jobs/queries";

/** rpc results by function name; functions.invoke records the pushes. */
function fake(rpcs: Record<string, { data?: unknown; error?: { message: string } | null }>) {
  const invoke = vi.fn().mockResolvedValue({ data: {}, error: null });
  const rpc = vi.fn((name: string) =>
    Promise.resolve({ data: null, error: null, ...(rpcs[name] ?? {}) })
  );
  return { client: { rpc, functions: { invoke } } as any, rpc, invoke };
}

const TARGETS = { data: { title: "Tue Night Game", user_ids: ["dir-1", "assignor-1"] } };

describe("withdrawing tells the organizers", () => {
  it("pushes the director and assignor, and says when it was late", async () => {
    const { client, invoke } = fake({ withdraw_from_job: { data: { late: true } }, job_notify_targets: TARGETS });
    const { error, late } = await withdrawFromJob(client, "job-1");
    expect(error).toBeNull();
    expect(late).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
    const [fn, { body }] = invoke.mock.calls[0];
    expect(fn).toBe("send-push");
    expect(body.userIds).toEqual(["dir-1", "assignor-1"]);
    expect(body.kind).toBe("game_updates");
    expect(body.body).toMatch(/Tue Night Game/);
    expect(body.body).toMatch(/late/i);
  });

  it("does not push when the withdrawal failed", async () => {
    const { client, invoke } = fake({ withdraw_from_job: { data: { error: "You are not confirmed on this game." } } });
    const { error } = await withdrawFromJob(client, "job-1");
    expect(error?.message).toMatch(/not confirmed/);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("still succeeds if the push cannot be sent", async () => {
    const { client, invoke } = fake({ withdraw_from_job: { data: { late: false } }, job_notify_targets: TARGETS });
    invoke.mockRejectedValue(new Error("network"));
    expect((await withdrawFromJob(client, "job-1")).error).toBeNull();
  });
});

describe("dropping out of a changed game", () => {
  it("tells the organizers, because it frees a confirmed slot", async () => {
    const { client, invoke } = fake({ respond_to_job: { data: "withdrawn" }, job_notify_targets: TARGETS });
    const { status, error } = await declineJob(client, "me", "job-1");
    expect(error).toBeNull();
    expect(status).toBe("withdrawn");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("stays quiet when an invite or application is simply declined", async () => {
    const { client, invoke } = fake({ respond_to_job: { data: "declined" } });
    await declineJob(client, "me", "job-1");
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("reportRunningLate", () => {
  it("stores the delay and pushes the organizers", async () => {
    const { client, invoke, rpc } = fake({
      report_running_late: { data: { title: "Tue Night Game", ref_name: "Alex R", minutes: 15, user_ids: ["dir-1"] } },
    });
    const { error } = await reportRunningLate(client, "job-1", 15);
    expect(error).toBeNull();
    expect(rpc).toHaveBeenCalledWith("report_running_late", { p_job_id: "job-1", p_minutes: 15 });
    const { body } = invoke.mock.calls[0][1];
    expect(body.userIds).toEqual(["dir-1"]);
    expect(body.body).toMatch(/Alex R/);
    expect(body.body).toMatch(/15/);
  });

  it("returns the database's reason when it is refused", async () => {
    const { client, invoke } = fake({ report_running_late: { error: { message: "You are not confirmed on this game." } } });
    const { error } = await reportRunningLate(client, "job-1", 15);
    expect(error?.message).toMatch(/not confirmed/);
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("canReportRunningLate (matches the database window)", () => {
  const start = "2026-10-20T18:00:00Z";
  const at = (iso: string) => new Date(iso);

  it("is closed more than 3 hours before tip-off", () => {
    expect(canReportRunningLate(start, 60, at("2026-10-20T14:59:00Z"))).toBe(false);
  });
  it("opens 3 hours before tip-off", () => {
    expect(canReportRunningLate(start, 60, at("2026-10-20T15:00:00Z"))).toBe(true);
  });
  it("stays open until the game ends", () => {
    expect(canReportRunningLate(start, 60, at("2026-10-20T18:59:00Z"))).toBe(true);
    expect(canReportRunningLate(start, 60, at("2026-10-20T19:01:00Z"))).toBe(false);
  });
  it("assumes a 2 hour game when the length is unknown", () => {
    expect(canReportRunningLate(start, null, at("2026-10-20T19:59:00Z"))).toBe(true);
  });
});
