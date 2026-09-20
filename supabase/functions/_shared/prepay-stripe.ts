// Stripe side of "charge at creation, pay out after completion". Shared by
// prepay-game (the director's app, right after creating a game) and
// run-payouts (pg_cron, every 15 minutes).
import { adminClient, stripe } from "./util.ts";
import { prepayQuote, prepaySettlement } from "./prepay.ts";
import { transferIdempotencyKey } from "./stripe-events.ts";

type Admin = ReturnType<typeof adminClient>;

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

function chargeIdOf(latest: unknown): string | null {
  if (!latest) return null;
  return typeof latest === "string" ? latest : ((latest as { id?: string }).id ?? null);
}

export type PrepayOutcome =
  | { status: "prepaid"; totalCents: number; alreadyPrepaid: boolean }
  | { status: "no_card" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

/**
 * Charge a game's full crew cost (every slot at the posted pay, plus the
 * platform fee) to the director's saved card.
 *
 * Only games still open for staffing and not yet charged. Safe to call twice:
 * the game is claimed before the charge, and a game already prepaid returns
 * as such without a second charge.
 */
export async function chargeGameUpFront(admin: Admin, jobId: string): Promise<PrepayOutcome> {
  const { data: job, error } = await admin
    .from("jobs")
    .select(
      "id, title, status, crew_size, pay_per_game, num_games, payment_status, prepaid_crew_cents, prepaid_fee_cents, hirers(hirer_billing(stripe_customer_id))"
    )
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!job) return { status: "skipped", reason: "Game not found" };

  if (job.payment_status === "prepaid" || job.payment_status === "paid") {
    return {
      status: "prepaid",
      totalCents: (job.prepaid_crew_cents ?? 0) + (job.prepaid_fee_cents ?? 0),
      alreadyPrepaid: true,
    };
  }
  if (job.status === "completed" || job.status === "cancelled") {
    return { status: "skipped", reason: "Game is already closed" };
  }
  const retrying = job.payment_status === "failed";
  if (job.payment_status && job.payment_status !== "unpaid" && !retrying) {
    return { status: "skipped", reason: `Payment is ${job.payment_status}` };
  }

  // Billing handle is backend-only (0048), nested under the hirer.
  const customerId = one<{ stripe_customer_id: string | null }>(
    one<{ hirer_billing: unknown }>(job.hirers)?.hirer_billing
  )?.stripe_customer_id;
  if (!customerId) return { status: "no_card" };
  const methods = await stripe.customers.listPaymentMethods(customerId, { limit: 1 });
  const paymentMethod = methods.data[0];
  if (!paymentMethod) return { status: "no_card" };

  const quote = prepayQuote(job.crew_size ?? 0, job.pay_per_game ?? 0, job.num_games ?? 1);
  if (quote.totalCents <= 0) return { status: "skipped", reason: "Nothing to charge" };

  // Claim the game so two callers (the app and the scheduler) can't both charge it.
  const { data: claimed, error: claimError } = await admin
    .from("jobs")
    .update({ payment_status: "processing" })
    .eq("id", job.id)
    .or("payment_status.is.null,payment_status.in.(unpaid,failed)")
    .select("id");
  if (claimError) throw new Error(claimError.message);
  if (!claimed || claimed.length === 0) return { status: "skipped", reason: "Already being charged" };

  const now = new Date().toISOString();
  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: quote.totalCents,
        currency: "usd",
        customer: customerId,
        payment_method: paymentMethod.id,
        off_session: true,
        confirm: true,
        description: `Refee — ${job.title} (charged at booking)`,
        metadata: {
          refee_job_id: job.id,
          refee_charge_kind: "prepay",
          crew_cents: String(quote.crewCents),
          fee_cents: String(quote.feeCents),
        },
      },
      // A retry after a decline needs a fresh key, or Stripe replays the decline.
      { idempotencyKey: `refee-prepay-${job.id}${retrying ? `-${Date.now()}` : ""}` }
    );
    if (intent.status !== "succeeded") throw new Error(`Charge status: ${intent.status}`);

    const { error: saveError } = await admin
      .from("jobs")
      .update({
        payment_status: "prepaid",
        payment_intent_id: intent.id,
        stripe_charge_id: chargeIdOf(intent.latest_charge),
        prepaid_crew_cents: quote.crewCents,
        prepaid_fee_cents: quote.feeCents,
        prepaid_at: now,
        last_payment_event_at: now,
      })
      .eq("id", job.id);
    if (saveError) throw new Error(saveError.message);
    return { status: "prepaid", totalCents: quote.totalCents, alreadyPrepaid: false };
  } catch (e) {
    await admin
      .from("jobs")
      .update({ payment_status: "failed", last_payment_event_at: now })
      .eq("id", job.id)
      .eq("payment_status", "processing");
    return { status: "failed", reason: (e as Error).message };
  }
}

