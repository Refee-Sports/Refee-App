import { supabase } from "@/lib/supabase";

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
 * Uploads a headshot chosen from a file input to the avatars bucket at
 * `<userId>/avatar.jpg` and saves the public URL on the profile.
 *
 * Same storage path and same `public_profiles.avatar_url` write as the mobile
 * app's pickAndUploadAvatar — a photo set on the web shows up in the app.
 * The only difference is where the image comes from: `<input type="file">`
 * here, the native photo library there.
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

  const arrayBuffer = await file.arrayBuffer();
  const path = `${userId}/avatar.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, arrayBuffer, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

  if (uploadError) {
    return { avatarUrl: null, error: new Error(uploadError.message) };
  }

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
  // cache-bust so the new photo shows immediately after re-upload
  const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  const { error: profileError } = await supabase
    .from("public_profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId);

  if (profileError) {
    return { avatarUrl: null, error: new Error(profileError.message) };
  }

  return { avatarUrl, error: null };
}
