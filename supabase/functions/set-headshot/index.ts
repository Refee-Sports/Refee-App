// Makes the photo the signed-in person staged at avatars/<uid>/pending.jpg
// their profile photo.
//
// Before their ID is verified it's accepted as is (sign-up and fixing a bad
// photo). After, the face has to match the live selfie from their ID check —
// otherwise a verified badge could sit under someone else's face. Didit does
// the comparison; Refee never stores the selfie, it fetches a fresh signed URL
// from the session decision each time.
import { adminClient, getCaller, handleOptions, json, recordUse, tooManyRequests, withinDailyLimit } from "../_shared/util.ts";
import { faceMatchOutcome, livenessReferenceImage } from "../_shared/didit.ts";

const DIDIT_API = "https://verification.didit.me/v3";
const PENDING = "pending.jpg";
const AVATAR = "avatar.jpg";

// Each comparison is billable; a person changing their photo needs a few tries, not dozens.
const DAILY_LIMIT = Number(Deno.env.get("HEADSHOT_MATCH_DAILY_LIMIT") ?? "5");
// Similarity (0–100) a photo must beat. Didit's default is 30; a profile photo
// should be clearly the same person.
const THRESHOLD = Number(Deno.env.get("HEADSHOT_MATCH_THRESHOLD") ?? "50");

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = adminClient();
    const pendingPath = `${user.id}/${PENDING}`;
    const { data: pending, error: downloadError } = await admin.storage.from("avatars").download(pendingPath);
    if (downloadError || !pending) return json({ error: "Upload a photo first." }, 400);

    const { data: profile } = await admin
      .from("private_profiles")
      .select("identity_status, identity_session_id")
      .eq("id", user.id)
      .maybeSingle<{ identity_status: string | null; identity_session_id: string | null }>();

    if (profile?.identity_status === "approved") {
      const apiKey = Deno.env.get("DIDIT_API_KEY");
      if (!apiKey || !profile.identity_session_id) {
        return json({ error: "Photo checks aren't available right now. Try again later." }, 503);
      }
      if (!(await withinDailyLimit(admin, user.id, "headshot_match", DAILY_LIMIT))) {
        return tooManyRequests("You've tried too many photos today. Try again tomorrow.");
      }

      const decisionResponse = await fetch(`${DIDIT_API}/session/${profile.identity_session_id}/decision/`, {
        headers: { "x-api-key": apiKey },
      });
      const decision = await decisionResponse.json().catch(() => null);
      const referenceUrl = decisionResponse.ok && decision ? livenessReferenceImage(decision) : null;
      if (!referenceUrl) {
        return json({ error: "We couldn't find the selfie from your ID check. Contact Refee support." }, 409);
      }
      const reference = await fetch(referenceUrl);
      if (!reference.ok) return json({ error: "Photo checks aren't available right now. Try again later." }, 503);

      const form = new FormData();
      form.append("user_image", pending, "candidate.jpg");
      form.append("ref_image", await reference.blob(), "reference.jpg");
      form.append("face_match_score_decline_threshold", String(THRESHOLD));
      form.append("rotate_image", "true");
      form.append("save_api_request", "false");
      form.append("vendor_data", user.id);

      const matchResponse = await fetch(`${DIDIT_API}/face-match/`, {
        method: "POST",
        headers: { "x-api-key": apiKey },
        body: form,
      });
      const matchPayload = await matchResponse.json().catch(() => null);
      // Counted once Didit has been asked, whatever it answered.
      await recordUse(admin, user.id, "headshot_match");
      if (!matchResponse.ok) {
        return json({ error: "Photo checks aren't available right now. Try again later." }, 502);
      }

      const { matched } = faceMatchOutcome(matchPayload);
      if (!matched) {
        await admin.storage.from("avatars").remove([pendingPath]);
        return json(
          { error: "This photo doesn't look like the person on your verified ID. Use a clear, recent photo of your face." },
          422
        );
      }
    }

    // Accepted: it becomes the avatar file, and the profile points at it.
    const avatarPath = `${user.id}/${AVATAR}`;
    const { error: uploadError } = await admin.storage
      .from("avatars")
      .upload(avatarPath, pending, { contentType: "image/jpeg", upsert: true });
    if (uploadError) throw new Error(uploadError.message);
    await admin.storage.from("avatars").remove([pendingPath]);

    const { data: urlData } = admin.storage.from("avatars").getPublicUrl(avatarPath);
    // Locally SUPABASE_URL is the internal gateway (http://kong:8000), which a
    // phone or browser can't load; PUBLIC_SUPABASE_URL overrides it there.
    const publicBase = Deno.env.get("PUBLIC_SUPABASE_URL");
    const publicUrl = publicBase
      ? urlData.publicUrl.replace(Deno.env.get("SUPABASE_URL") ?? "", publicBase.replace(/\/$/, ""))
      : urlData.publicUrl;
    // Cache-bust so the new photo shows straight away.
    const avatarUrl = `${publicUrl}?v=${Date.now()}`;
    const { error: profileError } = await admin
      .from("public_profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.id);
    if (profileError) throw new Error(profileError.message);

    return json({ avatarUrl });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
