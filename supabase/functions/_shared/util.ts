import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

// No pinned apiVersion — uses the SDK's built-in default, which is always
// valid for the installed stripe package (avoids "invalid API version" on
// first run against a fresh account).
export const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "");

// Payout math (fee %, charge total, idempotency decision) lives in one pure,
// testable module. Re-exported here so existing imports keep working.
export { PLATFORM_FEE_PCT, platformFee, chargeTotal, decidePayment } from "./pay-math.ts";

/** Service-role client — bypasses RLS. Only use after verifying the caller. */
export const adminClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

/** Resolves the calling user from the request's Authorization header. */
export async function getCaller(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await client.auth.getUser();
  return user;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return null;
}

/**
 * A per-user, per-day ceiling on calls to an endpoint.
 *
 * Every function here checks who the caller is and what they own, so these
 * caps are not the access control — they are the backstop for the case where
 * a valid account hammers something that costs money on each call (Stripe
 * requests, push deliveries, a vendor's per-session fee). The limits are set
 * far above what the apps do in a day, so hitting one means a loop or an
 * attempt, not a busy director.
 *
 * Counted in ai_events, the same ledger the AI import and ID checks use.
 */
export async function withinDailyLimit(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  kind: string,
  limit: number
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { count, error } = await admin
    .from("ai_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("created_at", since);
  if (error) throw new Error(error.message);
  return (count ?? 0) < limit;
}

/** Records one use against a daily limit. Best effort: never fails the call. */
export async function recordUse(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  kind: string
): Promise<void> {
  await admin.from("ai_events").insert({ user_id: userId, kind }).then(
    () => undefined,
    () => undefined
  );
}

/** The 429 every rate-limited endpoint returns, in the same shape. */
export function tooManyRequests(message: string) {
  return json({ error: message }, 429);
}
