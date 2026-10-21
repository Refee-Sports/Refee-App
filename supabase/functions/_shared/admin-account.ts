// Rules for the admin-account edge function, kept pure so they can be tested
// without Deno or a database.

export type AdminAccountAction = "view_as" | "deactivate" | "reactivate";

export type AdminAccountRequest =
  | { ok: true; action: AdminAccountAction; userId: string; reason: string | null }
  | { ok: false; error: string };

/** Supabase's ban length: about a hundred years, i.e. until staff lift it. */
export const BAN_DURATION = "876000h";

const ACTIONS: AdminAccountAction[] = ["view_as", "deactivate", "reactivate"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * What staff asked for. Looking at someone's account as them and switching it
 * off both go on the record with a reason; letting it back in doesn't need one.
 */
export function parseAdminAccountRequest(body: unknown): AdminAccountRequest {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const action = b.action as AdminAccountAction;
  if (!ACTIONS.includes(action)) return { ok: false, error: "Unknown action." };
  const userId = typeof b.userId === "string" ? b.userId.trim() : "";
  if (!UUID.test(userId)) return { ok: false, error: "That isn't an account id." };
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 500) : "";
  if (action !== "reactivate" && !reason) {
    return { ok: false, error: "Give a reason. It's recorded against your name." };
  }
  return { ok: true, action, userId, reason: reason || null };
}

/**
 * Accounts staff can't act on from here. Staff accounts are managed in the
 * database by hand (0050), so one staff member can never sign in as, or lock
 * out, another, and nobody locks themselves out.
 */
export function refuseAdminAccountAction(args: {
  callerId: string;
  targetId: string;
  targetIsStaff: boolean;
  action: AdminAccountAction;
}): string | null {
  if (args.callerId === args.targetId) return "You can't do that to your own account.";
  if (args.targetIsStaff) return "That's a staff account. Staff accounts are managed in the database.";
  return null;
}
