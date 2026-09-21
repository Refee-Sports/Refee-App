import { supabase } from "@/lib/supabase";
import { getSupabaseConfig } from "@/lib/supabase-config";
// Shared with the mobile app so the two cannot drift: this guard existed here
// and not there, so the same tap behaved differently depending on the app.
import {
  fetchOAuthProviderAvailability,
  humanizeOAuthError,
  providerUnavailableMessage,
  type OAuthProvider,
  type ProviderAvailability,
} from "@refee/core/auth/providers";

export {
  providerUnavailableMessage,
  type OAuthProvider,
  type ProviderAvailability,
};

/** This project's provider availability — screens don't need the config. */
export function fetchProviderAvailability(): Promise<ProviderAvailability> {
  const { url, anonKey } = getSupabaseConfig();
  return fetchOAuthProviderAvailability(url, anonKey);
}

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

async function startOAuth(provider: OAuthProvider): Promise<{ error: Error | null }> {
  // Check before handing the browser over, or a disabled provider dumps the
  // user on Supabase's JSON error page.
  const { url, anonKey } = getSupabaseConfig();
  const availability = await fetchOAuthProviderAvailability(url, anonKey);
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
