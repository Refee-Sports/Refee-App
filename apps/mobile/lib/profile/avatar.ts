import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";

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
