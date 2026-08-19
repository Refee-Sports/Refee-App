// Role-based messaging rules. Directional on purpose:
//   • referee ↔ referee            — crews chat freely
//   • referee ↔ assignor           — both ways
//   • director → referee ONLY      — directors can reach refs, but refs can't
//     message directors (keeps the director inbox from becoming a distraction /
//     extra lift). A director↔ref thread is therefore effectively one-way.
//
// Pure + framework-free so it drives both the app UI (which affordances show /
// whether the send box is enabled) and the server RLS policy.

export type MessagingRole = "referee" | "director" | "assignor";

const ALLOWED_RECIPIENTS: Record<MessagingRole, readonly MessagingRole[]> = {
  referee: ["referee", "assignor"],
  director: ["referee"],
  assignor: ["referee"],
};

/** True if a user with role `from` may send a message to a user with role `to`. */
export function canMessage(from: MessagingRole, to: MessagingRole): boolean {
  return ALLOWED_RECIPIENTS[from]?.includes(to) ?? false;
}

/**
 * True if `me` may send into a conversation whose OTHER participants have the
 * given roles — allowed only when `me` can message every one of them. This is
 * what makes a director↔ref thread one-way: the director may send, the ref may not.
 */
export function canSendToParticipants(me: MessagingRole, others: readonly MessagingRole[]): boolean {
  return others.every((role) => canMessage(me, role));
}
