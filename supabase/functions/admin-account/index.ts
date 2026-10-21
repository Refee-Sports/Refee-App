// Staff actions that need the auth admin API: signing in as someone to see
// what they see, and turning sign-in off or back on.
//
// The caller must be in public.admins (0050). Every action is recorded in
// admin_actions with the reason staff gave.
import { adminClient, getCaller, handleOptions, json } from "../_shared/util.ts";
import {
  BAN_DURATION,
  parseAdminAccountRequest,
  refuseAdminAccountAction,
} from "../_shared/admin-account.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const admin = adminClient();
    const { data: isStaff, error: staffError } = await admin.rpc("is_admin", { p_user: caller.id });
    if (staffError) return json({ error: staffError.message }, 500);
    if (isStaff !== true) return json({ error: "Staff access required." }, 403);

    const request = parseAdminAccountRequest(await req.json().catch(() => null));
    if (!request.ok) return json({ error: request.error }, 400);
    const { action, userId, reason } = request;

    const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
    if (targetError || !target?.user) return json({ error: "No such account." }, 404);

    const { data: targetIsStaff } = await admin.rpc("is_admin", { p_user: userId });
    const refusal = refuseAdminAccountAction({
      callerId: caller.id,
      targetId: userId,
      targetIsStaff: targetIsStaff === true,
      action,
    });
    if (refusal) return json({ error: refusal }, 403);

    const record = (detail: Record<string, unknown>) =>
      admin.from("admin_actions").insert({
        admin_id: caller.id,
        action: `account.${action}`,
        subject_user_id: userId,
        detail,
      });

    if (action === "view_as") {
      const email = target.user.email;
      if (!email) return json({ error: "This account signs in by phone, so there's no link to make." }, 400);
      if (target.user.banned_until && new Date(target.user.banned_until) > new Date()) {
        return json({ error: "This account is deactivated. Reactivate it first." }, 409);
      }
      // A one-time sign-in token. Nothing is emailed: the token comes back to
      // staff, and the page that redeems it never sends it to a server.
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      const tokenHash = link?.properties?.hashed_token;
      if (linkError || !tokenHash) return json({ error: linkError?.message ?? "Couldn't make a link." }, 500);
      const { error: logError } = await record({ reason });
      // No record, no access.
      if (logError) return json({ error: logError.message }, 500);
      return json({ tokenHash, email });
    }

    if (action === "deactivate") {
      const { error: banError } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: BAN_DURATION,
      });
      if (banError) return json({ error: banError.message }, 500);

      // Out of the pool too, the way a suspension does it. An existing
      // suspension keeps its own reason.
      const { data: profile } = await admin
        .from("private_profiles")
        .select("suspended_at")
        .eq("id", userId)
        .maybeSingle();
      if (!profile?.suspended_at) {
        await admin
          .from("private_profiles")
          .update({
            suspended_at: new Date().toISOString(),
            suspended_reason: `Deactivated: ${reason}`,
            suspended_by: caller.id,
          })
          .eq("id", userId);
      }
      await admin.from("public_profiles").update({ is_available: false, is_active: false }).eq("id", userId);
      await record({ reason });
      return json({ ok: true });
    }

    // reactivate
    const { error: unbanError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
    if (unbanError) return json({ error: unbanError.message }, 500);
    // Lift only the suspension that deactivating added; one staff set for its
    // own reason stays until someone reinstates it.
    await admin
      .from("private_profiles")
      .update({ suspended_at: null, suspended_reason: null, suspended_by: null })
      .eq("id", userId)
      .like("suspended_reason", "Deactivated: %");
    await record({ reason });
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
