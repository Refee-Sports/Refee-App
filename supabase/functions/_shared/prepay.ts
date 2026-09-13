// Pure maths for charging a game up front ("prepay") and settling it once the
// game is over. No runtime deps, so it imports in Deno (with the .ts
// extension) and in the Node/Vitest unit tests alike — same as pay-math.ts.
//
// The agreement: directors are charged when they create a game, and refs are
// paid within 48 hours of it completing. Money in cents here because refunds
// of a partial fee rarely land on whole dollars.
import { platformFee } from "./pay-math.ts";

export type PrepayQuote = {
  /** Every crew slot at the posted pay. */
  crewCents: number;
  /** Platform fee on that crew total. */
  feeCents: number;
  totalCents: number;
};

/** What to charge when a game is created: the full crew, plus the fee. */
export function prepayQuote(crewSize: number, payPerGame: number, numGames = 1): PrepayQuote {
  const crewDollars = Math.max(0, crewSize) * Math.max(0, payPerGame) * Math.max(1, numGames);
  const feeDollars = platformFee(crewDollars);
  return {
    crewCents: crewDollars * 100,
    feeCents: feeDollars * 100,
    totalCents: (crewDollars + feeDollars) * 100,
  };
}

export type PrepaySettlement = {
  /** Unearned crew money plus the matching share of the fee, given back. */
  refundCents: number;
  /** Owed more than was collected — needs a person to look at it. */
  shortfallCents: number;
};

/**
 * Settle an up-front charge against what the crew actually earned.
 *
 * Slots nobody filled, refs who were dropped, a cancellation with no fee:
 * that crew money comes back in full, and so does the matching share of the
 * platform fee — the fee is only kept on pay that actually went out.
 *
 * If the crew is owed more than was collected (the director raised the pay
 * or crew size after being charged), nothing is refunded and the shortfall is
 * reported instead of drawing past the charge.
 */
export function prepaySettlement(
  prepaid: { crewCents: number; feeCents: number },
  owedCrewCents: number
): PrepaySettlement {
  const owed = Math.max(0, owedCrewCents);
  if (owed > prepaid.crewCents) {
    return { refundCents: 0, shortfallCents: owed - prepaid.crewCents };
  }
  const keptFee =
    prepaid.crewCents === 0 ? 0 : Math.round((prepaid.feeCents * owed) / prepaid.crewCents);
  return {
    refundCents: prepaid.crewCents - owed + (prepaid.feeCents - keptFee),
    shortfallCents: 0,
  };
}
