// Didit identity verification: the parts worth testing on their own.
// Pure, so the unit tests run them in Node (apps/mobile/lib/payments/didit.test.ts).
//
// Didit reports a session's outcome as a Title Case string and signs every
// webhook with an HMAC over the *canonical* form of the body — not the bytes it
// sent. Both are easy to get subtly wrong, so both live here.

/** What Refee stores. Anything we don't recognise is treated as "still deciding". */
export type IdentityStatus =
  | "unstarted"
  | "in_progress"
  | "in_review"
  | "approved"
  | "declined"
  | "expired"
  | "abandoned";

/**
 * Didit's status → ours. Its strings are exact Title Case.
 *
 * "Awaiting User" and "Resubmitted" mean the person still has something to do,
 * which is our in_progress. "Kyc Expired" is a verified identity that has aged
 * out — expired, not approved, so the gates close again.
 */
export function mapStatus(status: string | null | undefined): IdentityStatus {
  switch ((status ?? "").trim()) {
    case "Not Started":
      return "unstarted";
    case "In Progress":
    case "Awaiting User":
    case "Resubmitted":
      return "in_progress";
    case "In Review":
      return "in_review";
    case "Approved":
      return "approved";
    case "Declined":
      return "declined";
    case "Expired":
    case "Kyc Expired":
      return "expired";
    case "Abandoned":
      return "abandoned";
    default:
      // An unknown status must never unlock anything: hold in review so a
      // person can look, rather than approving or rejecting on a guess.
      return "in_review";
  }
}

/** Only an approved identity unlocks the gated actions. */
export function unlocksActions(status: IdentityStatus): boolean {
  return status === "approved";
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** 2.0 → 2, so a whole-number float signs the same as the integer Didit sent. */
function shortenFloats(value: Json): Json {
  if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)) {
    return Math.trunc(value);
  }
  if (Array.isArray(value)) return value.map(shortenFloats);
  if (value && typeof value === "object") {
    const out: { [key: string]: Json } = {};
    for (const key of Object.keys(value)) out[key] = shortenFloats(value[key]);
    return out;
  }
  return value;
}

function sortKeys(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: { [key: string]: Json } = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key]);
    return out;
  }
  return value;
}

/**
 * The exact string Didit signs: whole-number floats shortened, keys sorted at
 * every level, then JSON.stringify — which leaves non-ASCII characters
 * unescaped, as Didit's own pipeline does.
 */
export function canonicalJson(body: unknown): string {
  return JSON.stringify(sortKeys(shortenFloats(body as Json)));
}

/** Length-independent comparison, so a mismatch leaks nothing through timing. */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Replays older than this are refused even with a good signature. */
export const TIMESTAMP_TOLERANCE_SECONDS = 300;

export type SignatureCheck = { ok: true } | { ok: false; reason: string };

/**
 * Verifies Didit's X-Signature-V2 (HMAC-SHA256, hex) over the canonical body,
 * and that X-Timestamp is within five minutes of now.
 *
 * `body` is the parsed JSON — the signature covers the canonical form, not the
 * raw bytes, so re-serializing is correct here (unlike Stripe's).
 */
export async function verifySignature(args: {
  body: unknown;
  signature: string | null;
  timestamp: string | null;
  secret: string;
  now?: Date;
}): Promise<SignatureCheck> {
  const { body, signature, timestamp, secret } = args;
  if (!secret) return { ok: false, reason: "Webhook secret is not configured" };
  if (!signature) return { ok: false, reason: "Missing signature" };
  if (!timestamp) return { ok: false, reason: "Missing timestamp" };

  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) return { ok: false, reason: "Invalid timestamp" };
  const nowSeconds = Math.floor((args.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - sent) > TIMESTAMP_TOLERANCE_SECONDS) {
    return { ok: false, reason: "Timestamp outside the allowed window" };
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(canonicalJson(body))
  );
  if (!constantTimeEquals(toHex(mac), signature.trim().toLowerCase())) {
    return { ok: false, reason: "Signature mismatch" };
  }
  return { ok: true };
}

// ── Age ──────────────────────────────────────────────────────────────────────
// Refee is 18+. The apps ask for a date of birth at sign-up, but a typed date
// isn't evidence — this is the one read off a government ID, so it's the one
// that settles it. Mirrors packages/core/src/identity/age.ts, which does the
// same arithmetic for the forms.

export const MINIMUM_AGE = 18;

/**
 * Didit's date of birth, wherever this workflow puts it. The shape varies by
 * workflow and version, so look in each place it's known to appear rather than
 * trusting one path — and return null rather than guessing.
 */
export function extractDateOfBirth(body: Record<string, unknown>): string | null {
  const decision = (body.decision ?? {}) as Record<string, unknown>;
  const kyc = (decision.kyc ?? {}) as Record<string, unknown>;
  const idv = (decision.id_verification ?? {}) as Record<string, unknown>;

  const candidates = [
    kyc.date_of_birth,
    idv.date_of_birth,
    decision.date_of_birth,
    body.date_of_birth,
  ];

  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (match) return match[0].slice(0, 10);
  }
  return null;
}

/** Whole years old on `asOf`, or null if the date isn't a real one. */
export function ageInYears(value: string, asOf: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const dob = new Date(Date.UTC(year, month - 1, day));
  if (
    dob.getUTCFullYear() !== year ||
    dob.getUTCMonth() !== month - 1 ||
    dob.getUTCDate() !== day
  ) {
    return null;
  }
  let age = asOf.getUTCFullYear() - year;
  const monthDiff = asOf.getUTCMonth() - (month - 1);
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getUTCDate() < day)) age -= 1;
  return age;
}

/** True only for a date of birth we can read and that is old enough. */
export function isAdult(value: string | null, asOf: Date = new Date()): boolean {
  if (!value) return false;
  const age = ageInYears(value, asOf);
  return age !== null && age >= MINIMUM_AGE;
}

/** A date of birth we can read and that is too young — the only case that declines. */
export function isKnownMinor(value: string | null, asOf: Date = new Date()): boolean {
  if (!value) return false;
  const age = ageInYears(value, asOf);
  return age !== null && age < MINIMUM_AGE;
}
