/**
 * Supabase URL/key for the web client.
 *
 * These must point at the SAME Supabase project the mobile app uses
 * (refee-mobile/refee/.env.*: EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY) — that is
 * what lets a user sign in on either surface with one account.
 */
export function getSupabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}

export function isLocalSupabaseUrl(url: string): boolean {
  return /127\.0\.0\.1:54321|localhost:54321/.test(url);
}

/**
 * Local Supabase has no SMS provider — `supabase start` ships placeholder
 * Twilio credentials. It only "delivers" codes for the numbers listed under
 * [auth.sms.test_otp] in the mobile repo's config.toml, which are all in the
 * 555-555-01xx range.
 *
 * Any other number still returns HTTP 200 and creates the user, so without
 * this check the app sends people to the verify screen to wait for a code
 * that was never sent.
 */
export function canReceiveSmsLocally(e164OrDigits: string): boolean {
  const digits = e164OrDigits.replace(/\D/g, "");
  return /^1?555555\d{4}$/.test(digits);
}
