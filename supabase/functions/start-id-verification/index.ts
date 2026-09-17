// Starts (or resumes) a Didit identity check for the signed-in user and hands
// back the hosted page to send them to.
//
// The ID images and the selfie never touch Refee: the person does all of that
// on Didit's pages, and Refee keeps a session id and a status. The decision
// arrives separately, signed, at didit-webhook — this function never trusts a
// status the browser reports back.
import { adminClient, getCaller, handleOptions, json } from "../_shared/util.ts";

const DIDIT_API = "https://verification.didit.me/v3";

type Profile = {
  identity_status: string | null;
  identity_session_id: string | null;
  identity_session_url: string | null;
};

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const apiKey = Deno.env.get("DIDIT_API_KEY");
    const workflowId = Deno.env.get("DIDIT_WORKFLOW_ID");
    const callback = Deno.env.get("DIDIT_CALLBACK_URL");
    if (!apiKey || !workflowId) {
      return json({ error: "Identity verification is not configured." }, 503);
    }

    const admin = adminClient();
    const { data: existing } = await admin
      .from("private_profiles")
      .select("identity_status, identity_session_id, identity_session_url")
      .eq("id", user.id)
      .maybeSingle<Profile>();

    if (existing?.identity_status === "approved") {
      return json({ status: "approved", url: null });
    }

    // Someone who closed the tab mid-check picks the same session back up,
    // rather than spending another one from the monthly allowance.
    if (
      existing?.identity_status === "in_progress" &&
      existing.identity_session_url &&
      existing.identity_session_id
    ) {
      return json({
        status: "in_progress",
        url: existing.identity_session_url,
        sessionId: existing.identity_session_id,
      });
    }

    // A check already with Didit's reviewers isn't something the person can
    // push along; sending them back in would only create a second session.
    if (existing?.identity_status === "in_review") {
      return json({ status: "in_review", url: null });
    }

    const response = await fetch(`${DIDIT_API}/session/`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        workflow_id: workflowId,
        // How the webhook knows whose check this is. Didit echoes it back.
        vendor_data: user.id,
        ...(callback ? { callback } : {}),
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.session_id || !payload?.url) {
      const detail = typeof payload?.detail === "string" ? payload.detail : response.statusText;
      throw new Error(`Didit refused the session (${response.status}): ${detail}`);
    }

    const { error } = await admin
      .from("private_profiles")
      .upsert(
        {
          id: user.id,
          identity_provider: "didit",
          identity_session_id: payload.session_id,
          identity_session_url: payload.url,
          identity_status: "in_progress",
          identity_decision_at: null,
          identity_last_reason: null,
        },
        { onConflict: "id" }
      );
    if (error) throw new Error(error.message);

    return json({ status: "in_progress", url: payload.url, sessionId: payload.session_id });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
