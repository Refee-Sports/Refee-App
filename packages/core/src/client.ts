import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Each app builds its own client (browser storage on web, AsyncStorage on
// mobile) and registers it here once at start-up; everything in @refee/core
// talks to the backend through it.

let current: SupabaseClient | null = null;

export function configureSupabase(client: SupabaseClient): void {
  current = client;
}

function client(): SupabaseClient {
  if (!current) {
    throw new Error("@refee/core: call configureSupabase(client) before using the backend.");
  }
  return current;
}

/**
 * The registered client, usable as `supabase.from(...)` / `supabase.rpc(...)`.
 * Resolved on every access, so modules can import it before the app has
 * registered its client.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = client() as unknown as Record<PropertyKey, unknown>;
    const value = c[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(c) : value;
  },
});

export type TypedSupabaseClient = SupabaseClient<Database>;
