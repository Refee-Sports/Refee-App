import { afterEach, describe, expect, it, vi } from "vitest";
import { friendlyLoadError, REACH_ERROR, withDeadline } from "./network";

describe("withDeadline", () => {
  afterEach(() => vi.useRealTimers());

  it("returns the result when the work finishes in time, and leaves no timer behind", async () => {
    vi.useFakeTimers();
    await expect(withDeadline(Promise.resolve("loaded"), 1000)).resolves.toBe("loaded");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("gives up on work that hangs, with a message the page turns into 'try again'", async () => {
    vi.useFakeTimers();
    const hung = withDeadline(new Promise(() => {}), 20_000);
    const settled = expect(hung).rejects.toThrow("Request timed out");
    await vi.advanceTimersByTimeAsync(20_000);
    await settled;
    expect(friendlyLoadError("Request timed out")).toBe(REACH_ERROR);
  });

  it("does not give up early", async () => {
    vi.useFakeTimers();
    let done = false;
    void withDeadline(new Promise(() => {}), 20_000).catch(() => (done = true));
    await vi.advanceTimersByTimeAsync(19_999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });

  it("passes the work's own failure through", async () => {
    await expect(withDeadline(Promise.reject(new Error("permission denied")), 1000)).rejects.toThrow("permission denied");
  });
});

describe("friendlyLoadError", () => {
  it("explains a request that never got through, whatever the browser calls it", () => {
    for (const raw of [
      "TypeError: Failed to fetch", // Chrome
      "NetworkError when attempting to fetch resource.", // Firefox
      "Load failed", // Safari
      "AbortError: signal timed out", // our 20s limit
      "The operation was aborted due to timeout",
      "502 Bad Gateway",
      "upstream request timeout",
      "504 Gateway Time-out",
      "503 Service Unavailable",
    ]) {
      expect(friendlyLoadError(raw)).toBe(REACH_ERROR);
    }
  });

  it("treats a missing message as a connection problem", () => {
    expect(friendlyLoadError(undefined)).toBe(REACH_ERROR);
    expect(friendlyLoadError(null)).toBe(REACH_ERROR);
    expect(friendlyLoadError("   ")).toBe(REACH_ERROR);
  });

  it("passes real errors through unchanged", () => {
    expect(friendlyLoadError("permission denied for table jobs")).toBe("permission denied for table jobs");
    expect(friendlyLoadError("JWT expired")).toBe("JWT expired");
  });
});
