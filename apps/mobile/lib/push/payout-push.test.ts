import { describe, expect, it } from "vitest";
import { payoutPushMessages } from "../../../../supabase/functions/_shared/payout-push";

const paid = (patch: Record<string, unknown> = {}) => ({
  ref_id: "ref1",
  amount_due: 60,
  job_id: "11111111-1111-1111-1111-111111111111",
  jobs: { title: "Lions vs Tigers" },
  ...patch,
});

describe("payoutPushMessages", () => {
  it("tells the referee what was paid and for which game, on each of their devices", () => {
    const tokens = new Map([["ref1", ["tokA", "tokB"]]]);
    expect(payoutPushMessages([paid()], tokens)).toEqual(
      ["tokA", "tokB"].map((to) => ({
        to,
        title: "You've been paid",
        body: "$60 for Lions vs Tigers is in your Stripe account and on its way to your bank.",
        data: { type: "payout", jobId: "11111111-1111-1111-1111-111111111111" },
        sound: "default",
      }))
    );
  });

  it("skips referees with no device and payouts of nothing", () => {
    const tokens = new Map([["ref1", ["tokA"]]]);
    expect(payoutPushMessages([paid({ ref_id: "ref2" }), paid({ amount_due: 0 })], tokens)).toEqual([]);
  });

  it("accepts the job embedded as a one-element list", () => {
    const tokens = new Map([["ref1", ["tokA"]]]);
    const [message] = payoutPushMessages([paid({ jobs: [{ title: "Hawks vs Owls" }], amount_due: 45 })], tokens);
    expect(message.body).toBe("$45 for Hawks vs Owls is in your Stripe account and on its way to your bank.");
  });
});
