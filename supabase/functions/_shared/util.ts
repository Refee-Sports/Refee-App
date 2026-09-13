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
