// Read-receipt helpers for crew messages. A ref has "seen" the crew message if
// their last_read_at on the conversation is at/after the thread's most recent
// message. Pure so it's unit-tested and shared by the director game screen.

export type CrewReceipt = {
  refId: string;
  displayName: string;
  /** ISO time the ref last read the crew thread; null if never opened. */
  lastReadAt: string | null;
};

/** True if `lastReadAt` is at or after `lastMessageAt` (both required). */
export function hasSeenLatest(lastReadAt: string | null, lastMessageAt: string | null): boolean {
  if (!lastReadAt || !lastMessageAt) return false;
  return new Date(lastReadAt).getTime() >= new Date(lastMessageAt).getTime();
}

/** Number of receipts that have seen the latest crew message. */
export function seenCount(receipts: readonly CrewReceipt[], lastMessageAt: string | null): number {
  return receipts.reduce((n, r) => n + (hasSeenLatest(r.lastReadAt, lastMessageAt) ? 1 : 0), 0);
}
