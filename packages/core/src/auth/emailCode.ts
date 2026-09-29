import { supabase } from "../client";

// Sign-in with a one-time code sent by email — no password, no link to open on
// the right device. Apple and Google are the quick paths; this is the way in for
// everyone else. Both apps use these so the two behave the same.

export const EMAIL_CODE_LENGTH = 6;

/** Lowercased, trimmed — the form Supabase stores and matches on. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Keeps only digits, capped at the code length, so a pasted "123 456" works. */
export function cleanCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, EMAIL_CODE_LENGTH);
}

/** "jordan.taylor@example.com" → "jo•••••••@example.com" for the confirmation line. */
export function maskEmail(raw: string): string {
  const email = normalizeEmail(raw);
  const at = email.indexOf("@");
  if (at < 1) return email;
  const name = email.slice(0, at);
  return `${name.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(name.length - 2, 8)))}${email.slice(at)}`;
}

/** Turns Supabase's errors into something a person can act on. */
export function humanizeEmailAuthError(message: string): string {
  if (/rate limit|too many|security purposes/i.test(message)) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (/expired|invalid|otp/i.test(message)) {
    return "That code didn't work. It may have expired — request a new one.";
  }
  if (/network|fetch/i.test(message)) {
    return "Can't reach Refee. Check your connection and try again.";
  }
  return message;
}

/** Emails a 6-digit code (creating the account on first use). */
export async function sendEmailCode(rawEmail: string): Promise<{ error: Error | null }> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return { error: new Error("Enter a valid email address.") };
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  return { error: error ? new Error(humanizeEmailAuthError(error.message)) : null };
}

/** Checks the code the person typed; on success they're signed in. */
export async function verifyEmailCode(
  rawEmail: string,
  rawCode: string
): Promise<{ error: Error | null }> {
  const token = cleanCode(rawCode);
  if (token.length !== EMAIL_CODE_LENGTH) {
    return { error: new Error(`Enter the ${EMAIL_CODE_LENGTH}-digit code.`) };
  }
  const { error } = await supabase.auth.verifyOtp({
    email: normalizeEmail(rawEmail),
    token,
    type: "email",
  });
  return { error: error ? new Error(humanizeEmailAuthError(error.message)) : null };
}
