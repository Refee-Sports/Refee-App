// Tells a referee their pay was sent. Every path that marks a payout paid
// (settling a prepaid game, auto-pay, a manual pay, the Stripe webhook, a held
// payout released once they finish Stripe setup) calls notifyPayoutsSent after
// its update. Best-effort: a failed notification never undoes or blocks a payout.
//
// No imports, so the message builder can be unit-tested outside Deno.

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type PaidRow = {
  ref_id: string | null;
  amount_due: number | null;
  job_id: string | null;
  jobs: { title: string | null } | { title: string | null }[] | null;
};

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: "default";
};

/** One message per device of each paid referee. */
export function payoutPushMessages(rows: PaidRow[], tokensByUser: Map<string, string[]>): PushMessage[] {
  const messages: PushMessage[] = [];
  for (const row of rows) {
    const amount = row.amount_due ?? 0;
    if (!row.ref_id || amount <= 0) continue;
    const tokens = tokensByUser.get(row.ref_id);
    if (!tokens || tokens.length === 0) continue;
    const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
    const title = job?.title ?? "your game";
    for (const to of tokens) {
      messages.push({
        to,
        title: "You've been paid",
        body: `$${amount} for ${title} is in your Stripe account and on its way to your bank.`,
        data: { type: "payout", jobId: row.job_id },
        sound: "default",
      });
    }
  }
  return messages;
}

/**
 * Notifies the referees on these assignments that were paid. Pass the ids just
 * marked paid; anything not actually paid, or whose referee turned game
 * updates off, is skipped.
 */
// deno-lint-ignore no-explicit-any
export async function notifyPayoutsSent(admin: any, assignmentIds: string[]): Promise<void> {
  if (assignmentIds.length === 0) return;
  try {
    const { data: rows } = await admin
      .from("job_assignments")
      .select("ref_id, amount_due, job_id, jobs(title)")
      .in("id", assignmentIds)
      .eq("payout_status", "paid");
    const paid = (rows ?? []) as PaidRow[];
    const refIds = [...new Set(paid.map((r) => r.ref_id).filter((id): id is string => !!id))];
    if (refIds.length === 0) return;

    const { data: enabled } = await admin.rpc("notification_enabled_user_ids", {
      p_targets: refIds,
      p_kind: "game_updates",
    });
    const allowed = new Set(
      ((enabled ?? []) as unknown[]).map((row) =>
        typeof row === "string" ? row : (row as { notification_enabled_user_ids: string }).notification_enabled_user_ids
      )
    );
    if (allowed.size === 0) return;

    const { data: tokenRows } = await admin
      .from("push_tokens")
      .select("user_id, token")
      .in("user_id", [...allowed]);
    const tokensByUser = new Map<string, string[]>();
    for (const t of (tokenRows ?? []) as { user_id: string; token: string }[]) {
      tokensByUser.set(t.user_id, [...(tokensByUser.get(t.user_id) ?? []), t.token]);
    }

    const messages = payoutPushMessages(paid.filter((r) => r.ref_id && allowed.has(r.ref_id)), tokensByUser);
    if (messages.length === 0) return;
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
  } catch {
    /* best-effort */
  }
}
