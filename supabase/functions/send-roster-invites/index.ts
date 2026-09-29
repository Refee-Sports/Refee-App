// Emails the people an assignor has invited to their roster.
// Body: { emails: string[] }
//
// The invites themselves already exist (invite_to_roster_by_email, migration
// 0057 — existing referees get an in-app invite, everyone else a pending one).
// This only delivers the "join my roster" email, so it is deliberately narrow:
// it sends to an address only if the caller has a *pending* invite to it, which
// means it cannot be used to email arbitrary strangers.
//
// Needs RESEND_API_KEY (and optionally ROSTER_INVITE_FROM, WEB_URL). Without a
// key it reports { sent: 0, configured: false } so the app can say the email
// wasn't sent instead of pretending it was.
import {
  adminClient,
  getCaller,
  json,
  handleOptions,
  recordUse,
  tooManyRequests,
  withinDailyLimit,
} from "../_shared/util.ts";

const DAILY_LIMIT = Number(Deno.env.get("ROSTER_EMAIL_DAILY_LIMIT") ?? "500");
const MAX_PER_CALL = 500;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const { emails } = await req.json();
    if (!Array.isArray(emails) || emails.length === 0) {
      return json({ error: "emails required" }, 400);
    }
    if (emails.length > MAX_PER_CALL) return json({ error: "Too many emails" }, 400);

    const requested = [
      ...new Set(
        emails
          .filter((e: unknown): e is string => typeof e === "string")
          .map((e: string) => e.trim().toLowerCase())
      ),
    ];

    const admin = adminClient();

    // Only addresses the caller has a pending invite for.
    const { data: pending, error: pendingError } = await admin
      .from("roster_email_invites")
      .select("email")
      .eq("assignor_id", caller.id)
      .eq("status", "pending")
      .in("email", requested);
    if (pendingError) return json({ error: pendingError.message }, 500);
    const targets = (pending ?? []).map((r: { email: string }) => r.email);
    if (targets.length === 0) return json({ sent: 0, configured: true, skipped: requested.length });

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return json({ sent: 0, configured: false, skipped: targets.length });

    if (!(await withinDailyLimit(admin, caller.id, "roster_email", DAILY_LIMIT))) {
      return tooManyRequests("Too many invitation emails sent today.");
    }
    await recordUse(admin, caller.id, "roster_email");

    const { data: profile } = await admin
      .from("public_profiles")
      .select("display_name")
      .eq("id", caller.id)
      .maybeSingle();
    const { data: codeRow } = await admin
      .from("assignor_invite_codes")
      .select("code")
      .eq("assignor_id", caller.id)
      .maybeSingle();

    const webUrl = (Deno.env.get("WEB_URL") ?? "https://refee.app").replace(/\/$/, "");
    const link = codeRow?.code ? `${webUrl}/join/${codeRow.code}` : webUrl;
    const from = Deno.env.get("ROSTER_INVITE_FROM") ?? "Refee <invites@refee.app>";
    const name = profile?.display_name ?? "An assignor";

    let sent = 0;
    for (const to of targets) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          subject: `${name} invited you to their referee roster on Refee`,
          html:
            `<p>${escapeHtml(name)} invited you to join their roster of referees on Refee.</p>` +
            `<p><a href="${escapeHtml(link)}">Join the roster</a></p>` +
            `<p>New to Refee? Download the app, create your account with this email address, ` +
            `and the invitation will be waiting for you.</p>`,
          text:
            `${name} invited you to join their roster of referees on Refee.\n\n` +
            `Join the roster: ${link}\n\n` +
            `New to Refee? Download the app and create your account with this email address; ` +
            `the invitation will be waiting for you.`,
        }),
      });
      if (res.ok) sent++;
    }

    return json({ sent, configured: true, skipped: requested.length - targets.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
