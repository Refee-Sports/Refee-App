import { supabase } from "@/lib/supabase";

/**
 * Web counterpart of refee-mobile/refee/lib/push/notifications.ts.
 *
 * The web app never registers a device token — Expo push tokens are a native
 * concern — but it MUST still be able to *send* push, because the same actions
 * trigger it on both surfaces: a director approving an applicant from a laptop
 * has to reach that referee's phone exactly like the mobile app would.
 */

/** Fire a push to one or more users via the edge function (best-effort). */
export async function sendPush(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    await supabase.functions.invoke("send-push", {
      body: { userIds, title, body, data },
    });
  } catch {
    /* best-effort — never block the triggering action */
  }
}

/** No-op on web: push tokens are registered by the native app only. */
export async function registerForPushNotifications(_userId: string): Promise<void> {
  return;
}

/** No-op on web — the native app owns this device's token. */
export async function unregisterPushToken(): Promise<void> {
  return;
}
