// Called by the director's app right after it creates a game: charge the
// saved card for the whole crew now, so the refs' pay is already collected
// when the game finishes. Always answers 200 with a status the app can act on
// — "no_card" means ask the director to save a card, then call again.
import { adminClient, getCaller, handleOptions, json } from "../_shared/util.ts";
import { chargeGameUpFront } from "../_shared/prepay-stripe.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { jobId } = await req.json();
    if (!jobId) return json({ error: "jobId required" }, 400);

    const admin = adminClient();
    const { data: job } = await admin
      .from("jobs")
      .select("id, hirers(user_id)")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) return json({ error: "Game not found" }, 404);
    const hirer = Array.isArray(job.hirers) ? job.hirers[0] : job.hirers;
    if (hirer?.user_id !== user.id) return json({ error: "Not your game" }, 403);

    return json(await chargeGameUpFront(admin, jobId));
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
