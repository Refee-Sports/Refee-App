import { supabase } from "../client";

/**
 * Sends a push notification to users' registered devices through the send-push
 * edge function. Both apps send it for the same actions — a director approving
 * a ref from a laptop must reach that ref's phone just like the mobile app would.
 * Registering a device's token is native-only and stays in apps/mobile.
 */
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
