import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";

// ── Sign-up headshot ─────────────────────────────────────────────────────────
// A headshot is required to create a profile (migration 0057), and the profile
// row doesn't exist yet during sign-up — so these two steps only pick a photo
// and put it in storage. The profile write that follows carries the URL.

export type PickedHeadshot = { uri: string };

/** Take a photo with the camera, or choose one from the library. */
export async function pickHeadshot(
  source: "camera" | "library"
): Promise<{ photo: PickedHeadshot | null; error: Error | null; cancelled: boolean }> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return {
      photo: null,
      cancelled: false,
      error: new Error(
        source === "camera"
          ? "Camera access is off. Choose a photo from your library instead, or allow the camera in Settings."
          : "Photo access is off. Take a photo instead, or allow photo access in Settings."
      ),
    };
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front })
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets?.[0]) return { photo: null, error: null, cancelled: true };
  return { photo: { uri: result.assets[0].uri }, error: null, cancelled: false };
}

/** Uploads a picked headshot to `<userId>/avatar.jpg` and returns its public URL. */
export async function uploadSignupHeadshot(
  userId: string,
  photo: PickedHeadshot
): Promise<{ avatarUrl: string | null; error: Error | null }> {
  const response = await fetch(photo.uri);
  const arrayBuffer = await response.arrayBuffer();
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, arrayBuffer, { contentType: "image/jpeg", upsert: true });
  if (error) return { avatarUrl: null, error: new Error(error.message) };

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return { avatarUrl: `${data.publicUrl}?v=${Date.now()}`, error: null };
}

/**
 * Opens the photo library, uploads the chosen headshot to the avatars
 * bucket at `<userId>/avatar.jpg`, and saves the public URL on the profile.
 */
export async function pickAndUploadAvatar(
  userId: string
): Promise<{ avatarUrl: string | null; error: Error | null; cancelled: boolean }> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { avatarUrl: null, error: new Error("Photo library access denied"), cancelled: false };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { avatarUrl: null, error: null, cancelled: true };
  }

  const asset = result.assets[0];
  const response = await fetch(asset.uri);
  const arrayBuffer = await response.arrayBuffer();

  const path = `${userId}/avatar.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, arrayBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (uploadError) {
    return { avatarUrl: null, error: new Error(uploadError.message), cancelled: false };
  }

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
  // cache-bust so the new photo shows immediately after re-upload
  const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  const { error: profileError } = await supabase
    .from("public_profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId);

  if (profileError) {
    return { avatarUrl: null, error: new Error(profileError.message), cancelled: false };
  }

  return { avatarUrl, error: null, cancelled: false };
}
