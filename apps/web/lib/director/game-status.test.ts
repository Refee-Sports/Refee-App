import { describe, expect, it } from "vitest";
import type { DirectorGameRow } from "@/lib/director/queries";
import { gameStatusDisplay, isClosedGame, payoutDisplay } from "./game-status";

const game = (patch: Partial<DirectorGameRow> & Record<string, unknown>) =>
  ({
    status: "completed",
    crew_size: 2,
    starts_at: "2026-09-20T17:00:00Z",
    duration_minutes: 60,
    completed_at: "2026-09-20T22:00:00Z",
    payout_window_hours: 48,
    timezone: "America/New_York",
    refPayouts: ["pending", "pending"],
    ...patch,
  }) as unknown as DirectorGameRow;

describe("gameStatusDisplay", () => {
  it("shows finished games as finished, whatever the crew count", () => {
    expect(gameStatusDisplay({ status: "completed", crew_size: 2, confirmedCount: 0 }).key).toBe("completed");
    expect(gameStatusDisplay({ status: "cancelled", crew_size: 2, confirmedCount: 2 }).key).toBe("cancelled");
  });

  it("works staffing out from confirmed refs, not the stored status", () => {
    expect(gameStatusDisplay({ status: "open", crew_size: 3, confirmedCount: 3 }).key).toBe("staffed");
    expect(gameStatusDisplay({ status: "staffed", crew_size: 3, confirmedCount: 0 }).key).toBe("open");
    const partial = gameStatusDisplay({ status: "open", crew_size: 3, confirmedCount: 1 });
    expect(partial).toMatchObject({ key: "partial", label: "Partially filled · 1/3" });
  });

  it("treats more confirmed refs than slots as staffed", () => {
    expect(gameStatusDisplay({ status: "open", crew_size: 2, confirmedCount: 3 }).key).toBe("staffed");
  });

  it("assumes a crew of one when the size is missing", () => {
    expect(gameStatusDisplay({ status: "open", crew_size: null, confirmedCount: 1 } as never).key).toBe("staffed");
  });

  it("falls back to the stored status when no counts were loaded", () => {
    expect(gameStatusDisplay({ status: "staffed", crew_size: 2 }).key).toBe("staffed");
    expect(gameStatusDisplay({ status: "partially_filled", crew_size: 2 }).label).toBe("Partially filled");
    expect(gameStatusDisplay({ status: "open", crew_size: 2 }).key).toBe("open");
    expect(gameStatusDisplay({ status: "something_new", crew_size: 2 }).key).toBe("open");
  });

  it("keeps the partial chip readable (ink text on yellow)", () => {
    expect(gameStatusDisplay({ status: "open", crew_size: 2, confirmedCount: 1 }).chip).toContain("text-ink");
  });
});

describe("isClosedGame", () => {
  it("is true only for completed and cancelled", () => {
    expect(isClosedGame("completed")).toBe(true);
    expect(isClosedGame("cancelled")).toBe(true);
    for (const s of ["open", "staffed", "partially_filled", "in_progress", ""]) expect(isClosedGame(s)).toBe(false);
  });
});

describe("payoutDisplay", () => {
  const before = Date.parse("2026-09-21T12:00:00Z");

  it("says nothing is owed when there's no crew to pay", () => {
    expect(payoutDisplay(game({ refPayouts: [] }), before)).toEqual({ tone: "none", label: "No crew payout owed" });
    expect(payoutDisplay(game({ refPayouts: undefined }), before).tone).toBe("none");
    expect(payoutDisplay(game({ status: "cancelled", refPayouts: [] }), before).label).toBe("Cancelled · no fee owed");
  });

  it("confirms payment, with singular and plural wording", () => {
    expect(payoutDisplay(game({ refPayouts: ["paid"] }), before)).toEqual({ tone: "paid", label: "✓ Ref paid" });
    expect(payoutDisplay(game({ refPayouts: ["paid", "paid", "paid"] }), before).label).toBe("✓ All 3 refs paid");
  });

  it("marks money as held while a transfer is still processing", () => {
    expect(payoutDisplay(game({ refPayouts: ["paid", "processing"] }), before).tone).toBe("held");
  });

  it("gives the deadline in the venue's time zone", () => {
    // Completed 22:00 UTC Sep 20 + 48h = 22:00 UTC Sep 22 → Tue Sep 22 in New York.
    expect(payoutDisplay(game({}), before)).toEqual({ tone: "due", label: "Refs paid by TUE, SEP 22" });
    // 02:00 UTC Sep 23 is still the evening of Tue Sep 22 in Los Angeles.
    const lateWest = game({ completed_at: "2026-09-21T02:00:00Z", timezone: "America/Los_Angeles" });
    expect(payoutDisplay(lateWest, before).label).toBe("Refs paid by TUE, SEP 22");
  });

  it("turns overdue the moment the window closes", () => {
    const deadline = Date.parse("2026-09-22T22:00:00Z");
    expect(payoutDisplay(game({}), deadline).tone).toBe("due");
    expect(payoutDisplay(game({}), deadline + 1).tone).toBe("overdue");
    expect(payoutDisplay(game({}), deadline + 1).label).toBe("Payout overdue · was due TUE, SEP 22");
  });

  it("honors a game's own payout window", () => {
    const deadline72 = Date.parse("2026-09-23T22:00:00Z");
    expect(payoutDisplay(game({ payout_window_hours: 72 }), deadline72 - 1).tone).toBe("due");
    expect(payoutDisplay(game({ payout_window_hours: null }), Date.parse("2026-09-22T22:00:01Z")).tone).toBe("overdue");
  });

  it("without completed_at, counts from when the lifecycle sweep would have completed the game", () => {
    // Starts 17:00 UTC Sep 20, 60 min, +24h auto-complete → 18:00 Sep 21; +48h → 18:00 Sep 23.
    const g = game({ completed_at: null });
    expect(payoutDisplay(g, Date.parse("2026-09-23T17:59:00Z")).tone).toBe("due");
    expect(payoutDisplay(g, Date.parse("2026-09-23T18:01:00Z")).tone).toBe("overdue");
    // No duration on file: assumes 120 minutes, so the deadline moves an hour later.
    const noLength = game({ completed_at: null, duration_minutes: null });
    expect(payoutDisplay(noLength, Date.parse("2026-09-23T18:30:00Z")).tone).toBe("due");
  });
});
