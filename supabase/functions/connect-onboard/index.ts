// Creates (or reuses) a Stripe Express account for the calling referee and
// returns a hosted onboarding link.
import {
  adminClient,
  getCaller,
  handleOptions,
  json,
  recordUse,
  stripe,
  tooManyRequests,
  withinDailyLimit,
} from "../_shared/util.ts";

// Backstop against a loop or an abusive account burning Stripe calls.
// Far above real use; see withinDailyLimit in _shared/util.ts.
const DAILY_LIMIT = Number(Deno.env.get("CONNECT_ONBOARD_DAILY_LIMIT") ?? "50");

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { returnUrl, refreshUrl } = await req.json();
    const admin = adminClient();

    if (!(await withinDailyLimit(admin, user.id, "connect_onboard", DAILY_LIMIT))) {
      return tooManyRequests("Too many payout setup attempts today.");
    }
    // Counted on attempt, so failures count against the cap too.
    await recordUse(admin, user.id, "connect_onboard");

    const { data: priv } = await admin
      .from("private_profiles")
      .select("stripe_account_id, email")
      .eq("id", user.id)
      .maybeSingle();

    let accountId = priv?.stripe_account_id as string | null;

    if (!accountId) {
      // Reuse an account previously created for this user (a prior attempt may
      // have created + onboarded one without persisting its id), preferring the
      // most-complete match, so the ref doesn't have to onboard again.
      const existing = await stripe.accounts.list({ limit: 100 });
      const mine = existing.data.filter((a) => a.metadata?.refee_user_id === user.id);
      const reuse =
        mine.find((a) => a.payouts_enabled) ??
        mine.find((a) => a.details_submitted) ??
        mine[0];

      if (reuse) {
        accountId = reuse.id;
      } else {
        const account = await stripe.accounts.create({
          type: "express",
          email: priv?.email ?? undefined,
          capabilities: { transfers: { requested: true } },
          business_type: "individual",
          metadata: { refee_user_id: user.id },
        });
        accountId = account.id;
      }

      // Upsert (not update) — referee onboarding may not have created a
      // private_profiles row yet, so an update would silently save nothing.
      await admin
        .from("private_profiles")
        .upsert(
          { id: user.id, stripe_account_id: accountId, stripe_account_status: "pending" },
          { onConflict: "id" }
        );
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl ?? returnUrl ?? "https://refee.app/payouts/refresh",
      return_url: returnUrl ?? "https://refee.app/payouts/done",
      type: "account_onboarding",
    });

    return json({ url: link.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
