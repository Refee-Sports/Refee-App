// Web side of push notifications. Sending is shared with the mobile app and
// lives in @refee/core; registering a device's token is native-only.
import "@/lib/core";

export { sendPush } from "@refee/core/push/send";

/** No-op on web: push tokens are registered by the native app only. */
export async function registerForPushNotifications(_userId: string): Promise<void> {
  return;
}

/** No-op on web — the native app owns this device's token. */
export async function unregisterPushToken(): Promise<void> {
  return;
}
