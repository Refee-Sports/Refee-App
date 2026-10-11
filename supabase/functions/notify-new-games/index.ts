// Tells the right referees about newly posted games.
// Body: { jobIds: string[] }
//
// The caller says which games were just posted and nothing else. Who hears about
// each one is decided in the database (public.claim_new_game_alerts, migration
// 0062) by the same rules as the feed plus whether the referee can really take
// the game, so a caller can't choose recipients and can't reach anyone a game
// of theirs wouldn't. The caller must also be the one who posted each game (the
// director, or the assignor running its tournament). Asking again for a game
// notifies nobody twice.
//
// One notification per person per request, however many games match them.
import {
  adminClient,
  getCaller,
  json,
  handleOptions,
  recordUse,
  tooManyRequests,
  withinDailyLimit,
} from "../_shared/util.ts";
import {
  buildNewGameNotification,
  chunk,
  groupAlertsByUser,
  type AlertJob,
} from "../_shared/new-game-alerts.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH = 100;

// A bulk import posts a season in one go; nothing legitimate announces more.
const MAX_JOBS = 100;
const DAILY_LIMIT = Number(Deno.env.get("NEW_GAME_ALERT_DAILY_LIMIT") ?? "100");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const { jobIds } = await req.json();
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return json({ error: "jobIds required" }, 400);
    }
    if (jobIds.length > MAX_JOBS) return json({ error: "Too many games" }, 400);

    const requested = [
      ...new Set(
        jobIds
          .filter((id: unknown): id is string => typeof id === "string" && UUID.test(id.trim()))
          .map((id: string) => id.trim())
      ),
    ];
    if (requested.length === 0) return json({ alerted: 0, games: 0, skipped: jobIds.length });

    const admin = adminClient();

    if (!(await withinDailyLimit(admin, caller.id, "new_game_alert", DAILY_LIMIT))) {
      return tooManyRequests("Too many game announcements today.");
    }
    await recordUse(admin, caller.id, "new_game_alert");

    // Only games the caller posted, and only the first time each is announced.
    const rows: { userId: string; jobId: string; miles: number | null }[] = [];
    const announced: string[] = [];
    let skipped = jobIds.length - requested.length;

    for (const jobId of requested) {
      const { data: allowed, error: allowedError } = await admin.rpc("can_alert_for_job", {
        p_caller: caller.id,
        p_job_id: jobId,
      });
      if (allowedError) return json({ error: allowedError.message }, 500);
      if (!allowed) {
        skipped += 1;
        continue;
      }

      const { data: claimed, error: claimError } = await admin.rpc("claim_new_game_alerts", {
        p_job_id: jobId,
      });
      if (claimError) return json({ error: claimError.message }, 500);

      announced.push(jobId);
      for (const row of (claimed ?? []) as { user_id: string; distance_miles: number | null }[]) {
        rows.push({
          userId: row.user_id,
          jobId,
          miles: row.distance_miles == null ? null : Number(row.distance_miles),
        });
      }
    }

    if (rows.length === 0) return json({ alerted: 0, games: announced.length, skipped });

    const { data: jobRows, error: jobError } = await admin
      .from("jobs")
      .select("id, title, starts_at, timezone, pay_per_game")
      .in("id", announced);
    if (jobError) return json({ error: jobError.message }, 500);
    const jobsById = new Map((jobRows ?? []).map((j) => [j.id as string, j]));

    const byUser = groupAlertsByUser(rows);
    const { data: tokenRows } = await admin
      .from("push_tokens")
      .select("user_id, token")
      .in("user_id", [...byUser.keys()]);

    const tokensByUser = new Map<string, string[]>();
    for (const t of tokenRows ?? []) {
      const list = tokensByUser.get(t.user_id as string) ?? [];
      list.push(t.token as string);
      tokensByUser.set(t.user_id as string, list);
    }

    const messages: Record<string, unknown>[] = [];
    let alerted = 0;
    for (const [userId, games] of byUser) {
      const tokens = tokensByUser.get(userId);
      if (!tokens || tokens.length === 0) continue;

      const alertJobs: AlertJob[] = games.flatMap((g) => {
        const job = jobsById.get(g.jobId);
        if (!job) return [];
        return [{
          id: job.id as string,
          title: job.title as string,
          starts_at: job.starts_at as string,
          timezone: (job.timezone as string | null) ?? null,
          pay_per_game: (job.pay_per_game as number | null) ?? null,
          distanceMiles: g.miles,
        }];
      });
      if (alertJobs.length === 0) continue;

      const note = buildNewGameNotification(alertJobs);
      alerted += 1;
      for (const to of tokens) {
        messages.push({ to, title: note.title, body: note.body, data: note.data, sound: "default" });
      }
    }

    for (const batch of chunk(messages, EXPO_BATCH)) {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
    }

    return json({ alerted, games: announced.length, skipped });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
