import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase-config";

const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseConfig();

/**
 * Returns a user-facing message when Supabase env is missing or still using
 * template values. Real values come from Supabase → Project Settings → API and
 * MUST match the ones the mobile app uses — same project, same user accounts.
 */
export function getSupabaseSetupError(): string | null {
  const url = supabaseUrl.trim();
  const key = supabaseAnonKey.trim();
  if (!url || !key) {
    return "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see Supabase → Settings → API), then restart the dev server.";
  }
  const urlLower = url.toLowerCase();
  if (urlLower.includes("your-project.supabase.co") || urlLower.includes("placeholder")) {
    return "NEXT_PUBLIC_SUPABASE_URL is still a placeholder. In Supabase → Project Settings → API, copy your Project URL (https://….supabase.co) into .env.local, then restart the dev server.";
  }
  if (key === "your-anon-key" || /^your-/i.test(key)) {
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY is still a placeholder. In Supabase → Project Settings → API, copy the anon public key into .env.local, then restart the dev server.";
  }
  return null;
}

/** True when URL and key look like real Supabase dashboard values. */
export const isSupabaseConfigured = getSupabaseSetupError() === null;

/**
 * Browser Supabase client. Mirrors refee-mobile/refee/lib/supabase.ts, with two
 * web-specific differences:
 *  - session storage is localStorage (the app uses AsyncStorage)
 *  - detectSessionInUrl is on, so the OAuth redirect back from Google/Apple
 *    completes the sign-in
 */
// Fall back to a syntactically valid placeholder so `next build` and SSR don't
// crash when env is missing — every screen checks isSupabaseConfigured and
// renders the setup error above instead of issuing requests.
const clientUrl = supabaseUrl.trim() || "https://placeholder.supabase.co";
const clientKey = supabaseAnonKey.trim() || "placeholder-anon-key";

// A Supabase call that hangs (an outage, a dropped connection) would otherwise
// leave a screen spinning forever. Sign-in and data calls give up after 20s and
// come back as ordinary errors the screens already show; edge functions (an AI
// schedule read can take 15s or more) and storage uploads keep the browser's
// own limits.
const REQUEST_TIMEOUT_MS = 20_000;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!/\/(auth|rest)\/v1\//.test(url)) return fetch(input, init);
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal =
    init?.signal && typeof AbortSignal.any === "function" ? AbortSignal.any([init.signal, timeout]) : init?.signal ?? timeout;
  return fetch(input, { ...init, signal });
}

export const supabase = createClient(clientUrl, clientKey, {
  global: { fetch: fetchWithTimeout },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    storageKey: "refee-auth",
  },
});
