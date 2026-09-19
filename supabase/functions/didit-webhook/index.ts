// Didit's decision on an identity check.
//
// This is the only thing that moves someone to "approved" — the browser can
// claim whatever it likes on the way back from Didit's pages, so the redirect
// only ever shows a waiting screen. Didit signs every delivery and retries it
// until we answer, so: verify the signature, reserve the event by id, do the
// small amount of work inline, and answer well inside its five-second budget.
import { adminClient, json } from "../_shared/util.ts";
import {
  extractDateOfBirth,
  isKnownMinor,
  mapStatus,
  verifySignature,
  type IdentityStatus,
} from "../_shared/didit.ts";

type AdminClient = ReturnType<typeof adminClient>;

/**
 * A stable id for this delivery. Didit's v3 payloads carry one; when a payload
 * doesn't, the session and the decision it reports identify it just as well —
 * a retry of the same decision dedupes, a genuinely new decision doesn't.
 */
function eventKey(body: Record<string, unknown>): string {
  const given = body.event_id ?? body.id;
  if (typeof given === "string" && given.length > 0) return given;
  const stamp = body.created_at ?? body.timestamp ?? "";
  return `${body.session_id ?? "unknown"}:${body.status ?? "unknown"}:${stamp}`;
}

async function reserveEvent(
  admin: AdminClient,
  key: string,
  type: string,
  sessionId: string | null
): Promise<boolean> {
  const { error } = await admin.from("didit_webhook_events").insert({
    event_id: key,
    event_type: type,
    session_id: sessionId,
    status: "processing",
  });

  if (!error) return true;
  if (error.code !== "23505") throw new Error(error.message);

  const { data: existing, error: readError } = await admin
    .from("didit_webhook_events")
    .select("status, received_at, attempts")
    .eq("event_id", key)
    .single();
  if (readError) throw new Error(readError.message);
  if (existing.status === "processed") return false;

  // A failed delivery can retry at once; one still marked processing is
  // reclaimed after five minutes, in case the worker holding it died.
  const stale = Date.now() - new Date(existing.received_at).getTime() > 5 * 60_000;
  if (existing.status === "processing" && !stale) return false;

  const { error: retryError } = await admin
    .from("didit_webhook_events")
    .update({
      status: "processing",
      attempts: (existing.attempts ?? 1) + 1,
      received_at: new Date().toISOString(),
      error: null,
    })
    .eq("event_id", key);
  if (retryError) throw new Error(retryError.message);
  return true;
}

/** Short, human-readable, and free of anything personal. */
function reasonFor(body: Record<string, unknown>): string | null {
  const decision = (body.decision ?? {}) as Record<string, unknown>;
  const candidates = [body.reason, decision.reason, decision.status_reason, body.status_reason];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim().slice(0, 200);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("DIDIT_WEBHOOK_SECRET") ?? "";
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const check = await verifySignature({
    body,
    signature: req.headers.get("x-signature-v2") ?? req.headers.get("X-Signature-V2"),
    timestamp: req.headers.get("x-timestamp") ?? req.headers.get("X-Timestamp"),
    secret,
  });
  if (!check.ok) return json({ error: check.reason }, 401);

  const admin = adminClient();
  const key = eventKey(body);
  const sessionId = typeof body.session_id === "string" ? body.session_id : null;
  const eventType = typeof body.webhook_type === "string"
    ? body.webhook_type
    : typeof body.event_type === "string"
      ? body.event_type
      : "status.updated";

  try {
    const shouldProcess = await reserveEvent(admin, key, eventType, sessionId);
    if (!shouldProcess) return json({ received: true, duplicate: true });

    const status = mapStatus(typeof body.status === "string" ? body.status : null);
    const userId = typeof body.vendor_data === "string" ? body.vendor_data : null;
    const now = new Date().toISOString();

    // Whose check this is: the id we handed Didit at creation, confirmed
    // against the session we stored. An event for neither is not ours.
    let query = admin.from("private_profiles").select("id, identity_session_id");
    query = userId ? query.eq("id", userId) : query.eq("identity_session_id", sessionId ?? "");
    const { data: profile, error: profileError } = await query.maybeSingle();
    if (profileError) throw new Error(profileError.message);

    if (!profile || (sessionId && profile.identity_session_id && profile.identity_session_id !== sessionId)) {
      await admin
        .from("didit_webhook_events")
        .update({ status: "processed", processed_at: now, error: "No matching Refee account" })
        .eq("event_id", key);
      return json({ received: true, ignored: true });
    }

    // Refee is 18+ (migration 0043). Didit read this date off a government
    // ID, so it settles the question: a minor is declined here whatever else
    // the check found, and whatever date they typed at sign-up.
    const dateOfBirth = extractDateOfBirth(body);
    const minor = isKnownMinor(dateOfBirth);
    const decided: IdentityStatus = minor ? "declined" : status;

    const approved = decided === "approved";
    const patch: Record<string, unknown> = {
      identity_status: decided,
      identity_session_id: sessionId ?? profile.identity_session_id,
      identity_decision_at: now,
      identity_last_reason: minor ? "Under 18" : reasonFor(body),
      identity_verified_at: approved ? now : null,
    };
    // The verified date replaces whatever was self-reported.
    if (dateOfBirth) patch.date_of_birth = dateOfBirth;
    // A check that has finished — however it finished — has nothing left to
    // resume, so the hosted link goes. One still in progress keeps it.
    if (decided !== "in_progress") patch.identity_session_url = null;

    const { error: updateError } = await admin
      .from("private_profiles")
      .update(patch)
      .eq("id", profile.id);
    if (updateError) throw new Error(updateError.message);

    // The badge both apps already show. It follows the decision in both
    // directions, so an approval that is later taken away closes the gates.
    const { error: badgeError } = await admin
      .from("public_profiles")
      .update({ is_verified: approved })
      .eq("id", profile.id);
    if (badgeError) throw new Error(badgeError.message);

    // Directors are verified as people; their organizer record says so too.
    const { error: hirerError } = await admin
      .from("hirers")
      .update({ is_verified: approved })
      .eq("user_id", profile.id);
    if (hirerError) throw new Error(hirerError.message);

    const { error: ledgerError } = await admin
      .from("didit_webhook_events")
      .update({ status: "processed", processed_at: now, error: null })
      .eq("event_id", key);
    if (ledgerError) throw new Error(ledgerError.message);

    return json({ received: true, status: decided });
  } catch (error) {
    await admin
      .from("didit_webhook_events")
      .update({ status: "failed", error: (error as Error).message.slice(0, 1000) })
      .eq("event_id", key);
    return json({ error: (error as Error).message }, 500);
  }
});
