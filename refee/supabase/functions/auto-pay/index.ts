// Auto-charges the calling director's card on file for their unpaid
// completed / fee-cancelled games, then transfers each ref's share.
// Body: { jobId? } — one game, or all eligible games when omitted.
// Games whose charge fails fall back to the manual PAY CREW flow.
import { stripe, adminClient, getCaller, json, handleOptions, PLATFORM_FEE_PCT } from "../_shared/util.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { jobId } = await req.json().catch(() => ({}));
    const admin = adminClient();

    const { data: hirer } = await admin
      .from("hirers")
      .select("id, stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!hirer) return json({ error: "Director profile not found" }, 404);
    if (!hirer.stripe_customer_id) {
      return json({ paid: [], skipped: [], reason: "no_card" });
    }

    // Card on file?
    const pms = await stripe.customers.listPaymentMethods(hirer.stripe_customer_id, { limit: 1 });
    const paymentMethod = pms.data[0];
    if (!paymentMethod) {
      return json({ paid: [], skipped: [], reason: "no_card" });
    }

    // Eligible games: closed, unpaid, mine
    let gamesQuery = admin
      .from("jobs")
      .select("id, title")
      .eq("hirer_id", hirer.id)
      .in("status", ["completed", "cancelled"])
      .eq("payment_status", "unpaid");
    if (jobId) gamesQuery = gamesQuery.eq("id", jobId);
    const { data: games } = await gamesQuery;

    const paid: Array<{ jobId: string; title: string; total: number; transferred: number; held: number }> = [];
    const skipped: Array<{ jobId: string; title: string; reason: string }> = [];

    for (const game of games ?? []) {
      // Poor-man's lock: only proceed if we're the one flipping unpaid → processing
      const { data: locked } = await admin
        .from("jobs")
        .update({ payment_status: "processing" })
        .eq("id", game.id)
        .eq("payment_status", "unpaid")
        .select("id");
      if (!locked || locked.length === 0) continue;

      const { data: owed } = await admin
        .from("job_assignments")
        .select("id, ref_id, amount_due")
        .eq("job_id", game.id)
        .in("status", ["completed", "cancelled"])
        .eq("payout_status", "pending")
        .gt("amount_due", 0);

      const crewTotal = (owed ?? []).reduce((s, a) => s + (a.amount_due ?? 0), 0);
      if (crewTotal <= 0) {
        // nothing owed — close the loop so we don't retry forever
        await admin.from("jobs").update({ payment_status: "paid" }).eq("id", game.id);
        continue;
      }

      const total = crewTotal + Math.round(crewTotal * PLATFORM_FEE_PCT);

      try {
        const intent = await stripe.paymentIntents.create({
          amount: total * 100,
          currency: "usd",
          customer: hirer.stripe_customer_id,
          payment_method: paymentMethod.id,
          off_session: true,
          confirm: true,
          description: `Refee auto-pay — ${game.title}`,
          metadata: { refee_job_id: game.id },
        });

        if (intent.status !== "succeeded") {
          throw new Error(`Charge status: ${intent.status}`);
        }

        await admin
          .from("jobs")
          .update({ payment_intent_id: intent.id })
          .eq("id", game.id);

        // Transfer each ref's share (hold for refs without payout accounts)
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
              metadata: { refee_job_id: game.id, refee_assignment_id: a.id },
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
            await admin
              .from("job_assignments")
              .update({ payout_status: "processing" })
              .eq("id", a.id);
            held += 1;
          }
        }

        await admin.from("jobs").update({ payment_status: "paid" }).eq("id", game.id);
        paid.push({ jobId: game.id, title: game.title, total, transferred, held });
      } catch (chargeErr) {
        // Charge failed (declined, 3DS required off-session, etc.) —
        // release the lock so the manual PAY CREW flow can take over.
        await admin
          .from("jobs")
          .update({ payment_status: "unpaid" })
          .eq("id", game.id);
        skipped.push({
          jobId: game.id,
          title: game.title,
          reason: (chargeErr as Error).message,
        });
      }
    }

    return json({ paid, skipped, reason: null });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
