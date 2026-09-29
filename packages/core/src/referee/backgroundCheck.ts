import { supabase } from "../client";

// A referee can upload their background check (PDF or photo). It counts for one
// year from the upload date — the database sets the expiry, never the client
// (migration 0057) — and shows as a badge to directors and assignors.

/** How long before expiry we start nudging people to upload a fresh one. */
export const BACKGROUND_CHECK_WARNING_DAYS = 30;

export const BACKGROUND_CHECK_BUCKET = "background-checks";
export const BACKGROUND_CHECK_MAX_BYTES = 10 * 1024 * 1024;
export const BACKGROUND_CHECK_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

export type BackgroundCheckState = "none" | "valid" | "expiring" | "expired";

export type BackgroundCheckRow = {
  id: string;
  file_path: string;
  file_name: string | null;
  uploaded_at: string;
  expires_at: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `now` until `expiresAt` (negative once expired). */
export function daysUntilExpiry(expiresAt: string, now: Date = new Date()): number {
  return Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / DAY_MS);
}

/** none → nothing uploaded; expiring → within the warning window; expired → past the year. */
export function backgroundCheckState(
  expiresAt: string | null | undefined,
  now: Date = new Date()
): BackgroundCheckState {
  if (!expiresAt) return "none";
  const days = daysUntilExpiry(expiresAt, now);
  if (days <= 0) return "expired";
  if (days <= BACKGROUND_CHECK_WARNING_DAYS) return "expiring";
  return "valid";
}

/** "Valid until Sep 28, 2027", "Expires in 12 days", "Expired Sep 1, 2026", "Not uploaded". */
export function backgroundCheckLabel(
  expiresAt: string | null | undefined,
  now: Date = new Date()
): string {
  const state = backgroundCheckState(expiresAt, now);
  if (state === "none" || !expiresAt) return "Not uploaded";
  const date = new Date(expiresAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (state === "expired") return `Expired ${date}`;
  if (state === "expiring") {
    const days = daysUntilExpiry(expiresAt, now);
    return `Expires in ${days} day${days === 1 ? "" : "s"}`;
  }
  return `Valid until ${date}`;
}

/** Why a file can't be uploaded as a background check, or null when it can. */
export function backgroundCheckFileError(file: { size?: number | null; mimeType?: string | null }): string | null {
  const mime = (file.mimeType ?? "").toLowerCase();
  if (!mime || !(BACKGROUND_CHECK_MIME_TYPES as readonly string[]).includes(mime)) {
    return "Upload a PDF or a photo (JPG, PNG, WEBP or HEIC).";
  }
  if (file.size != null && file.size > BACKGROUND_CHECK_MAX_BYTES) {
    return "That file is over 10 MB. Upload a smaller PDF or photo.";
  }
  return null;
}

function extensionFor(fileName: string | null | undefined, mimeType: string): string {
  const fromName = fileName?.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (mimeType === "application/pdf") return "pdf";
  return mimeType.split("/")[1] ?? "bin";
}

/** The most recent upload, or null when the referee has never uploaded one. */
export async function fetchMyBackgroundCheck(
  userId: string
): Promise<{ check: BackgroundCheckRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("background_check_documents")
    .select("id, file_path, file_name, uploaded_at, expires_at")
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { check: null, error: new Error(error.message) };
  return { check: (data as BackgroundCheckRow | null) ?? null, error: null };
}

/**
 * Stores the file in the private bucket and records it. The caller supplies the
 * bytes because reading a picked file differs on web and mobile.
 */
export async function uploadBackgroundCheck(
  userId: string,
  file: { body: ArrayBuffer | Blob; fileName?: string | null; mimeType: string; size?: number | null }
): Promise<{ check: BackgroundCheckRow | null; error: Error | null }> {
  const invalid = backgroundCheckFileError({ size: file.size, mimeType: file.mimeType });
  if (invalid) return { check: null, error: new Error(invalid) };

  const path = `${userId}/${Date.now()}.${extensionFor(file.fileName, file.mimeType)}`;
  const { error: uploadError } = await supabase.storage
    .from(BACKGROUND_CHECK_BUCKET)
    .upload(path, file.body, { contentType: file.mimeType, upsert: false });
  if (uploadError) return { check: null, error: new Error(uploadError.message) };

  const { data, error } = await supabase
    .from("background_check_documents")
    .insert({ user_id: userId, file_path: path, file_name: file.fileName ?? null })
    .select("id, file_path, file_name, uploaded_at, expires_at")
    .single();
  if (error) {
    // Don't leave an orphaned file behind if the record couldn't be written.
    await supabase.storage.from(BACKGROUND_CHECK_BUCKET).remove([path]);
    return { check: null, error: new Error(error.message) };
  }
  return { check: data as BackgroundCheckRow, error: null };
}

/** A short-lived link so the owner can open their own upload. */
export async function getBackgroundCheckUrl(
  filePath: string
): Promise<{ url: string | null; error: Error | null }> {
  const { data, error } = await supabase.storage
    .from(BACKGROUND_CHECK_BUCKET)
    .createSignedUrl(filePath, 60);
  return { url: data?.signedUrl ?? null, error: error ? new Error(error.message) : null };
}

export async function removeBackgroundCheck(check: {
  id: string;
  file_path: string;
}): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("background_check_documents").delete().eq("id", check.id);
  if (error) return { error: new Error(error.message) };
  await supabase.storage.from(BACKGROUND_CHECK_BUCKET).remove([check.file_path]);
  return { error: null };
}

/** expiry per referee, for a badge next to their name. People with no upload are absent. */
export async function fetchBackgroundCheckStatuses(
  userIds: string[]
): Promise<{ statuses: Record<string, string>; error: Error | null }> {
  if (userIds.length === 0) return { statuses: {}, error: null };
  const { data, error } = await supabase
    .from("background_check_status")
    .select("user_id, expires_at")
    .in("user_id", userIds);
  if (error) return { statuses: {}, error: new Error(error.message) };
  const statuses: Record<string, string> = {};
  for (const row of (data ?? []) as { user_id: string | null; expires_at: string | null }[]) {
    if (row.user_id && row.expires_at) statuses[row.user_id] = row.expires_at;
  }
  return { statuses, error: null };
}
