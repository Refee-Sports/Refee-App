import * as DocumentPicker from "expo-document-picker";
import { File as LocalFile } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { backgroundCheckFileError, BACKGROUND_CHECK_MIME_TYPES } from "@/lib/referee/backgroundCheck";

const MAX_CSV_BYTES = 1024 * 1024;

/** Pick a CSV (or any text file) of email addresses. Returns null if cancelled. */
export async function pickEmailCsv(): Promise<{ name: string; text: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["text/csv", "text/comma-separated-values", "text/plain"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > MAX_CSV_BYTES) throw new Error("That file is over 1 MB.");
  const text = asset.file ? await asset.file.text() : await new LocalFile(asset.uri).text();
  return { name: asset.name, text };
}

export type PickedDocument = {
  body: ArrayBuffer;
  fileName: string;
  mimeType: string;
  size: number;
};

/** Pick a background-check PDF or photo. Returns null if cancelled; throws with a readable message if unusable. */
export async function pickBackgroundCheckFile(): Promise<PickedDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [...BACKGROUND_CHECK_MIME_TYPES],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? "";
  const problem = backgroundCheckFileError({ size: asset.size, mimeType });
  if (problem) throw new Error(problem);

  const response = await fetch(asset.uri);
  const body = await response.arrayBuffer();
  const tooBig = backgroundCheckFileError({ size: body.byteLength, mimeType });
  if (tooBig) throw new Error(tooBig);
  return { body, fileName: asset.name, mimeType, size: body.byteLength };
}

// A scanned QR code opens refee://join/<code>. If the person isn't signed in yet
// the sign-in gate redirects away, so the code is parked here and picked up
// once they reach the app.
const PENDING_CODE_KEY = "refee.pendingRosterCode";

export async function setPendingRosterCode(code: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PENDING_CODE_KEY, code);
  } catch {
    // Non-critical: they can still type the code in.
  }
}

export async function takePendingRosterCode(): Promise<string | null> {
  try {
    const code = await SecureStore.getItemAsync(PENDING_CODE_KEY);
    if (code) await SecureStore.deleteItemAsync(PENDING_CODE_KEY);
    return code;
  } catch {
    return null;
  }
}
