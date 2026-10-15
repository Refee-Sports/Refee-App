import { Platform } from "react-native";
import { File as LocalFile, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/**
 * Hands a CSV to the share sheet (save to Files, email it, AirDrop it), or
 * downloads it when the app runs in a browser.
 */
export async function shareCsv(filename: string, csv: string, dialogTitle: string): Promise<void> {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    // Attached, and released a tick later: some browsers ignore a detached
    // link or cancel a download whose URL is revoked at once.
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return;
  }
  const file = new LocalFile(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(csv);
  if (!(await Sharing.isAvailableAsync())) throw new Error("File sharing is not available on this device.");
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    UTI: "public.comma-separated-values-text",
    dialogTitle,
  });
}
