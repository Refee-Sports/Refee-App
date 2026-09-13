export type StripeReconciliationAction =
  | "settle_payment"
  | "mark_payment_failed"
  | "mark_transfer_paid"
  | "mark_transfer_reversed"
  | "mark_charge_refunded"
  | "mark_dispute_opened"
  | "mark_dispute_closed"
  | "ignore";

/** Pure routing table kept separate so webhook coverage runs under Vitest. */
export function reconciliationAction(eventType: string): StripeReconciliationAction {
  switch (eventType) {
    case "payment_intent.succeeded":
      return "settle_payment";
    case "payment_intent.payment_failed":
      return "mark_payment_failed";
    case "transfer.created":
      return "mark_transfer_paid";
    case "transfer.reversed":
      return "mark_transfer_reversed";
    case "transfer.updated":
      return "mark_transfer_paid";
    case "charge.refunded":
      return "mark_charge_refunded";
    case "charge.dispute.created":
      return "mark_dispute_opened";
    case "charge.dispute.closed":
      return "mark_dispute_closed";
    default:
      return "ignore";
  }
}

export type RefundStatus = "partial" | "full";

export function refundStatus(amount: number, amountRefunded: number): RefundStatus {
  return amountRefunded >= amount ? "full" : "partial";
}

export type ClosedDisputeStatus = "won" | "lost";

export function closedDisputeStatus(status: string): ClosedDisputeStatus {
  return status === "won" ? "won" : "lost";
}

export function transferIdempotencyKey(assignmentId: string, paymentIntentId: string): string {
  return `refee-transfer-${assignmentId}-${paymentIntentId}`;
}
