import type Stripe from "npm:stripe@17";
import { adminClient, json, stripe } from "../_shared/util.ts";
import {
  reconciliationAction,
  closedDisputeStatus,
  refundStatus,
  transferIdempotencyKey,
} from "../_shared/stripe-events.ts";

type AdminClient = ReturnType<typeof adminClient>;

async function reserveEvent(admin: AdminClient, event: Stripe.Event): Promise<boolean> {
  const { error } = await admin.from("stripe_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
    status: "processing",
  });

  if (!error) return true;
  if (error.code !== "23505") throw new Error(error.message);

  const { data: existing, error: readError } = await admin
    .from("stripe_webhook_events")
    .select("status, received_at, attempts")
    .eq("event_id", event.id)
    .single();
  if (readError) throw new Error(readError.message);
  if (existing.status === "processed") return false;

  // A failed delivery can retry immediately. A processing delivery can be
  // reclaimed after five minutes in case the original worker died mid-event.
  const stale = Date.now() - new Date(existing.received_at).getTime() > 5 * 60_000;
  if (existing.status === "processing" && !stale) return false;

  const { error: retryError } = await admin
    .from("stripe_webhook_events")
    .update({
      status: "processing",
      attempts: (existing.attempts ?? 1) + 1,
      received_at: new Date().toISOString(),
      error: null,
    })
    .eq("event_id", event.id);
  if (retryError) throw new Error(retryError.message);
  return true;
}

async function settlePayment(admin: AdminClient, intent: Stripe.PaymentIntent) {
  const metadataJobId = intent.metadata?.refee_job_id;
  let query = admin.from("jobs").select("id, payment_status");
  query = metadataJobId
    ? query.eq("id", metadataJobId)
    : query.eq("payment_intent_id", intent.id);
  const { data: job, error: jobError } = await query.maybeSingle();
  if (jobError) throw new Error(jobError.message);
  if (!job) throw new Error(`No Refee job found for PaymentIntent ${intent.id}`);

  const chargeId = typeof intent.latest_charge === "string"
    ? intent.latest_charge
    : intent.latest_charge?.id;
  if (!chargeId) throw new Error(`PaymentIntent ${intent.id} has no charge`);

  if (intent.metadata?.refee_charge_kind === "prepay") {
    await recordPrepay(admin, job, intent, chargeId);
    return;
  }

  const now = new Date().toISOString();
  const { error: processingError } = await admin
    .from("jobs")
    .update({
      payment_intent_id: intent.id,
      stripe_charge_id: chargeId,
      payment_status: "processing",
      last_payment_event_at: now,
    })
    .eq("id", job.id);
  if (processingError) throw new Error(processingError.message);

  const { data: owed, error: owedError } = await admin
    .from("job_assignments")
    .select("id, ref_id, amount_due, payout_status, stripe_transfer_id")
    .eq("job_id", job.id)
    .in("status", ["completed", "cancelled"])
    .in("payout_status", ["pending", "failed"])
    .gt("amount_due", 0);
  if (owedError) throw new Error(owedError.message);

  for (const assignment of owed ?? []) {
    const { data: profile, error: profileError } = await admin
      .from("private_profiles")
      .select("stripe_account_id, stripe_account_status")
      .eq("id", assignment.ref_id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);

    if (profile?.stripe_account_id && profile.stripe_account_status === "complete") {
      const transfer = await stripe.transfers.create(
        {
          amount: (assignment.amount_due ?? 0) * 100,
          currency: "usd",
          destination: profile.stripe_account_id,
          source_transaction: chargeId,
          metadata: {
            refee_job_id: job.id,
            refee_assignment_id: assignment.id,
            refee_payment_intent_id: intent.id,
          },
        },
        { idempotencyKey: transferIdempotencyKey(assignment.id, intent.id) }
      );
      const { error: assignmentError } = await admin
        .from("job_assignments")
        .update({
          payout_status: "paid",
          paid_at: now,
          stripe_transfer_id: transfer.id,
        })
        .eq("id", assignment.id);
      if (assignmentError) throw new Error(assignmentError.message);
    } else {
      const { error: heldError } = await admin
        .from("job_assignments")
        .update({ payout_status: "processing" })
        .eq("id", assignment.id);
      if (heldError) throw new Error(heldError.message);
    }
  }

  const { error: paidError } = await admin
    .from("jobs")
    .update({ payment_status: "paid", last_payment_event_at: now })
    .eq("id", job.id);
  if (paidError) throw new Error(paidError.message);
}

