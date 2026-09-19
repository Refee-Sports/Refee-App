import { describe, expect, it } from "vitest";
import {
  lockedWork,
  skipVerificationWarning,
  verificationBlocker,
} from "@refee/core/identity/queries";

describe("what verification unlocks, per role", () => {
  it("names each role's own work", () => {
    expect(lockedWork("referee")).toBe("accept games");
    expect(lockedWork("director")).toBe("create games");
    expect(lockedWork("assignor")).toBe("assign games");
  });

  it("reads as a referee when the role isn't known yet", () => {
    expect(lockedWork(null)).toBe("accept games");
    expect(lockedWork(undefined)).toBe("accept games");
  });
});

describe("the warning before someone skips verification", () => {
  it("tells each role what they'll lose", () => {
    expect(skipVerificationWarning("referee")).toContain("won't be able to accept games");
    expect(skipVerificationWarning("director")).toContain("won't be able to create games");
    expect(skipVerificationWarning("assignor")).toContain("won't be able to assign games");
  });

  it("says they can still look around and come back to it", () => {
    expect(skipVerificationWarning("director")).toContain("You can still look around");
  });
});

describe("the banner, in the person's role", () => {
  it("no longer tells a director they'll be 'working games'", () => {
    expect(verificationBlocker("unstarted", "director")).toBe("Verify your ID to create games.");
    expect(verificationBlocker("in_progress", "assignor")).toBe("Finish verifying your ID to assign games.");
    expect(verificationBlocker("unstarted", "referee")).toBe("Verify your ID to accept games.");
  });

  it("keeps the role-neutral messages as they were", () => {
    expect(verificationBlocker("approved", "director")).toBeNull();
    expect(verificationBlocker("in_review", "assignor")).toMatch(/We're checking your ID/);
    expect(verificationBlocker("declined", "referee")).toMatch(/couldn't verify/);
  });
});
