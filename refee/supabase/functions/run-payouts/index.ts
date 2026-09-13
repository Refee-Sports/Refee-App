// Run by pg_cron every 15 minutes (migration 0032, via pg_net). Two passes:
//
// 1. Charge. Upcoming games created since prepay went live that still haven't
//    been charged — the mobile app creates games without calling prepay-game,
//    so this is what makes "charged at creation" hold everywhere, within
//    minutes, for any director with a card on file.
// 2. Pay out. Prepaid games that have completed or been cancelled: pay each
//    ref from the up-front charge and refund what nobody earned. Games
//    auto-complete 24h after they end, so this lands well inside the 48h
//    payout window.
//
// Not callable from the apps: the gateway verifies the JWT, and this function
// then insists on the service_role claim that only the cron job carries.
import { adminClient, json } from "../_shared/util.ts";
import { chargeGameUpFront, settlePrepaidGame } from "../_shared/prepay-stripe.ts";

const BATCH = 50;

function isServiceRole(req: Request): boolean {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return true;
  // The gateway has already verified the signature; only the role is checked here.
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (!isServiceRole(req)) return json({ error: "Forbidden" }, 403);

  const admin = adminClient();
  const charged: unknown[] = [];
  const settled: unknown[] = [];
  const errors: Array<{ jobId: string; error: string }> = [];

  const { data: toCharge, error: chargeQueryError } = await admin
    .from("jobs")
    .select("id, hirers!inner(stripe_customer_id)")
    .eq("prepay_required", true)
    .not("status", "in", "(completed,cancelled)")
    .gt("starts_at", new Date().toISOString())
    .or("payment_status.is.null,payment_status.eq.unpaid")
    .not("hirers.stripe_customer_id", "is", null)
    .limit(BATCH);
  if (chargeQueryError) return json({ error: chargeQueryError.message }, 500);

  for (const job of toCharge ?? []) {
    try {
      const outcome = await chargeGameUpFront(admin, job.id);
      if (outcome.status !== "no_card") charged.push({ jobId: job.id, ...outcome });
    } catch (e) {
      errors.push({ jobId: job.id, error: (e as Error).message });
    }
  }

  const { data: toSettle, error: settleQueryError } = await admin
    .from("jobs")
    .select("id")
    .eq("payment_status", "prepaid")
    .in("status", ["completed", "cancelled"])
    .limit(BATCH);
  if (settleQueryError) return json({ error: settleQueryError.message }, 500);

  for (const job of toSettle ?? []) {
    try {
      settled.push(await settlePrepaidGame(admin, job.id));
    } catch (e) {
      errors.push({ jobId: job.id, error: (e as Error).message });
    }
  }

  return json({ charged, settled, errors });
});
