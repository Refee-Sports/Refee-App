import { supabase } from "../client";
import type { NotificationKind } from "./preferences";

/**
 * Sends a push notification to users' registered devices through the send-push
 * edge function. Both apps send it for the same actions — a director approving
 * a ref from a laptop must reach that ref's phone just like the mobile app would.
 * Registering a device's token is native-only and stays in apps/mobile.
 *
 * `kind` says which of a person's notification switches applies (new games,
 * crew messages, game updates); anyone who turned that kind off is skipped.
 */
export async function sendPush(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  kind?: NotificationKind
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    await supabase.functions.invoke("send-push", {
      body: { userIds, title, body, data, kind },
    });
  } catch {
    /* best-effort — never block the triggering action */
  }
}

/** The most games one announcement request carries (the backend caps it too). */
const NEW_GAME_BATCH = 100;

/**
 * Asks the backend to tell the referees a new game suits. Pass only the ids of
 * games you just posted: the backend checks you posted them, decides who hears
 * (distance, days, rate, availability, preferences) and sends one notification
 * per person. Best-effort — posting a game never fails because an alert did.
 */
export async function notifyNewGames(jobIds: string[]): Promise<void> {
  const ids = [...new Set(jobIds.filter((id) => typeof id === "string" && id.length > 0))];
  for (let i = 0; i < ids.length; i += NEW_GAME_BATCH) {
    try {
      await supabase.functions.invoke("notify-new-games", {
        body: { jobIds: ids.slice(i, i + NEW_GAME_BATCH) },
      });
    } catch {
      /* best-effort */
    }
  }
}
