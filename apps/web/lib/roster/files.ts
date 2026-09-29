// Web helpers for the roster and background-check screens.

const MAX_CSV_BYTES = 1024 * 1024;

/** Reads a chosen CSV / text file of email addresses. */
export async function readEmailFile(file: File): Promise<string> {
  if (file.size > MAX_CSV_BYTES) throw new Error("That file is over 1 MB.");
  return file.text();
}

// A scanned QR code opens /join/<code>. Someone who isn't signed in yet is sent
// to sign in first, so the code is parked here and picked up afterwards.
const PENDING_CODE_KEY = "refee.pendingRosterCode";

export function setPendingRosterCode(code: string): void {
  try {
    window.localStorage.setItem(PENDING_CODE_KEY, code);
  } catch {
    /* private mode — they can still type the code in */
  }
}

export function takePendingRosterCode(): string | null {
  try {
    const code = window.localStorage.getItem(PENDING_CODE_KEY);
    if (code) window.localStorage.removeItem(PENDING_CODE_KEY);
    return code;
  } catch {
    return null;
  }
}

/** The site's own origin, for links that go in a QR code. */
export function siteOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "https://refee.app";
}
