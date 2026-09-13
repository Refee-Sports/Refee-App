// Saves a card on file for the calling director (hirer) so completed games
// can be auto-charged. Returns everything PaymentSheet needs in setup mode.
import { stripe, adminClient, getCaller, json, handleOptions } from "../_shared/util.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = adminClient();
    const { data: hirer } = await admin
      .from("hirers")
      .select("id, org_name, stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!hirer) return json({ error: "Director profile not found" }, 404);

    let customerId = hirer.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: hirer.org_name,
        metadata: { refee_hirer_id: hirer.id, refee_user_id: user.id },
      });
      customerId = customer.id;
      await admin
        .from("hirers")
        .update({ stripe_customer_id: customerId })
        .eq("id", hirer.id);
    }

    const [setupIntent, ephemeralKey] = await Promise.all([
      stripe.setupIntents.create({
        customer: customerId,
        automatic_payment_methods: { enabled: true },
      }),
      // Ephemeral key for the mobile PaymentSheet. If the RN SDK later
      // reports a required API version, pass it here as { apiVersion }.
      stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: "2024-06-20" }
      ),
    ]);

    return json({
      setupIntentClientSecret: setupIntent.client_secret,
      customerId,
      ephemeralKeySecret: ephemeralKey.secret,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
