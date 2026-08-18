// Returns the calling referee's Stripe payout readiness and syncs the
// account status onto their private profile.
import { stripe, adminClient, getCaller, json, handleOptions } from "../_shared/util.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = adminClient();
    const { data: priv } = await admin
      .from("private_profiles")
      .select("stripe_account_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!priv?.stripe_account_id) {
      return json({ hasAccount: false, payoutsEnabled: false });
    }

    const account = await stripe.accounts.retrieve(priv.stripe_account_id);
    const payoutsEnabled = !!account.payouts_enabled;

    await admin
      .from("private_profiles")
      .update({ stripe_account_status: payoutsEnabled ? "complete" : "pending" })
      .eq("id", user.id);

    // Release payouts that were held while the ref hadn't onboarded yet
    // (director already paid; job is marked paid; ref share was 'processing')
    let released = 0;
    if (payoutsEnabled) {
      const { data: held } = await admin
        .from("job_assignments")
        .select("id, amount_due, job_id, jobs(payment_status, payment_intent_id)")
        .eq("ref_id", user.id)
        .eq("payout_status", "processing")
        .gt("amount_due", 0);

      for (const a of held ?? []) {
        const j = Array.isArray(a.jobs) ? a.jobs[0] : a.jobs;
        if (j?.payment_status !== "paid") continue;
        // Draw from the director's original charge so the release works before
        // the platform balance settles.
        let chargeId: string | undefined;
        if (j?.payment_intent_id) {
          const intent = await stripe.paymentIntents.retrieve(j.payment_intent_id);
          chargeId = intent.latest_charge as string | undefined;
        }
        const transfer = await stripe.transfers.create({
          amount: (a.amount_due ?? 0) * 100,
          currency: "usd",
          destination: priv.stripe_account_id,
          source_transaction: chargeId,
          metadata: { refee_job_id: a.job_id, refee_assignment_id: a.id },
        });
        await admin
          .from("job_assignments")
          .update({
            payout_status: "paid",
            paid_at: new Date().toISOString(),
            stripe_transfer_id: transfer.id,
          })
          .eq("id", a.id);
        released += 1;
      }
    }

    return json({ hasAccount: true, payoutsEnabled, released });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
