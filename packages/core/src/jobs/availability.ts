// Whether a game can still be taken, from what a referee's screen knows about it.
// Used when someone opens a game from an old notification or a stale list: if
// the last spot went while they were reading, they should be told plainly
// instead of discovering it when the accept fails.

export type JobAvailability =
  | { available: true }
  | { available: false; reason: "cancelled" | "over" | "started" | "full"; message: string };

export type JobAvailabilityInput = {
  status?: string | null;
  startsAtIso?: string | null;
  crewSize: number;
  /** Referees confirmed on the game right now. */
  confirmedCount: number;
};

/** Tells the most useful reason first: cancelled, then over, then started, then full. */
export function jobAvailability(input: JobAvailabilityInput, now: Date = new Date()): JobAvailability {
  if (input.status === "cancelled") {
    return { available: false, reason: "cancelled", message: "This game was cancelled." };
  }
  if (input.status === "completed") {
    return { available: false, reason: "over", message: "This game is already over." };
  }
  if (input.startsAtIso && new Date(input.startsAtIso).getTime() <= now.getTime()) {
    return { available: false, reason: "started", message: "This game has already started." };
  }
  if (input.crewSize > 0 && input.confirmedCount >= input.crewSize) {
    return { available: false, reason: "full", message: "This game is already full." };
  }
  return { available: true };
}
