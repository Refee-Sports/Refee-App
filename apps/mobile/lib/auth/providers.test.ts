import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  fetchOAuthProviderAvailability,
  humanizeOAuthError,
  providerUnavailableMessage,
  resetProviderAvailabilityCache,
  UNKNOWN_AVAILABILITY,
} from "@refee/core/auth/providers";

// The failure this guards against: signInWithOAuth does not report a disabled
// provider as an error, so without asking first the person is handed to a raw
// JSON error page — inside a browser sheet on mobile, with no way back.

const settings = (external: Record<string, boolean>) =>
  ({ ok: true, json: async () => ({ external }) }) as unknown as Response;

describe("OAuth provider availability", () => {
  beforeEach(() => resetProviderAvailabilityCache());
  afterEach(() => vi.unstubAllGlobals());

  it("reports a provider the project has credentials for", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => settings({ google: true, apple: false })));
    const a = await fetchOAuthProviderAvailability("https://x.supabase.co", "key");
    expect(a.google).toBe(true);
    expect(a.apple).toBe(false);
  });

  it("reports a provider that is switched off, so the app can say so", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => settings({ email: true, phone: true })));
    const a = await fetchOAuthProviderAvailability("https://x.supabase.co", "key");
    expect(a.google).toBe(false);
    expect(a.apple).toBe(false);
  });

  it("answers 'unknown' rather than blocking when the check itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    const a = await fetchOAuthProviderAvailability("https://x.supabase.co", "key");
    // null, not false: a provider that may well work is never blocked because
    // we couldn't reach the settings endpoint.
    expect(a).toEqual(UNKNOWN_AVAILABILITY);
  });

  it("answers 'unknown' on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as unknown as Response));
    expect(await fetchOAuthProviderAvailability("https://x.supabase.co", "key")).toEqual(
      UNKNOWN_AVAILABILITY
    );
  });

  it("answers 'unknown' without a url or key, and asks nothing", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await fetchOAuthProviderAvailability("", "")).toEqual(UNKNOWN_AVAILABILITY);
    expect(f).not.toHaveBeenCalled();
  });

  it("asks the settings endpoint only once", async () => {
    const f = vi.fn(async () => settings({ google: true }));
    vi.stubGlobal("fetch", f);
    await fetchOAuthProviderAvailability("https://x.supabase.co", "key");
    await fetchOAuthProviderAvailability("https://x.supabase.co", "key");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("tolerates a trailing slash on the project url", async () => {
    const f = vi.fn(async (_url: string, _init?: RequestInit) => settings({ google: true }));
    vi.stubGlobal("fetch", f);
    await fetchOAuthProviderAvailability("https://x.supabase.co/", "key");
    expect(f.mock.calls[0]?.[0]).toBe("https://x.supabase.co/auth/v1/settings");
  });
});

describe("what the person is told", () => {
  it("names the provider and points at the way in that works", () => {
    const msg = providerUnavailableMessage("google");
    expect(msg).toContain("Google");
    expect(msg).toContain("phone number");
  });

  it("turns Supabase's wording for a disabled provider into that message", () => {
    expect(humanizeOAuthError("apple", "Unsupported provider: provider is not enabled")).toBe(
      providerUnavailableMessage("apple")
    );
  });

  it("leaves a genuine error alone", () => {
    expect(humanizeOAuthError("google", "Network request failed")).toBe("Network request failed");
  });
});
