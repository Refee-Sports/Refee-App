// After the director's payment succeeds, verify the PaymentIntent and
// transfer each ref's share to their Stripe Express account.
// Refs without a payout account are marked "processing" (owed, held).
import { stripe, adminClient, getCaller, json, handleOptions } from "../_shared/util.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { jobId } = await req.json();
    if (!jobId) return json({ error: "jobId required" }, 400);

    const admin = adminClient();

    const { data: job } = await admin
      .from("jobs")
      .select("id, payment_intent_id, payment_status, hirers(user_id)")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) return json({ error: "Game not found" }, 404);
    const hirer = Array.isArray(job.hirers) ? job.hirers[0] : job.hirers;
    if (hirer?.user_id !== user.id) return json({ error: "Not your game" }, 403);
    if (!job.payment_intent_id) return json({ error: "No payment started for this game." }, 400);

    // Trust Stripe, not the client
    const intent = await stripe.paymentIntents.retrieve(job.payment_intent_id);
    if (intent.status !== "succeeded") {
      return json({ error: `Payment not completed (status: ${intent.status}).` }, 400);
    }

    const { data: owed } = await admin
      .from("job_assignments")
      .select("id, ref_id, amount_due")
      .eq("job_id", jobId)
      .in("status", ["completed", "cancelled"])
      .eq("payout_status", "pending")
      .gt("amount_due", 0);

    let transferred = 0;
    let held = 0;

    for (const a of owed ?? []) {
      const { data: priv } = await admin
        .from("private_profiles")
        .select("stripe_account_id, stripe_account_status")
        .eq("id", a.ref_id)
        .maybeSingle();

      if (priv?.stripe_account_id && priv.stripe_account_status === "complete") {
        const transfer = await stripe.transfers.create({
          amount: (a.amount_due ?? 0) * 100,
          currency: "usd",
          destination: priv.stripe_account_id,
          metadata: { refee_job_id: jobId, refee_assignment_id: a.id },
        });
        await admin
          .from("job_assignments")
          .update({
            payout_status: "paid",
            paid_at: new Date().toISOString(),
            stripe_transfer_id: transfer.id,
          })
          .eq("id", a.id);
        transferred += 1;
      } else {
        // Director has paid; ref just hasn't onboarded. Hold their share.
        await admin
          .from("job_assignments")
          .update({ payout_status: "processing" })
          .eq("id", a.id);
        held += 1;
      }
    }

    await admin.from("jobs").update({ payment_status: "paid" }).eq("id", jobId);

    return json({ transferred, held });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
