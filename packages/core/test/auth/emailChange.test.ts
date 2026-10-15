import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureSupabase } from "@refee/core/client";

const mocks = vi.hoisted(() => ({ updateUser: vi.fn(), verifyOtp: vi.fn(), getUser: vi.fn() }));

configureSupabase({ auth: { updateUser: mocks.updateUser, verifyOtp: mocks.verifyOtp, getUser: mocks.getUser } } as never);

import { confirmEmailChange, requestEmailChange } from "@refee/core/auth/emailCode";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { email: "old@example.com" } }, error: null });
  mocks.updateUser.mockResolvedValue({ data: {}, error: null });
  mocks.verifyOtp.mockResolvedValue({ data: {}, error: null });
});

describe("requestEmailChange", () => {
  it("asks Supabase to send a code to the new address, normalized", async () => {
    const { error } = await requestEmailChange("  New@Example.com ");
    expect(error).toBeNull();
    expect(mocks.updateUser).toHaveBeenCalledWith({ email: "new@example.com" });
  });

  it("rejects an invalid address without calling Supabase", async () => {
    const { error } = await requestEmailChange("nope");
    expect(error?.message).toMatch(/valid email/i);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects the address already on the account", async () => {
    const { error } = await requestEmailChange("OLD@example.com");
    expect(error?.message).toMatch(/already/i);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("says plainly when another account already uses the address", async () => {
    mocks.updateUser.mockResolvedValue({
      data: {},
      error: { message: "A user with this email address has already been registered" },
    });
    const { error } = await requestEmailChange("taken@example.com");
    expect(error?.message).toMatch(/another refee account/i);
  });
});

describe("confirmEmailChange", () => {
  it("verifies the code against the new address as an email change", async () => {
    const { error } = await confirmEmailChange("New@Example.com", "123 456");
    expect(error).toBeNull();
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: "new@example.com",
      token: "123456",
      type: "email_change",
    });
  });

  it("needs the full code", async () => {
    const { error } = await confirmEmailChange("new@example.com", "123");
    expect(error?.message).toMatch(/6-digit/);
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("turns a bad code into something readable", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: {}, error: { message: "Token has expired or is invalid" } });
    const { error } = await confirmEmailChange("new@example.com", "123456");
    expect(error?.message).toMatch(/didn't work/);
  });
});
