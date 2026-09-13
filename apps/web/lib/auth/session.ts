import { supabase } from "@/lib/supabase";

/**
 * Current user id from the local session (same source as the AuthProvider).
 * Prefer this over getUser() for in-app mutations — getUser() re-validates with
 * the server and returns null when storage holds a stale JWT.
 */
export async function getSessionUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/**
 * Validates the JWT with Supabase Auth. Signs out when the cached session is no
 * longer valid (common after a local `supabase db reset`).
 */
export async function ensureValidSession(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return false;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (!user || error) {
    await supabase.auth.signOut();
    return false;
  }
  return true;
}
