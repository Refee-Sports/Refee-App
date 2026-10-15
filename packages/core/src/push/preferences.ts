import { supabase } from "../client";

// Which kinds of push a person wants. No row means everything is on. Both apps
// read and write the same row; the backend skips anyone who turned a kind off
// (migration 0062).

export type NotificationKind = "new_games" | "crew_messages" | "game_updates";

export type NotificationPreferences = Record<NotificationKind, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  new_games: true,
  crew_messages: true,
  game_updates: true,
};

/** What each switch is called and does, in the order they appear. */
export const NOTIFICATION_SWITCHES: { kind: NotificationKind; label: string; description: string }[] = [
  {
    kind: "new_games",
    label: "New games near me",
    description: "A heads-up when a game that fits your distance, days and minimum rate is posted.",
  },
  {
    kind: "crew_messages",
    label: "Crew messages",
    description: "Messages in your crew chats and direct messages.",
  },
  {
    kind: "game_updates",
    label: "Game updates",
    description: "Changes to a game you're on, confirmations, new applicants, payments sent, and announcements from the director or assignor.",
  },
];

/** A person's saved switches; all on if they never changed anything. */
export async function fetchNotificationPreferences(
  userId: string
): Promise<{ prefs: NotificationPreferences; error: string | null }> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("new_games, crew_messages, game_updates")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { prefs: { ...DEFAULT_NOTIFICATION_PREFERENCES }, error: "We couldn't load your notification settings." };
  }
  const row = (data ?? {}) as Partial<NotificationPreferences>;
  return {
    prefs: {
      new_games: row.new_games ?? true,
      crew_messages: row.crew_messages ?? true,
      game_updates: row.game_updates ?? true,
    },
    error: null,
  };
}

/** Saves one switch, leaving the others as they are. */
export async function saveNotificationPreference(
  userId: string,
  kind: NotificationKind,
  enabled: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: userId, [kind]: enabled }, { onConflict: "user_id" });
  return { error: error ? "We couldn't save that. Try again." : null };
}
