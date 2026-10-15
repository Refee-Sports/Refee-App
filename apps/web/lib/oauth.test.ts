import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { exchangeCodeForSession: vi.fn(), setSession: vi.fn(), signInWithOAuth: vi.fn(), linkIdentity: vi.fn() },
  availability: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: mocks.auth } }));
vi.mock("@/lib/supabase-config", () => ({ getSupabaseConfig: () => ({ url: "https://x.supabase.co", anonKey: "k" }) }));
vi.mock("@refee/core/auth/providers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@refee/core/auth/providers")>()),
  fetchOAuthProviderAvailability: mocks.availability,
}));

import { finalizeOAuthRedirect, getOAuthRedirectUri, linkOAuthIdentity, signInWithGoogleOAuth } from "./oauth";

beforeEach(() => {
  vi.stubGlobal("window", { location: { origin: "https://refee.app" } });
  Object.values(mocks.auth).forEach((f) => f.mockReset().mockResolvedValue({ error: null }));
  mocks.availability.mockReset().mockResolvedValue({ google: true, apple: true });
});
afterEach(() => vi.unstubAllGlobals());

describe("getOAuthRedirectUri", () => {
  it("comes back to this site's callback page", () => {
    expect(getOAuthRedirectUri()).toBe("https://refee.app/auth/callback");
  });
});

describe("starting sign-in", () => {
  it("hands the browser to the provider with this site's callback", async () => {
    expect(await signInWithGoogleOAuth()).toEqual({ error: null });
    expect(mocks.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://refee.app/auth/callback" },
    });
  });

  it("stops before leaving the site when the provider is switched off", async () => {
    mocks.availability.mockResolvedValue({ google: false, apple: true });
    const { error } = await signInWithGoogleOAuth();
    expect(error).toBeInstanceOf(Error);
    expect(mocks.auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("returns to Account after linking a provider", async () => {
    await linkOAuthIdentity("apple");
    expect(mocks.auth.linkIdentity).toHaveBeenCalledWith({
      provider: "apple",
      options: { redirectTo: "https://refee.app/auth/callback?next=%2Faccount" },
    });
  });
});

describe("finalizeOAuthRedirect", () => {
  it("exchanges the code once", async () => {
    expect(await finalizeOAuthRedirect("https://refee.app/auth/callback?code=abc")).toEqual({ error: null });
    expect(mocks.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  it("accepts tokens in the hash", async () => {
    await finalizeOAuthRedirect("https://refee.app/auth/callback#access_token=a&refresh_token=r");
    expect(mocks.auth.setSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "r" });
  });

  it("shows the provider's error", async () => {
    const { error } = await finalizeOAuthRedirect(
      "https://refee.app/auth/callback?error=access_denied&error_description=User+cancelled"
    );
    expect(error?.message).toBe("User cancelled");
  });

  it("explains a redirect with nothing in it", async () => {
    const { error } = await finalizeOAuthRedirect("https://refee.app/auth/callback");
    expect(error?.message).toMatch(/Could not complete sign-in/);
  });
});
