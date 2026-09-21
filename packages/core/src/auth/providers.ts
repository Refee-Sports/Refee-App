// Which social sign-in providers a Supabase project actually has credentials
// for.
//
// This matters because signInWithOAuth does NOT report a disabled provider as
// an error. It hands the browser to /auth/v1/authorize, which answers with a
// raw JSON validation error — on web that strands the person on a blank page,
// and on mobile it strands them inside a browser sheet with no way back and no
// idea what went wrong. Asking first lets both apps say something true and
// keep the person on a screen that works.
//
// Shared by both apps so the two can't drift: web had this guard and mobile
// did not, which meant the same tap behaved completely differently depending
// on which app you were in.

export type OAuthProvider = "google" | "apple";

const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: "Google",
  apple: "Apple",
};

/**
 * `null` means "we could not find out" — treated as available rather than
 * blocking a provider that may well work.
 */
export type ProviderAvailability = Record<OAuthProvider, boolean | null>;

export const UNKNOWN_AVAILABILITY: ProviderAvailability = {
  google: null,
  apple: null,
};

let cache: ProviderAvailability | null = null;

/** Clears the cached answer. Used by tests, and after a config change. */
export function resetProviderAvailabilityCache(): void {
  cache = null;
}

/**
 * Asks the project which external providers are switched on.
 *
 * Never throws: an unreachable settings endpoint answers "unknown", and the
 * caller carries on and lets the provider itself decide.
 */
export async function fetchOAuthProviderAvailability(
  url: string,
  anonKey: string
): Promise<ProviderAvailability> {
  if (cache) return cache;
  if (!url || !anonKey) return UNKNOWN_AVAILABILITY;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: anonKey },
    });
    if (!res.ok) return UNKNOWN_AVAILABILITY;
    const external = ((await res.json()) as { external?: Record<string, boolean> })?.external ?? {};
    cache = {
      google: Boolean(external.google),
      apple: Boolean(external.apple),
    };
    return cache;
  } catch {
    return UNKNOWN_AVAILABILITY;
  }
}

/**
 * A provider that isn't switched on is a setup gap, not something the person
 * signing in did wrong — so say that plainly and point at the way in that does
 * work.
 */
export function providerUnavailableMessage(provider: OAuthProvider): string {
  return `${PROVIDER_LABELS[provider]} sign-in isn't switched on for this Refee environment yet. Use your phone number instead — it signs you in to the same account.`;
}

/** Turns Supabase's own wording for a disabled provider into that message. */
export function humanizeOAuthError(provider: OAuthProvider, message: string): string {
  if (/provider is not enabled|unsupported provider/i.test(message)) {
    return providerUnavailableMessage(provider);
  }
  return message;
}