export type SettleOutcome = {
  jobId: string;
  transferred: number;
  held: number;
  refundedCents: number;
  flagged?: string;
};

/**
 * Settle a prepaid game once it has completed or been cancelled: pay each ref
 * their amount_due out of the up-front charge, then refund what nobody earned.
 *
 * Refs without a payout account are held (payout_status 'processing') and
 * released when they finish onboarding, as elsewhere. Every Stripe call is
 * idempotent, so a run that dies half way is safe to repeat.
 */
export async function settlePrepaidGame(admin: Admin, jobId: string): Promise<SettleOutcome> {
  const { data: job, error } = await admin
    .from("jobs")
    .select(
      "id, status, payment_status, payment_intent_id, stripe_charge_id, prepaid_crew_cents, prepaid_fee_cents, refunded_amount_cents"
    )
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const outcome: SettleOutcome = { jobId, transferred: 0, held: 0, refundedCents: 0 };
  if (!job || job.payment_status !== "prepaid") return outcome;
  if (job.status !== "completed" && job.status !== "cancelled") return outcome;
  if (!job.payment_intent_id) return { ...outcome, flagged: "prepaid game has no PaymentIntent" };

  const chargeId =
    job.stripe_charge_id ??
    chargeIdOf((await stripe.paymentIntents.retrieve(job.payment_intent_id)).latest_charge);

  const { data: rows, error: rowsError } = await admin
    .from("job_assignments")
    .select("id, ref_id, amount_due, payout_status")
    .eq("job_id", job.id)
    .in("status", ["completed", "cancelled"])
    .gt("amount_due", 0);
  if (rowsError) throw new Error(rowsError.message);

  const owedCents = (rows ?? []).reduce((sum, a) => sum + (a.amount_due ?? 0) * 100, 0);
  const settlement = prepaySettlement(
    { crewCents: job.prepaid_crew_cents ?? 0, feeCents: job.prepaid_fee_cents ?? 0 },
    owedCents
  );
  if (settlement.shortfallCents > 0) {
    await admin
      .from("jobs")
      .update({ payment_issue_requires_review: true, payment_review_reason: "prepay_shortfall" })
      .eq("id", job.id);
    return { ...outcome, flagged: `owed $${settlement.shortfallCents / 100} more than was charged` };
  }

  const now = new Date().toISOString();
  for (const a of rows ?? []) {
    if (a.payout_status !== "pending" && a.payout_status !== "failed") continue;
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
            refee_job_id: job.id,
            refee_assignment_id: a.id,
            refee_payment_intent_id: job.payment_intent_id,
          },
        },
        { idempotencyKey: transferIdempotencyKey(a.id, job.payment_intent_id) }
      );
      await admin
        .from("job_assignments")
        .update({ payout_status: "paid", paid_at: now, stripe_transfer_id: transfer.id })
        .eq("id", a.id);
      outcome.transferred += 1;
    } else {
      await admin.from("job_assignments").update({ payout_status: "processing" }).eq("id", a.id);
      outcome.held += 1;
    }
  }

  const totalCents = (job.prepaid_crew_cents ?? 0) + (job.prepaid_fee_cents ?? 0);
  if (settlement.refundCents > 0 && (job.refunded_amount_cents ?? 0) === 0) {
    await stripe.refunds.create(
      {
        payment_intent: job.payment_intent_id,
        amount: settlement.refundCents,
        metadata: { refee_job_id: job.id, refee_refund_kind: "unused_prepay" },
      },
      { idempotencyKey: `refee-prepay-refund-${job.id}` }
    );
    outcome.refundedCents = settlement.refundCents;
  }

  const refunded = outcome.refundedCents || (job.refunded_amount_cents ?? 0);
  await admin
    .from("jobs")
    .update({
      payment_status: owedCents === 0 && refunded >= totalCents ? "refunded" : "paid",
      refunded_amount_cents: refunded,
      payment_refund_status: refunded === 0 ? "none" : refunded >= totalCents ? "full" : "partial",
      last_payment_event_at: now,
    })
    .eq("id", job.id);

  return outcome;
}
