// Director pays their crew for a completed (or fee-cancelled) game.
// Creates a PaymentIntent for: sum of unpaid amount_due + platform fee.
import { stripe, adminClient, getCaller, json, handleOptions, PLATFORM_FEE_PCT } from "../_shared/util.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { jobId } = await req.json();
    if (!jobId) return json({ error: "jobId required" }, 400);

    const admin = adminClient();

    // Caller must be the hirer of this job
    const { data: job } = await admin
      .from("jobs")
      .select("id, title, status, payment_status, hirers(user_id)")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) return json({ error: "Game not found" }, 404);
    const hirer = Array.isArray(job.hirers) ? job.hirers[0] : job.hirers;
    if (hirer?.user_id !== user.id) return json({ error: "Not your game" }, 403);
    if (job.status !== "completed" && job.status !== "cancelled") {
      return json({ error: "Game must be completed or cancelled before paying." }, 400);
    }
    if (job.payment_status === "paid") {
      return json({ error: "This game is already paid." }, 400);
    }

    // Unpaid amounts owed to refs
    const { data: owed } = await admin
      .from("job_assignments")
      .select("id, amount_due")
      .eq("job_id", jobId)
      .in("status", ["completed", "cancelled"])
      .eq("payout_status", "pending")
      .gt("amount_due", 0);

    const crewTotal = (owed ?? []).reduce((s, a) => s + (a.amount_due ?? 0), 0);
    if (crewTotal <= 0) return json({ error: "Nothing owed on this game." }, 400);

    const platformFee = Math.round(crewTotal * PLATFORM_FEE_PCT);
    const total = crewTotal + platformFee;

    const intent = await stripe.paymentIntents.create({
      amount: total * 100, // cents
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      description: `Refee crew pay — ${job.title}`,
      metadata: { refee_job_id: jobId, crew_total: String(crewTotal), platform_fee: String(platformFee) },
    });

    await admin
      .from("jobs")
      .update({ payment_intent_id: intent.id, payment_status: "processing" })
      .eq("id", jobId);

    return json({
      clientSecret: intent.client_secret,
      crewTotal,
      platformFee,
      total,
      refCount: (owed ?? []).length,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
