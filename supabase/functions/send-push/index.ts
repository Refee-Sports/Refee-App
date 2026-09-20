// Sends an Expo push notification to one or more users.
// Body: { userIds: string[], title, body, data? }
// Looks up each user's registered tokens and posts to Expo's push API.
//
// The app invokes this after an action (accept, message, payment), so the
// caller names its own targets — which means the caller has to be checked.
// Every id goes through public.can_notify (migration 0046): a notification is
// only delivered to someone the caller already shares a conversation, game,
// roster or tournament with. Without that filter any signed-in account could
// read every id out of public_profiles and push whatever it liked, with a
// deep-link payload, to the entire platform.
import {
  adminClient,
  getCaller,
  json,
  handleOptions,
  recordUse,
  tooManyRequests,
  withinDailyLimit,
} from "../_shared/util.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// No single action legitimately notifies more than a crew, a roster, or one
// tournament's officials. Past this it's a bug or an attempt.
const MAX_TARGETS = 200;

// Far above what an active director or assignor generates in a day.
const DAILY_LIMIT = Number(Deno.env.get("PUSH_DAILY_LIMIT") ?? "200");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const { userIds, title, body, data } = await req.json();
    if (!Array.isArray(userIds) || userIds.length === 0 || !title || !body) {
      return json({ error: "userIds, title, body required" }, 400);
    }
    if (userIds.length > MAX_TARGETS) {
      return json({ error: "Too many recipients" }, 400);
    }

    // Anything that isn't a user id can't be one of ours; drop it before it
    // reaches a query.
    const requested = [
      ...new Set(
        userIds.filter((id: unknown): id is string =>
          typeof id === "string" && UUID.test(id.trim())
        ).map((id: string) => id.trim())
      ),
    ];
    if (requested.length === 0) return json({ sent: 0, skipped: userIds.length });

    const admin = adminClient();

    if (!(await withinDailyLimit(admin, caller.id, "push_send", DAILY_LIMIT))) {
      return tooManyRequests("Too many notifications sent today.");
    }
    // Counted on attempt: a caller whose targets are all filtered out still
    // spends from the cap, so probing can't run free.
    await recordUse(admin, caller.id, "push_send");

    // Who the caller actually has standing to reach.
    const { data: allowedRows, error: allowedError } = await admin.rpc(
      "notifiable_user_ids",
      { p_caller: caller.id, p_targets: requested }
    );
    if (allowedError) return json({ error: allowedError.message }, 500);

    const allowed = (allowedRows ?? []).map((row: unknown) =>
      typeof row === "string" ? row : (row as { notifiable_user_ids: string }).notifiable_user_ids
    );
    const skipped = requested.length - allowed.length;
    if (allowed.length === 0) return json({ sent: 0, skipped });

    const { data: tokens } = await admin
      .from("push_tokens")
      .select("token")
      .in("user_id", allowed);

    const messages = (tokens ?? []).map((t) => ({
      to: t.token,
      title,
      body,
      data: data ?? {},
      sound: "default",
    }));

    if (messages.length === 0) return json({ sent: 0, skipped });

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    const result = await res.json();

    return json({ sent: messages.length, skipped, expo: result });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
