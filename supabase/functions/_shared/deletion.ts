// When a game can be deleted outright rather than cancelled. Pure, so the unit
// tests run it in Node (apps/mobile/lib/payments/deletion.test.ts).
//
// The rule: until a referee accepts, a director (or the tournament's accepted
// assignor) can delete. Money changes nothing for them — a booking charge is
// refunded in full first — but a charge in flight, a payout, a dispute or a
// payment under review has to be settled before the game can go.

export type DeletableGame = {
  title: string;
  status: string;
  payment_status: string | null;
  refunded_amount_cents: number | null;
  payment_dispute_status?: string | null;
  payment_issue_requires_review?: boolean | null;
};

/** Why this game can't be deleted, or null when it can. */
export function deletionBlocker(g: DeletableGame, acceptedRefs: number): string | null {
  const name = `"${g.title}"`;
  if (acceptedRefs > 0) {
    return `A referee has accepted ${name}, so it can't be deleted. Cancel it instead.`;
  }
  if (g.status === "completed") return `${name} has been played. Completed games can't be deleted.`;
  if (g.payment_status === "processing") return `${name} is being charged right now. Try again in a minute.`;
  if (g.payment_status === "paid") return `${name} has already paid out, so it can't be deleted.`;
  if (g.payment_dispute_status === "open") return `${name} has an open payment dispute, so it can't be deleted.`;
  if (g.payment_issue_requires_review) return `${name} has a payment under review. Contact Refee support.`;
  return null;
}

/** A booking charge that hasn't been refunded yet; refunded in full before the game is deleted. */
export function needsRefund(g: Pick<DeletableGame, "payment_status" | "refunded_amount_cents">): boolean {
  return g.payment_status === "prepaid" && (g.refunded_amount_cents ?? 0) === 0;
}
