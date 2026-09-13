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

export const supabase = createClient(clientUrl, clientKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    storageKey: "refee-auth",
  },
});