/**
 * A charge taken when the game was created. Nobody is owed anything yet — the
 * crew is paid from it when the game completes (run-payouts) — so record the
 * charge and leave the game "prepaid". Marking it paid here, as a post-game
 * charge would be, would stop the payout from ever running.
 */
async function recordPrepay(
  admin: AdminClient,
  job: { id: string; payment_status: string | null },
  intent: Stripe.PaymentIntent,
  chargeId: string
) {
  if (["paid", "refunded", "disputed"].includes(job.payment_status ?? "")) return;
  const now = new Date().toISOString();
  const { error } = await admin
    .from("jobs")
    .update({
      payment_intent_id: intent.id,
      stripe_charge_id: chargeId,
      payment_status: "prepaid",
      prepaid_crew_cents: Number(intent.metadata?.crew_cents ?? 0),
      prepaid_fee_cents: Number(intent.metadata?.fee_cents ?? 0),
      last_payment_event_at: now,
    })
    .eq("id", job.id);
  if (error) throw new Error(error.message);
  await admin.from("jobs").update({ prepaid_at: now }).eq("id", job.id).is("prepaid_at", null);
}

function stripeId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function findJobForStripePayment(
  admin: AdminClient,
  paymentIntentId: string | null,
  chargeId: string | null,
  metadataJobId?: string
) {
  let query = admin
    .from("jobs")
    .select("id, payment_refund_status, payment_dispute_status");
  if (metadataJobId) query = query.eq("id", metadataJobId);
  else if (paymentIntentId) query = query.eq("payment_intent_id", paymentIntentId);
  else if (chargeId) query = query.eq("stripe_charge_id", chargeId);
  else throw new Error("Stripe event has no Refee payment reference");

  const { data: job, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!job) {
    throw new Error(`No Refee job found for ${paymentIntentId ?? chargeId ?? metadataJobId}`);
  }
  return job;
}

async function markChargeRefunded(admin: AdminClient, charge: Stripe.Charge) {
  const paymentIntentId = stripeId(charge.payment_intent);
  const job = await findJobForStripePayment(
    admin,
    paymentIntentId,
    charge.id,
    charge.metadata?.refee_job_id
  );
  const status = refundStatus(charge.amount, charge.amount_refunded);
  const now = new Date().toISOString();

  // Refunds run-payouts made for crew slots nobody filled are part of the
  // normal settlement, not a problem: record the amount, leave the status and
  // review flags to the payout run that made them.
  const refunds = await stripe.refunds.list({ charge: charge.id, limit: 20 });
  const plannedOnly =
    refunds.data.length > 0 &&
    refunds.data.every((r) => r.metadata?.refee_refund_kind === "unused_prepay");
  if (plannedOnly) {
    const { error: plannedError } = await admin
      .from("jobs")
      .update({
        stripe_charge_id: charge.id,
        payment_refund_status: status,
        refunded_amount_cents: charge.amount_refunded,
        last_payment_event_at: now,
      })
      .eq("id", job.id);
    if (plannedError) throw new Error(plannedError.message);
    return;
  }

  const { error } = await admin
    .from("jobs")
    .update({
      stripe_charge_id: charge.id,
      payment_status: status === "full" ? "refunded" : "paid",
      payment_refund_status: status,
      refunded_amount_cents: charge.amount_refunded,
      payment_issue_requires_review: true,
      payment_review_reason: "refund",
      last_payment_event_at: now,
    })
    .eq("id", job.id);
  if (error) throw new Error(error.message);
}

async function resolveDisputeCharge(dispute: Stripe.Dispute) {
  const embedded = typeof dispute.charge === "object" ? dispute.charge : null;
  if (embedded) return embedded;
  const chargeId = stripeId(dispute.charge);
  if (!chargeId) throw new Error(`Dispute ${dispute.id} has no charge`);
  return await stripe.charges.retrieve(chargeId);
}

