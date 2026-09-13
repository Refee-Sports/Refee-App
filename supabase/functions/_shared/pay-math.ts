// Pure payout math + idempotency decisions, shared by the pay edge functions.
// No runtime deps so it imports cleanly in both Deno (with a .ts extension)
// and the Node/Vitest unit tests.

/** Platform take rate charged to the director on top of crew pay.
 *  NOTE: 5% for now — revisit pricing before launch (see LAUNCH_CHECKLIST.md). */
export const PLATFORM_FEE_PCT = 0.05;

/** Platform fee (whole dollars) for a given crew total. */
export function platformFee(crewTotal: number, pct: number = PLATFORM_FEE_PCT): number {
  return Math.round(crewTotal * pct);
}

/** Amount to charge the director (whole dollars): crew pay + platform fee. */
export function chargeTotal(crewTotal: number, pct: number = PLATFORM_FEE_PCT): number {
  return crewTotal + platformFee(crewTotal, pct);
}

export type PaymentDecision = {
  /** Create a new PaymentIntent (charge the card)? */
  shouldCharge: boolean;
  /** On a downstream failure, reset the job to 'unpaid' so a later run retries? */
  resetToUnpaidOnError: boolean;
};

/**
 * Decide how auto-pay should treat a game, given whether a PaymentIntent has
 * ALREADY succeeded for it.
 *
 * - No successful charge yet → charge; if anything fails, reset to 'unpaid' so a
 *   later run can retry the whole thing.
 * - A charge already succeeded (we're only retrying the transfers) → never charge
 *   again, and on error stay 'processing' rather than resetting to 'unpaid'. This
 *   is what prevents a failed transfer from causing a double-charge.
 */
export function decidePayment(hasSucceededCharge: boolean): PaymentDecision {
  return hasSucceededCharge
    ? { shouldCharge: false, resetToUnpaidOnError: false }
    : { shouldCharge: true, resetToUnpaidOnError: true };
}
