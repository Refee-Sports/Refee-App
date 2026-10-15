import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  setSession: vi.fn(),
  signInWithOtp: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));
vi.mock("@/lib/supabase-config", () => ({ getSupabaseConfig: () => ({ url: "https://x.supabase.co", anonKey: "k" }) }));
vi.mock("expo-apple-authentication", () => ({}));
vi.mock("expo-crypto", () => ({ CryptoDigestAlgorithm: {}, CryptoEncoding: {} }));
vi.mock("expo-auth-session", () => ({ makeRedirectUri: () => "refee://auth/callback" }));
vi.mock("expo-web-browser", () => ({}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import { finalizeOAuthRedirect, getOAuthRedirectUri, sendEmailMagicLink } from "./oauth";

beforeEach(() => Object.values(auth).forEach((f) => f.mockReset().mockResolvedValue({ error: null })));

describe("getOAuthRedirectUri", () => {
  it("deep-links back into the app", () => {
    expect(getOAuthRedirectUri()).toBe("refee://auth/callback");
  });
});

describe("finalizeOAuthRedirect", () => {
  it("exchanges a code", async () => {
    expect(await finalizeOAuthRedirect("refee://auth/callback?code=abc")).toEqual({ error: null });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  it("verifies an emailed link", async () => {
    await finalizeOAuthRedirect("refee://auth/callback?token_hash=h&type=email_change");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "h", type: "email_change" });
  });

  it("accepts tokens", async () => {
    await finalizeOAuthRedirect("refee://auth/callback#access_token=a&refresh_token=r");
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "r" });
  });

  it("shows the provider's error", async () => {
    const { error } = await finalizeOAuthRedirect("refee://auth/callback?error=access_denied&error_description=Cancelled");
    expect(error?.message).toBe("Cancelled");
  });

  it("explains an empty redirect", async () => {
    const { error } = await finalizeOAuthRedirect("refee://auth/callback");
    expect(error?.message).toMatch(/Could not complete sign-in/);
  });
});

describe("sendEmailMagicLink", () => {
  it("normalises the address and returns to the app", async () => {
    await sendEmailMagicLink("  Ref@Example.com ");
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "ref@example.com",
      options: { emailRedirectTo: "refee://auth/callback", shouldCreateUser: true },
    });
  });
});