async function reconcileDispute(
  admin: AdminClient,
  dispute: Stripe.Dispute,
  closed: boolean
) {
  const charge = await resolveDisputeCharge(dispute);
  const paymentIntentId = stripeId(charge.payment_intent);
  const job = await findJobForStripePayment(
    admin,
    paymentIntentId,
    charge.id,
    charge.metadata?.refee_job_id
  );
  const disputeStatus = closed ? closedDisputeStatus(dispute.status) : "open";
  const won = disputeStatus === "won";
  const hasRefund = job.payment_refund_status !== "none";
  const now = new Date().toISOString();
  const { error } = await admin
    .from("jobs")
    .update({
      stripe_charge_id: charge.id,
      stripe_dispute_id: dispute.id,
      payment_status: won
        ? job.payment_refund_status === "full" ? "refunded" : "paid"
        : "disputed",
      payment_dispute_status: disputeStatus,
      payment_issue_requires_review: !won || hasRefund,
      payment_review_reason: !won ? "dispute" : hasRefund ? "refund" : null,
      last_payment_event_at: now,
    })
    .eq("id", job.id);
  if (error) throw new Error(error.message);
}

async function markPaymentFailed(admin: AdminClient, intent: Stripe.PaymentIntent) {
  const now = new Date().toISOString();
  let query = admin
    .from("jobs")
    .update({ payment_status: "failed", last_payment_event_at: now })
    .neq("payment_status", "paid");
  query = intent.metadata?.refee_job_id
    ? query.eq("id", intent.metadata.refee_job_id)
    : query.eq("payment_intent_id", intent.id);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

async function reconcileTransfer(
  admin: AdminClient,
  transfer: Stripe.Transfer,
  reversed: boolean
) {
  const assignmentId = transfer.metadata?.refee_assignment_id;
  if (!assignmentId) return;
  const now = new Date().toISOString();
  const { data: assignment, error } = await admin
    .from("job_assignments")
    .update(
      reversed
        ? { payout_status: "failed", paid_at: null }
        : { payout_status: "paid", paid_at: now, stripe_transfer_id: transfer.id }
    )
    .eq("id", assignmentId)
    .select("job_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (reversed && assignment?.job_id) {
    const { error: jobError } = await admin
      .from("jobs")
      .update({ payment_status: "processing", last_payment_event_at: now })
      .eq("id", assignment.job_id);
    if (jobError) throw new Error(jobError.message);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const signature = req.headers.get("stripe-signature");
  if (!webhookSecret || !signature) return json({ error: "Webhook is not configured" }, 400);

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (error) {
    return json({ error: `Invalid Stripe signature: ${(error as Error).message}` }, 400);
  }

  const admin = adminClient();
  try {
    const shouldProcess = await reserveEvent(admin, event);
    if (!shouldProcess) return json({ received: true, duplicate: true });

    const action = reconciliationAction(event.type);
    if (action === "settle_payment") {
      await settlePayment(admin, event.data.object as Stripe.PaymentIntent);
    } else if (action === "mark_payment_failed") {
      await markPaymentFailed(admin, event.data.object as Stripe.PaymentIntent);
    } else if (action === "mark_transfer_paid" || action === "mark_transfer_reversed") {
      const transfer = event.data.object as Stripe.Transfer;
      const fullyReversed = action === "mark_transfer_reversed"
        || (transfer.amount_reversed ?? 0) >= transfer.amount;
      await reconcileTransfer(admin, transfer, fullyReversed);
    } else if (action === "mark_charge_refunded") {
      await markChargeRefunded(admin, event.data.object as Stripe.Charge);
    } else if (action === "mark_dispute_opened" || action === "mark_dispute_closed") {
      await reconcileDispute(
        admin,
        event.data.object as Stripe.Dispute,
        action === "mark_dispute_closed"
      );
    }

    const { error: ledgerError } = await admin
      .from("stripe_webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString(), error: null })
      .eq("event_id", event.id);
    if (ledgerError) throw new Error(ledgerError.message);

    return json({ received: true, action });
  } catch (error) {
    await admin
      .from("stripe_webhook_events")
      .update({ status: "failed", error: (error as Error).message.slice(0, 1000) })
      .eq("event_id", event.id);
    return json({ error: (error as Error).message }, 500);
  }
});
