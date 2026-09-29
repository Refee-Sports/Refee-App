import { supabase } from "../client";

// The oldest app version the backend still supports (migration 0058). Read at
// launch; anything older is asked to update before it can do anything else.

/** "1.2.3" → [1, 2, 3]; anything else → null. */
export function parseVersion(version: string | null | undefined): [number, number, number] | null {
  const match = /^\s*v?(\d+)\.(\d+)\.(\d+)/.exec(version ?? "");
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/**
 * True only when we can tell `current` is older than `minimum`. If either isn't
 * a version we recognise, fail open: a bad value on the server or in a dev
 * build must never lock people out of the app.
 */
export function isVersionBelow(current: string | null | undefined, minimum: string | null | undefined): boolean {
  const a = parseVersion(current);
  const b = parseVersion(minimum);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/** The minimum supported version for a platform, or null if unknown / unreachable. */
export async function fetchMinAppVersion(platform: "ios" | "android"): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("get_min_app_version", { p_platform: platform });
    if (error) return null;
    return (data as string | null) ?? null;
  } catch {
    return null;
  }
}
