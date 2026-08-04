// Creates (or reuses) a Stripe Express account for the calling referee and
// returns a hosted onboarding link.
import { stripe, adminClient, getCaller, json, handleOptions } from "../_shared/util.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { returnUrl, refreshUrl } = await req.json();
    const admin = adminClient();

    const { data: priv } = await admin
      .from("private_profiles")
      .select("stripe_account_id, email")
      .eq("id", user.id)
      .maybeSingle();

    let accountId = priv?.stripe_account_id as string | null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: priv?.email ?? undefined,
        capabilities: { transfers: { requested: true } },
        business_type: "individual",
        metadata: { refee_user_id: user.id },
      });
      accountId = account.id;
      await admin
        .from("private_profiles")
        .update({ stripe_account_id: accountId, stripe_account_status: "pending" })
        .eq("id", user.id);
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
