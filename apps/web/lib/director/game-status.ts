import type { DirectorGameRow } from "@/lib/director/queries";

export type GameStatusKey = "open" | "partial" | "staffed" | "completed" | "cancelled";

export type GameStatusDisplay = {
  key: GameStatusKey;
  label: string;
  /** Colour for the card's top bar. */
  accent: string;
  /** Classes for the status chip. */
  chip: string;
};

type StatusInput = Pick<DirectorGameRow, "status" | "crew_size"> & { confirmedCount?: number };

const CLOSED = new Set(["completed", "cancelled"]);

/** Completed and cancelled games are finished — they belong in the archive. */
export function isClosedGame(status: string): boolean {
  return CLOSED.has(status);
}

const OPEN: GameStatusDisplay = {
  key: "open",
  label: "Open",
  accent: "#1F4FCC",
  chip: "text-signal",
};

const STAFFED: GameStatusDisplay = {
  key: "staffed",
  label: "Staffed",
  accent: "#00A85C",
  chip: "text-court",
};

function partial(label: string): GameStatusDisplay {
  // Yellow chip with ink text: yellow text on the chalk card is unreadable.
  return { key: "partial", label, accent: "#F5B90B", chip: "bg-whistle px-1.5 py-0.5 text-ink" };
}

/**
 * What a director should read off a game card.
 *
 * Worked out from how many crew slots are actually confirmed rather than from
 * jobs.status, because the database never writes "partially_filled": the
 * respond RPCs only set "open" or "staffed", so a game with 1 of 3 refs
 * confirmed is stored as "open". The stored status is only the fallback when
 * no counts were loaded.
 */
export function gameStatusDisplay(game: StatusInput): GameStatusDisplay {
  if (game.status === "completed") {
    return { key: "completed", label: "Completed", accent: "rgba(8,17,28,0.40)", chip: "text-ink-40" };
  }
  if (game.status === "cancelled") {
    return { key: "cancelled", label: "Cancelled", accent: "#E63946", chip: "text-foul" };
  }

  const crew = game.crew_size ?? 1;
  const confirmed = game.confirmedCount;
  if (confirmed != null) {
    if (confirmed >= crew) return STAFFED;
    if (confirmed > 0) return partial(`Partially filled · ${confirmed}/${crew}`);
    return OPEN;
  }

  if (game.status === "staffed") return STAFFED;
  if (game.status === "partially_filled") return partial("Partially filled");
  return OPEN;
}

export type PayoutTone = "paid" | "held" | "due" | "overdue" | "none";

export type PayoutDisplay = { tone: PayoutTone; label: string };

const DEFAULT_GAME_MINUTES = 120;
/** sweep_game_lifecycle auto-completes a game this long after it ends. */
const AUTO_COMPLETE_HOURS = 24;

function shortDate(ms: number): string {
  return new Date(ms)
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/Chicago",
    })
    .toUpperCase();
}

/**
 * Where the crew's money stands on a finished game.
 *
 * Reads each ref's own payout_status rather than the game-level
 * payment_status, because the ref's row is what records whether they were
 * actually paid. Refs are owed within payout_window_hours (48 by default) of
 * the game completing; when completed_at is missing, the moment the lifecycle
 * sweep would have completed it stands in.
 */
export function payoutDisplay(game: DirectorGameRow, now: number = Date.now()): PayoutDisplay {
  const payouts = game.refPayouts ?? [];
  if (payouts.length === 0) {
    return { tone: "none", label: game.status === "cancelled" ? "Cancelled · no fee owed" : "No crew payout owed" };
  }
  if (payouts.every((p) => p === "paid")) {
    return {
      tone: "paid",
      label: payouts.length === 1 ? "✓ Ref paid" : `✓ All ${payouts.length} refs paid`,
    };
  }

  const pending = payouts.filter((p) => p !== "paid" && p !== "processing").length;
  if (pending === 0) {
    // Charged, but at least one ref has no payout account to send it to yet.
    return { tone: "held", label: "Paid · held until ref adds a payout account" };
  }

  const completedAt = game.completed_at
    ? new Date(game.completed_at).getTime()
    : new Date(game.starts_at).getTime() +
      ((game.duration_minutes ?? DEFAULT_GAME_MINUTES) * 60 + AUTO_COMPLETE_HOURS * 3600) * 1000;
  const deadline = completedAt + (game.payout_window_hours ?? 48) * 3600 * 1000;

  if (now > deadline) {
    return { tone: "overdue", label: `Payout overdue · was due ${shortDate(deadline)}` };
  }
  return { tone: "due", label: `Refs paid by ${shortDate(deadline)}` };
}
