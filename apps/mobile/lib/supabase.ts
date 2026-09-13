import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase-config";

const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseConfig();

/**
 * Returns a user-facing message when Supabase env is missing or still using template values from `.env.example`.
 * Real values come from Supabase → Project Settings → API (Project URL + anon public key).
 */
export function getSupabaseSetupError(): string | null {
  const url = supabaseUrl.trim();
  const key = supabaseAnonKey.trim();
  if (!url || !key) {
    return "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to refee/.env.dev (see Supabase → Settings → API), then restart Expo.";
  }
  const urlLower = url.toLowerCase();
  if (urlLower.includes("your-project.supabase.co") || urlLower.includes("placeholder")) {
    return "EXPO_PUBLIC_SUPABASE_URL is still a placeholder. In Supabase → Project Settings → API, copy your Project URL (https://….supabase.co) into refee/.env.dev, then restart Expo.";
  }
  if (key === "your-anon-key" || /^your-/i.test(key)) {
    return "EXPO_PUBLIC_SUPABASE_ANON_KEY is still a placeholder. In Supabase → Project Settings → API, copy the anon public key into refee/.env.dev, then restart Expo.";
  }
  return null;
}

/** True when URL and key look like real Supabase dashboard values (not template text). */
export const isSupabaseConfigured = getSupabaseSetupError() === null;

if (!isSupabaseConfigured) {
  console.warn(`[refee] Supabase env: ${getSupabaseSetupError() ?? "invalid"}`);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
