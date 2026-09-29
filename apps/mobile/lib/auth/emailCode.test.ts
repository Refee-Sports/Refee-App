import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signInWithOtp: vi.fn(), verifyOtp: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { signInWithOtp: mocks.signInWithOtp, verifyOtp: mocks.verifyOtp } },
}));

import {
  EMAIL_CODE_LENGTH,
  cleanCode,
  humanizeEmailAuthError,
  isValidEmail,
  maskEmail,
  normalizeEmail,
  sendEmailCode,
  verifyEmailCode,
} from "./emailCode";

describe("email address handling", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeEmail("  Jordan@Example.COM ")).toBe("jordan@example.com");
  });

  it("accepts ordinary addresses and rejects junk", () => {
    expect(isValidEmail("jordan@example.com")).toBe(true);
    expect(isValidEmail(" a.b+c@sub.example.org ")).toBe(true);
    expect(isValidEmail("jordan@")).toBe(false);
    expect(isValidEmail("jordan example.com")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(`${"a".repeat(250)}@example.com`)).toBe(false);
  });

  it("masks the middle of the name for the confirmation line", () => {
    expect(maskEmail("jordan.taylor@example.com")).toBe("jo••••••@example.com".replace("••••••", "•".repeat(8)));
    expect(maskEmail("ab@x.com")).toBe("ab•@x.com");
    expect(maskEmail("notanemail")).toBe("notanemail");
  });
});

describe("cleanCode", () => {
  it("keeps only digits, capped at the code length", () => {
    expect(cleanCode("123 456")).toBe("123456");
    expect(cleanCode("12-34-56-78")).toBe("123456");
    expect(cleanCode("abc")).toBe("");
    expect(cleanCode("1234567890")).toHaveLength(EMAIL_CODE_LENGTH);
  });
});

describe("humanizeEmailAuthError", () => {
  it("explains rate limits, bad codes and network trouble", () => {
    expect(humanizeEmailAuthError("For security purposes, you can only request this after 59 seconds.")).toMatch(/Too many attempts/);
    expect(humanizeEmailAuthError("email rate limit exceeded")).toMatch(/Too many attempts/);
    expect(humanizeEmailAuthError("Token has expired or is invalid")).toMatch(/didn't work/);
    expect(humanizeEmailAuthError("Failed to fetch")).toMatch(/Can't reach Refee/);
    expect(humanizeEmailAuthError("Something else")).toBe("Something else");
  });
});

describe("sendEmailCode / verifyEmailCode", () => {
  beforeEach(() => {
    mocks.signInWithOtp.mockReset().mockResolvedValue({ error: null });
    mocks.verifyOtp.mockReset().mockResolvedValue({ error: null });
  });

  it("asks Supabase for a code (no link redirect) and lets new emails sign up", async () => {
    const out = await sendEmailCode("  Jordan@Example.com ");
    expect(out.error).toBeNull();
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "jordan@example.com",
      options: { shouldCreateUser: true },
    });
    expect(mocks.signInWithOtp.mock.calls[0][0].options).not.toHaveProperty("emailRedirectTo");
  });

  it("does not call Supabase for an invalid email", async () => {
    const out = await sendEmailCode("nope");
    expect(out.error?.message).toMatch(/valid email/);
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it("surfaces a send failure in plain words", async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: { message: "email rate limit exceeded" } });
    expect((await sendEmailCode("a@b.co")).error?.message).toMatch(/Too many attempts/);
  });

  it("verifies with the email type and a cleaned code", async () => {
    const out = await verifyEmailCode("Jordan@Example.com", "123 456");
    expect(out.error).toBeNull();
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: "jordan@example.com",
      token: "123456",
      type: "email",
    });
  });

  it("does not call Supabase until all digits are in", async () => {
    const out = await verifyEmailCode("a@b.co", "123");
    expect(out.error?.message).toMatch(/6-digit/);
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("says a wrong or expired code didn't work", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
    expect((await verifyEmailCode("a@b.co", "000000")).error?.message).toMatch(/didn't work/);
  });
});
