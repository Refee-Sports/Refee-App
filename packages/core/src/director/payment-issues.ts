import type { DirectorGameRow } from "./queries";
import { payoutDisplay } from "./game-status";

// Money problems a director needs to act on, read off the games they already
// loaded. Shown at the top of their dashboard so a declined card or an overdue
// crew payout isn't found only by opening each game.

export type PaymentIssueKind = "card_declined" | "payout_overdue" | "disputed" | "under_review" | "not_charged";

export type PaymentIssue = {
  gameId: string;
  title: string;
  kind: PaymentIssueKind;
  /** Needs the director now: the crew's pay is blocked or late. */
  urgent: boolean;
  message: string;
};

// Most pressing first.
const ORDER: PaymentIssueKind[] = ["card_declined", "payout_overdue", "disputed", "under_review", "not_charged"];

function issueFor(game: DirectorGameRow, now: number): Omit<PaymentIssue, "gameId" | "title"> | null {
  if (game.payment_status === "failed") {
    return { kind: "card_declined", urgent: true, message: "Your card was declined. Update it so the crew can be paid." };
  }
  if (game.payment_dispute_status === "open") {
    return { kind: "disputed", urgent: false, message: "This charge is disputed with your bank. Refee is reviewing it." };
  }
  if (game.payment_issue_requires_review) {
    const what = game.payment_review_reason === "dispute" ? "dispute" : "refund";
    return { kind: "under_review", urgent: false, message: `Refee is reviewing a ${what} on this game.` };
  }
  if (game.status === "completed") {
    const payout = payoutDisplay(game, now);
    if (payout.tone === "overdue") {
      return { kind: "payout_overdue", urgent: true, message: `Crew p${payout.label.slice(1)}` };
    }
    return null;
  }
  if (
    game.status !== "cancelled" &&
    game.prepay_required &&
    (game.payment_status == null || game.payment_status === "unpaid") &&
    new Date(game.starts_at).getTime() > now
  ) {
    return { kind: "not_charged", urgent: false, message: "Not charged yet. Save a card so this game can be booked." };
  }
  return null;
}

/** One issue per game at most, most pressing first. */
export function paymentIssues(games: DirectorGameRow[], now: number = Date.now()): PaymentIssue[] {
  return games
    .flatMap((game) => {
      const issue = issueFor(game, now);
      return issue ? [{ gameId: game.id, title: game.title, ...issue }] : [];
    })
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}
