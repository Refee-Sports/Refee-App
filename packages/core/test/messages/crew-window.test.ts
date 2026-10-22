import { describe, expect, it } from "vitest";
import { crewChatOpen } from "@refee/core/messages/permissions";
import { crewNoteAllowed } from "@refee/core/director/payment-issues";
import type { DirectorGameRow } from "@refee/core/director/queries";

// Crew messaging closes 24 hours after the game's scheduled end (start + its
// length, 2 hours if unset). After that a director can still send the crew a
// note only while the game has a payment issue.
const at = (iso: string) => Date.parse(iso);
const game = {
  id: "g",
  title: "Game",
  status: "completed",
  starts_at: "2026-10-20T18:00:00Z",
  duration_minutes: 90, // ends 19:30Z, closes 2026-10-21T19:30Z
  completed_at: "2026-10-20T19:30:00Z",
  payout_window_hours: 48,
  payment_status: "paid",
  refPayouts: ["paid", "paid"],
} as unknown as DirectorGameRow;

describe("crewChatOpen", () => {
  it("stays open until 24 hours after the scheduled end", () => {
    expect(crewChatOpen(game, at("2026-10-21T19:29:00Z"))).toBe(true);
    expect(crewChatOpen(game, at("2026-10-21T19:31:00Z"))).toBe(false);
  });
  it("uses a 2-hour game when the length isn't set", () => {
    const g = { starts_at: "2026-10-20T18:00:00Z", duration_minutes: null };
    expect(crewChatOpen(g, at("2026-10-21T19:59:00Z"))).toBe(true);
    expect(crewChatOpen(g, at("2026-10-21T20:01:00Z"))).toBe(false);
  });
});

describe("crewNoteAllowed", () => {
  const later = at("2026-10-25T12:00:00Z");
  it("is allowed while the crew chat is open", () => {
    expect(crewNoteAllowed(game, at("2026-10-21T12:00:00Z"))).toBe(true);
  });
  it("closes with the chat when the crew was paid", () => {
    expect(crewNoteAllowed(game, later)).toBe(false);
  });
  it("stays open for a payment issue: overdue payout, declined card, dispute, review", () => {
    expect(crewNoteAllowed({ ...game, refPayouts: ["paid", "pending"] }, later)).toBe(true);
    expect(crewNoteAllowed({ ...game, payment_status: "failed" }, later)).toBe(true);
    expect(crewNoteAllowed({ ...game, payment_dispute_status: "open" } as DirectorGameRow, later)).toBe(true);
    expect(crewNoteAllowed({ ...game, payment_issue_requires_review: true } as DirectorGameRow, later)).toBe(true);
  });
});
