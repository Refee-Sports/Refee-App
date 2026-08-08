// Sends an Expo push notification to one or more users.
// Body: { userIds: string[], title, body, data? }
// Looks up each user's registered tokens and posts to Expo's push API.
//
// NOTE (security): this is invoked by the app after an action (accept,
// message, payment). For MVP that's acceptable; before scaling, move sends
// into DB triggers / validate that the caller is allowed to notify the
// target so a client can't spam arbitrary users.
import { adminClient, getCaller, json, handleOptions } from "../_shared/util.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

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

    const admin = adminClient();
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("token")
      .in("user_id", userIds);

    const messages = (tokens ?? []).map((t) => ({
      to: t.token,
      title,
      body,
      data: data ?? {},
      sound: "default",
    }));

    if (messages.length === 0) return json({ sent: 0 });

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    const result = await res.json();

    return json({ sent: messages.length, expo: result });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
