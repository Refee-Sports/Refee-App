import Constants from "expo-constants";

type SupabaseExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

/**
 * Supabase URL/key from app.config `extra` (set when Metro starts).
 * Avoids Expo merging `.env.dev` over `.env.local.supabase` at bundle time.
 */
export function getSupabaseConfig() {
  const extra = (Constants.expoConfig?.extra ?? {}) as SupabaseExtra;
  return {
    url: extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    anonKey: extra.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}

export function isLocalSupabaseUrl(url: string): boolean {
  return /127\.0\.0\.1:54321|localhost:54321/.test(url);
}
