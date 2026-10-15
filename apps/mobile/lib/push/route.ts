// Where tapping a push notification should take someone. The notification's
// data comes from our backend, but it is still just data: ids are checked to be
// ids before they become part of a path, and anything unrecognised goes nowhere.

type Role = "referee" | "director" | "assignor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idOf(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

export function routeForNotification(data: unknown, role: Role | null): string | null {
  if (!role || typeof data !== "object" || data === null) return null;
  const { type, jobId, conversationId } = data as Record<string, unknown>;

  switch (type) {
    // Games reach referees, so these only open for a referee.
    case "new_game":
    case "accepted":
    case "reconfirm": {
      const id = idOf(jobId);
      return role === "referee" && id ? `/job/${id}` : null;
    }
    // Applications, withdrawals and late reports, sent to whoever runs the game.
    case "game_update": {
      const id = idOf(jobId);
      if (!id) return null;
      if (role === "director") return `/(director)/game/${id}`;
      if (role === "assignor") return `/(assignor)/game/${id}`;
      return `/job/${id}`;
    }
    case "payout":
      return role === "referee" ? "/earnings" : null;
    case "new_games":
      return role === "referee" ? "/(app)/(tabs)/jobs" : null;
    case "message": {
      const id = idOf(conversationId);
      if (!id) return null;
      return `/(${role === "referee" ? "app" : role})/conversation/${id}`;
    }
    default:
      return null;
  }
}
