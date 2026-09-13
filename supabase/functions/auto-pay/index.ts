// Auto-charges the calling director's card on file for their unpaid
// completed / fee-cancelled games, then transfers each ref's share.
// Body: { jobId? } — one game, or all eligible games when omitted.
// Games whose charge fails fall back to the manual PAY CREW flow.
import { stripe, adminClient, getCaller, json, handleOptions, chargeTotal, decidePayment } from "../_shared/util.ts";
import { transferIdempotencyKey } from "../_shared/stripe-events.ts";

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

    // Eligible games: closed and not yet fully paid, mine.
    // 'processing' is included so a game whose charge succeeded but whose
    // transfer failed gets retried (transfers only) rather than re-charged.
    let gamesQuery = admin
      .from("jobs")
      .select("id, title, payment_status, payment_intent_id")
      .eq("hirer_id", hirer.id)
      .in("status", ["completed", "cancelled"])
      .in("payment_status", ["unpaid", "processing", "failed"]);
    if (jobId) gamesQuery = gamesQuery.eq("id", jobId);
    const { data: games } = await gamesQuery;

    const paid: Array<{ jobId: string; title: string; total: number; transferred: number; held: number }> = [];
    const skipped: Array<{ jobId: string; title: string; reason: string }> = [];

    for (const game of games ?? []) {
      // Reuse an already-succeeded charge if one exists (a prior run charged the
      // card but its transfer failed). This is what keeps a failed transfer from
      // ever causing a second charge.
      let chargeId: string | null = null;
      let piId = (game as { payment_intent_id: string | null }).payment_intent_id;
      if (piId) {
        try {
          const existing = await stripe.paymentIntents.retrieve(piId);
          if (existing.status === "succeeded") chargeId = existing.latest_charge as string;
        } catch { /* stale id — treat as no charge */ }
      }
      const { shouldCharge, resetToUnpaidOnError } = decidePayment(chargeId != null);

      // Lock unpaid → processing so concurrent runs don't both charge. Games we
      // already charged are 'processing'; we proceed straight to retrying transfers.
      if (game.payment_status === "unpaid" || game.payment_status === "failed") {
        const { data: locked } = await admin
          .from("jobs")
          .update({ payment_status: "processing" })
          .eq("id", game.id)
          .eq("payment_status", game.payment_status)
          .select("id");
        if (!locked || locked.length === 0) continue;
      }

      const { data: owed } = await admin
        .from("job_assignments")
        .select("id, ref_id, amount_due")
        .eq("job_id", game.id)
        .in("status", ["completed", "cancelled"])
        .eq("payout_status", "pending")
        .gt("amount_due", 0);

      const crewTotal = (owed ?? []).reduce((s, a) => s + (a.amount_due ?? 0), 0);
      if (crewTotal <= 0) {
        // nothing left to pay (all transferred/held) — close the loop
        await admin.from("jobs").update({ payment_status: "paid" }).eq("id", game.id);
        continue;
      }

      const total = chargeTotal(crewTotal);

      try {
        if (shouldCharge) {
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
          piId = intent.id;
          chargeId = intent.latest_charge as string;
          await admin.from("jobs").update({ payment_intent_id: piId }).eq("id", game.id);
        }

        // Transfer each ref's share, drawn from THIS charge (source_transaction)
        // so it works before the platform balance settles. Hold refs without a
        // payout account.
        let transferred = 0;
        let held = 0;
        for (const a of owed ?? []) {
          const { data: priv } = await admin
            .from("private_profiles")
            .select("stripe_account_id, stripe_account_status")
            .eq("id", a.ref_id)
            .maybeSingle();

          if (priv?.stripe_account_id && priv.stripe_account_status === "complete") {
            const transfer = await stripe.transfers.create(
              {
                amount: (a.amount_due ?? 0) * 100,
                currency: "usd",
                destination: priv.stripe_account_id,
                source_transaction: chargeId ?? undefined,
                metadata: {
                  refee_job_id: game.id,
                  refee_assignment_id: a.id,
                  refee_payment_intent_id: piId ?? "",
                },
              },
              { idempotencyKey: transferIdempotencyKey(a.id, piId ?? game.id) }
            );
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
      } catch (payErr) {
        // If we never charged, reset to 'unpaid' so a later run can retry cleanly.
        // If a charge already succeeded, KEEP 'processing' (the charge id is saved)
        // so the next run only retries the transfer — never a second charge.
        if (resetToUnpaidOnError) {
          await admin.from("jobs").update({ payment_status: "unpaid" }).eq("id", game.id);
        }
        skipped.push({
          jobId: game.id,
          title: game.title,
          reason: (payErr as Error).message,
        });
      }
    }

    return json({ paid, skipped, reason: null });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
