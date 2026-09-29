// Permanently removes the signed-in account after the database has verified
// that no active game or unsettled payment would be orphaned.
import { adminClient, getCaller, handleOptions, json, stripe } from "../_shared/util.ts";

async function fingerprint(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function isMissingStripeResource(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "resource_missing"
  );
}

async function deleteStripeResource(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    // Provider deletion must be retry-safe. A previous attempt may have
    // succeeded even if the response was lost before the local account went.
    if (!isMissingStripeResource(error)) throw error;
  }
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    if (body.confirmation !== "DELETE") {
      return json({ error: "Type DELETE to confirm account deletion." }, 400);
    }

    const admin = adminClient();
    const userFingerprint = await fingerprint(user.id);

    // Check business constraints before touching any external provider. The
    // preparation RPC checks them again to protect against concurrent changes.
    const { data: blocker, error: blockerError } = await admin.rpc("account_deletion_blocker", {
      p_user: user.id,
    });
    if (blockerError) return json({ error: blockerError.message }, 500);
    if (blocker) return json({ error: blocker }, 409);

    const [{ data: privateProfile, error: profileError }, { data: hirer, error: hirerError }] =
      await Promise.all([
        admin
          .from("private_profiles")
          .select("identity_provider, identity_session_id, stripe_account_id")
          .eq("id", user.id)
          .maybeSingle(),
        admin
          .from("hirers")
          .select("id, hirer_billing(stripe_customer_id)")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
    if (profileError) return json({ error: profileError.message }, 500);
    if (hirerError) return json({ error: hirerError.message }, 500);

    const billing = hirer
      ? Array.isArray(hirer.hirer_billing)
        ? hirer.hirer_billing[0]
        : hirer.hirer_billing
      : null;
    const stripeCustomerId = billing?.stripe_customer_id ?? null;

    // Close provider-side accounts before removing their local handles. Stripe
    // refuses a live Connect deletion while a balance remains; surface that as
    // an actionable block instead of silently abandoning the payout account.
    try {
      if (privateProfile?.stripe_account_id) {
        await deleteStripeResource(() => stripe.accounts.del(privateProfile.stripe_account_id!));
      }
      if (stripeCustomerId) {
        await deleteStripeResource(() => stripe.customers.del(stripeCustomerId));
      }
    } catch (error) {
      console.error("Stripe account cleanup failed", error);
      return json(
        {
          error:
            "We could not close your Stripe account. Resolve any remaining balance or payment issue and try again.",
        },
        409
      );
    }

    if (privateProfile?.identity_provider === "didit" && privateProfile.identity_session_id) {
      const diditKey = Deno.env.get("DIDIT_API_KEY");
      if (!diditKey) return json({ error: "Identity-record deletion is temporarily unavailable." }, 503);

      const diditResponse = await fetch(
        `https://verification.didit.me/v1/session/${encodeURIComponent(privateProfile.identity_session_id)}/delete/`,
        { method: "DELETE", headers: { "x-api-key": diditKey } }
      );
      // A retry after a partial network failure may find the record already gone.
      if (!diditResponse.ok && diditResponse.status !== 404) {
        return json({ error: "We could not delete your identity-verification record. Try again." }, 502);
      }
    }

    const { error: prepareError } = await admin.rpc("prepare_account_deletion", {
      p_user: user.id,
      p_fingerprint: userFingerprint,
    });
    if (prepareError) return json({ error: prepareError.message }, 409);

    // Auth deletion is refused while the user owns Storage objects. Remove
    // every avatar in their folder, not only today's canonical filename.
    // The same goes for the private background-check bucket (migration 0057).
    for (const bucket of ["avatars", "background-checks"]) {
      const { data: objects, error: listError } = await admin.storage.from(bucket).list(user.id);
      if (listError) return json({ error: listError.message }, 500);
      if (objects?.length) {
        const paths = objects.map((object) => `${user.id}/${object.name}`);
        const { error: storageError } = await admin.storage.from(bucket).remove(paths);
        if (storageError) return json({ error: storageError.message }, 500);
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false);
    if (deleteError) return json({ error: deleteError.message }, 500);

    await admin
      .from("account_deletion_receipts")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("user_fingerprint", userFingerprint);

    return json({ deleted: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not delete account." }, 500);
  }
});
