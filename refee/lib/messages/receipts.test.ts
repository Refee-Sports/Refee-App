import { describe, it, expect } from "vitest";
import { hasSeenLatest, seenCount, type CrewReceipt } from "./receipts";

const MSG_AT = "2026-08-19T15:00:00Z";

describe("hasSeenLatest", () => {
  it("is true when the ref read at or after the last message", () => {
    expect(hasSeenLatest("2026-08-19T15:00:00Z", MSG_AT)).toBe(true); // exactly at
    expect(hasSeenLatest("2026-08-19T15:05:00Z", MSG_AT)).toBe(true); // after
  });

  it("is false when the ref last read before the message", () => {
    expect(hasSeenLatest("2026-08-19T14:59:59Z", MSG_AT)).toBe(false);
  });

  it("is false when either timestamp is missing", () => {
    expect(hasSeenLatest(null, MSG_AT)).toBe(false);
    expect(hasSeenLatest("2026-08-19T15:05:00Z", null)).toBe(false);
    expect(hasSeenLatest(null, null)).toBe(false);
  });
});

describe("seenCount", () => {
  const receipts: CrewReceipt[] = [
    { refId: "a", displayName: "A", lastReadAt: "2026-08-19T15:01:00Z" }, // seen
    { refId: "b", displayName: "B", lastReadAt: "2026-08-19T14:00:00Z" }, // not
    { refId: "c", displayName: "C", lastReadAt: null }, // not
  ];

  it("counts how many refs have seen the latest message", () => {
    expect(seenCount(receipts, MSG_AT)).toBe(1);
  });

  it("is zero when there is no message yet", () => {
    expect(seenCount(receipts, null)).toBe(0);
  });

  it("is zero for an empty crew", () => {
    expect(seenCount([], MSG_AT)).toBe(0);
  });
});
