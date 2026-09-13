import { supabase } from "@/lib/supabase";
import { getSupabaseConfig } from "@/lib/supabase-config";

/**
 * Web OAuth. Unlike the app (which opens an auth session in a native browser
 * and deep-links back via the `refee://` scheme), the browser just redirects to
 * Supabase and back to /auth/callback, where detectSessionInUrl + the PKCE code
 * exchange finish the job.
 *
 * Add this origin's callback to Supabase → Authentication → URL Configuration
 * alongside the app's deep link.
 */
export function getOAuthRedirectUri(): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return `${origin}/auth/callback`;
}

export type OAuthProvider = "google" | "apple";

const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: "Google",
  apple: "Apple",
};

/**
 * `null` means "we could not find out" — treat that as available rather than
 * blocking a provider that may well work.
 */
export type ProviderAvailability = Record<OAuthProvider, boolean | null>;

const UNKNOWN_AVAILABILITY: ProviderAvailability = { google: null, apple: null };

let availabilityCache: ProviderAvailability | null = null;

/**
 * Which social providers this Supabase project actually has credentials for.
 *
 * This matters because signInWithOAuth does NOT report a disabled provider as
 * an error — it redirects the browser to /auth/v1/authorize, which answers
 * with a raw JSON validation error and strands the user on a blank page with
 * no way back. Asking /auth/v1/settings first lets us keep them on the page.
 */
export async function fetchOAuthProviderAvailability(): Promise<ProviderAvailability> {
  if (availabilityCache) return availabilityCache;

  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return UNKNOWN_AVAILABILITY;

  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey },
    });
    if (!res.ok) return UNKNOWN_AVAILABILITY;
    const external = (await res.json())?.external ?? {};
    availabilityCache = {
      google: Boolean(external.google),
      apple: Boolean(external.apple),
    };
    return availabilityCache;
  } catch {
    return UNKNOWN_AVAILABILITY;
  }
}

/**
 * A disabled provider is a setup gap, not something the person signing in did
 * wrong — so say that plainly and point at the way in that does work.
 */
export function providerUnavailableMessage(provider: OAuthProvider): string {
  return `${PROVIDER_LABELS[provider]} sign-in isn't switched on for this Refee environment yet. Use your phone number instead — it signs you in to the same account.`;
}

function humanizeOAuthError(provider: OAuthProvider, message: string): string {
  if (/provider is not enabled|unsupported provider/i.test(message)) {
    return providerUnavailableMessage(provider);
  }
  return message;
}

async function startOAuth(provider: OAuthProvider): Promise<{ error: Error | null }> {
  // Check before handing the browser over, or a disabled provider dumps the
  // user on Supabase's JSON error page.
  const availability = await fetchOAuthProviderAvailability();
  if (availability[provider] === false) {
    return { error: new Error(providerUnavailableMessage(provider)) };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: getOAuthRedirectUri() },
  });
  // On success the browser navigates away, so nothing after this runs.
  return {
    error: error ? new Error(humanizeOAuthError(provider, error.message)) : null,
  };
}

export async function signInWithGoogleOAuth(): Promise<{ error: Error | null }> {
  try {
    return await startOAuth("google");
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function signInWithAppleOAuth(): Promise<{ error: Error | null }> {
  try {
    return await startOAuth("apple");
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/** Exchanges the `?code=` from the OAuth redirect for a session. */
export async function finalizeOAuthRedirect(url: string): Promise<{ error: Error | null }> {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const get = (k: string) => params.get(k) ?? hashParams.get(k);

  const errParam = get("error");
  if (errParam) {
    return { error: new Error(get("error_description") ?? errParam) };
  }

  const code = get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return { error: error ? new Error(error.message) : null };
  }

  const accessToken = get("access_token");
  const refreshToken = get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return { error: error ? new Error(error.message) : null };
  }

  return { error: new Error("Could not complete sign-in from redirect.") };
}
