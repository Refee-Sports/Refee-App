import { supabase } from "@/lib/supabase";
import { activateStagedHeadshot, STAGED_HEADSHOT } from "@/lib/profile/account";

/** Why a file can't be a headshot, or null when it can. */
export function headshotFileError(file: File | null): string | null {
  if (!file) return "Add a headshot to continue.";
  if (!file.type.startsWith("image/")) return "Choose an image file (JPG or PNG).";
  if (file.size > 5 * 1024 * 1024) return "Image must be under 5 MB.";
  return null;
}

/**
 * Sign-up variant of uploadAvatarFile: the profile row doesn't exist yet (and a
 * new profile can't be created without a headshot — migration 0057), so this
 * only stores the photo and returns its URL for the profile write to carry.
 */
export async function uploadSignupHeadshot(
  userId: string,
  file: File
): Promise<{ avatarUrl: string | null; error: Error | null }> {
  const invalid = headshotFileError(file);
  if (invalid) return { avatarUrl: null, error: new Error(invalid) };

  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, await file.arrayBuffer(), { contentType: file.type || "image/jpeg", upsert: true });
  if (error) return { avatarUrl: null, error: new Error(error.message) };

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return { avatarUrl: `${data.publicUrl}?v=${Date.now()}`, error: null };
}

/**
 * Changes the profile photo to one chosen from a file input. Same path as the
 * mobile app's pickAndUploadAvatar: stage it, then set-headshot accepts it
 * (face-matched once the person is verified) and saves it on the profile.
 */
export async function uploadAvatarFile(
  userId: string,
  file: File
): Promise<{ avatarUrl: string | null; error: Error | null }> {
  if (!file.type.startsWith("image/")) {
    return { avatarUrl: null, error: new Error("Choose an image file") };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { avatarUrl: null, error: new Error("Image must be under 10 MB") };
  }

  // Staged, then accepted by set-headshot — which face-matches it against the
  // ID selfie once the person is verified (0068).
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(`${userId}/${STAGED_HEADSHOT}`, await file.arrayBuffer(), {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });
  if (uploadError) {
    return { avatarUrl: null, error: new Error(uploadError.message) };
  }

  return activateStagedHeadshot();
}
