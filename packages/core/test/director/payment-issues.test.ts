import { describe, expect, it } from "vitest";
import { issuesPanelOpen, paymentIssues } from "@refee/core/director/payment-issues";
import type { DirectorGameRow } from "@refee/core/director/queries";

const NOW = Date.parse("2026-10-15T12:00:00Z");

const game = (patch: Partial<DirectorGameRow> & Record<string, unknown>) =>
  ({
    id: "g1",
    title: "Lions vs Tigers",
    status: "open",
    crew_size: 2,
    starts_at: "2026-10-20T17:00:00Z",
    duration_minutes: 60,
    timezone: "America/New_York",
    payment_status: "prepaid",
    payment_dispute_status: "none",
    payment_issue_requires_review: false,
    prepay_required: true,
    refPayouts: [],
    ...patch,
  }) as unknown as DirectorGameRow;

describe("paymentIssues", () => {
  it("finds nothing wrong with a paid-up game", () => {
    expect(paymentIssues([game({})], NOW)).toEqual([]);
  });

  it("flags a declined card first, since the crew can't be paid until it's fixed", () => {
    const issues = paymentIssues(
      [game({ id: "unpaid", payment_status: "unpaid" }), game({ id: "declined", payment_status: "failed" })],
      NOW
    );
    expect(issues.map((i) => i.gameId)).toEqual(["declined", "unpaid"]);
    expect(issues[0]).toMatchObject({ kind: "card_declined", urgent: true, title: "Lions vs Tigers" });
    expect(issues[0].message).toBe("Your card was declined. Update it so the crew can be paid.");
  });

  it("flags an upcoming game that was never charged", () => {
    expect(paymentIssues([game({ payment_status: "unpaid" })], NOW)[0]).toMatchObject({
      kind: "not_charged",
      urgent: false,
      message: "Not charged yet. Save a card so this game can be booked.",
    });
    // Older games that predate charging at booking aren't expected to be prepaid.
    expect(paymentIssues([game({ payment_status: "unpaid", prepay_required: false })], NOW)).toEqual([]);
  });

  it("ignores games that are over or called off unless money is still wrong", () => {
    expect(paymentIssues([game({ status: "cancelled", payment_status: "unpaid" })], NOW)).toEqual([]);
    expect(paymentIssues([game({ status: "completed", payment_status: "failed" })], NOW)[0].kind).toBe("card_declined");
  });

  it("flags an open dispute, and a refund or dispute Refee is reviewing", () => {
    expect(paymentIssues([game({ payment_dispute_status: "open" })], NOW)[0]).toMatchObject({
      kind: "disputed",
      message: "This charge is disputed with your bank. Refee is reviewing it.",
    });
    expect(
      paymentIssues([game({ payment_issue_requires_review: true, payment_review_reason: "refund" })], NOW)[0]
    ).toMatchObject({ kind: "under_review", message: "Refee is reviewing a refund on this game." });
    // One message per game: the dispute already says it's under review.
    expect(
      paymentIssues([game({ payment_dispute_status: "open", payment_issue_requires_review: true })], NOW)
    ).toHaveLength(1);
  });

  it("flags crew pay that is past due", () => {
    const finished = game({
      status: "completed",
      starts_at: "2026-10-01T17:00:00Z",
      completed_at: "2026-10-01T19:00:00Z",
      payout_window_hours: 48,
      refPayouts: ["pending"],
    });
    expect(paymentIssues([finished], NOW)[0]).toMatchObject({
      kind: "payout_overdue",
      urgent: true,
      message: "Crew payout overdue · was due SAT, OCT 3",
    });
  });
});

describe("collapsing the payment-issues panel", () => {
  it("stays open until the director minimizes it", () => {
    expect(issuesPanelOpen(null, 3)).toBe(true);
  });
  it("stays minimized while the issues are the ones they already saw", () => {
    expect(issuesPanelOpen(3, 3)).toBe(false);
    expect(issuesPanelOpen(3, 2)).toBe(false);
  });
  it("opens again when a new issue arrives", () => {
    expect(issuesPanelOpen(3, 4)).toBe(true);
  });
});
