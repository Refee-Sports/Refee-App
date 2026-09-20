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

function asIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  return match ? match[0].slice(0, 10) : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** First readable date a feature array yields, in array order. */
function fromFeature(
  decision: Record<string, unknown>,
  key: string,
  pick: (item: Record<string, unknown>) => unknown
): string | null {
  const items = decision[key];
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    const obj = record(item);
    if (!obj) continue;
    const iso = asIsoDate(pick(obj));
    if (iso) return iso;
  }
  return null;
}

/**
 * The date of birth Didit read off the document.
 *
 * Every feature report is a plural array — `id_verifications[0]`, never
 * `id_verification` — and the date can arrive three ways depending on how the
 * document was read: OCR, the passport's NFC chip, or a digital wallet.
 * A webhook wraps all of it in `decision`; the decision endpoint returns it at
 * the top level, so accept either.
 *
 * Returns null rather than guessing. The caller treats null as "age not
 * established", which is not the same as "old enough".
 */
export function extractDateOfBirth(body: Record<string, unknown>): string | null {
  const decision = record(body.decision) ?? body;

  return (
    fromFeature(decision, "id_verifications", (i) => i.date_of_birth) ??
    fromFeature(decision, "nfc_verifications", (i) => record(i.chip_data)?.birth_date) ??
    fromFeature(decision, "id_verifications", (i) =>
      record(record(i.wallet_verification)?.attributes)?.date_of_birth
    ) ??
    asIsoDate(decision.date_of_birth) ??
    asIsoDate(body.date_of_birth)
  );
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

// ── Expected details ─────────────────────────────────────────────────────────

export type ExpectedDetails = { last_name?: string; date_of_birth?: string };

/**
 * What Refee already knows about this person, sent with the session so Didit
 * checks the document against it (fuzzy, at the workflow's name-match
 * threshold). A mismatch lands the session in review, not a refusal.
 *
 * Last name and date of birth only. First names break on nicknames — Mike signs
 * up, Michael is on the licence — while surnames are what OCR reads reliably.
 * Blank fields are left out rather than sent empty, and a profile from before
 * sign-up collected these sends nothing at all.
 */
export function expectedDetails(
  profile: { legal_last_name?: string | null; date_of_birth?: string | null } | null
): ExpectedDetails | null {
  if (!profile) return null;
  const out: ExpectedDetails = {};
  const last = profile.legal_last_name?.trim();
  if (last) out.last_name = last;
  const dob = asIsoDate(profile.date_of_birth);
  if (dob) out.date_of_birth = dob;
  return Object.keys(out).length > 0 ? out : null;
}

// ── Why a check ended the way it did ─────────────────────────────────────────
// Didit explains a review or decline in `warnings` on each feature report:
// `{ risk, log_type, short_description, additional_data }`. Refee keeps one
// plain-English sentence — never `additional_data`, which carries the very
// details being compared (both dates of birth, say).

type Explained = { rank: number; text: string };

/** A warning code in the person's terms; lower rank = more consequential. */
function explainRisk(code: string, fallback: unknown): Explained {
  const c = code.toUpperCase();
  if (c.includes("DUPLICAT")) {
    return { rank: 0, text: "This ID or face is already linked to another Refee account." };
  }
  if (["PRINTED", "SCREEN_REPLAY", "PORTRAIT_REPLACE", "TAMPER", "FORGE"].some((p) => c.includes(p))) {
    return { rank: 1, text: "Your ID didn't pass the authenticity checks." };
  }
  if (c.includes("FACE") && c.includes("MATCH")) {
    return { rank: 2, text: "Your selfie didn't match the photo on your ID." };
  }
  if (c.includes("LIVENESS") || c.includes("SPOOF")) {
    return { rank: 3, text: "We couldn't confirm your selfie was taken live." };
  }
  if (c.includes("NAME") && c.includes("MISMATCH")) {
    return { rank: 4, text: "The name on your ID doesn't match the one you entered at sign-up." };
  }
  if ((c.includes("DOB") || c.includes("BIRTH")) && c.includes("MISMATCH")) {
    return { rank: 5, text: "The date of birth on your ID doesn't match the one you entered at sign-up." };
  }
  if (c.includes("EXPIRED")) return { rank: 6, text: "Your ID has expired." };
  if (c.includes("BLUR")) return { rank: 7, text: "The photo of your ID was too blurry to read." };
  if (c.includes("QUALITY") || c.includes("DARK") || c.includes("BRIGHT")) {
    return { rank: 8, text: "The photo of your ID wasn't clear enough to read." };
  }
  // A code we haven't seen: Didit's own one-line description is generic and
  // safe to show; failing that, say only that a person will look.
  const text = typeof fallback === "string" && fallback.trim() ? fallback.trim() : "Your ID needs a manual check.";
  return { rank: 9, text: text.slice(0, 200) };
}

const WARNING_SOURCES = [
  "id_verifications",
  "nfc_verifications",
  "liveness_checks",
  "face_matches",
  "ip_analyses",
];

/**
 * The most consequential actionable warning, in plain words — or null.
 * `log_type: "information"` entries (an address that wouldn't geocode, a
 * barcode that wasn't read) are notices, not reasons, and are skipped.
 */
export function reviewReason(body: Record<string, unknown>): string | null {
  const decision = record(body.decision) ?? body;
  let best: Explained | null = null;
  for (const key of WARNING_SOURCES) {
    const items = decision[key];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const warnings = record(item)?.warnings;
      if (!Array.isArray(warnings)) continue;
      for (const w of warnings) {
        const warning = record(w);
        if (!warning || typeof warning.risk !== "string") continue;
        if (warning.log_type === "information") continue;
        const explained = explainRisk(warning.risk, warning.short_description);
        if (!best || explained.rank < best.rank) best = explained;
      }
    }
  }
  return best?.text ?? null;
}

/** What Refee records as the reason for a decision. Approved has none. */
export function lastReason(args: {
  decided: IdentityStatus;
  minor: boolean;
  ageUnknown: boolean;
  body: Record<string, unknown>;
}): string | null {
  if (args.minor) return "You must be 18 or older to use Refee.";
  if (args.ageUnknown) return "We couldn't read the date of birth on your ID.";
  if (args.decided === "approved") return null;
  const decision = record(args.body.decision) ?? {};
  const given = [args.body.reason, decision.reason, decision.status_reason, args.body.status_reason]
    .find((v): v is string => typeof v === "string" && v.trim().length > 0);
  return reviewReason(args.body) ?? (given ? given.trim().slice(0, 200) : null);
}

// ── Whose check is this ──────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The Refee user id Didit echoes back in `vendor_data`, or null.
 *
 * Sessions made outside Refee carry something else entirely — Didit's own
 * getting-started flow sends "getting-started" — and handing that to a uuid
 * column throws, turning a webhook we simply don't care about into a 500 and
 * two pointless retries. Anything that isn't a uuid is "not ours".
 */
export function vendorUserId(body: Record<string, unknown>): string | null {
  const raw = body.vendor_data;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return UUID.test(trimmed) ? trimmed : null;
}
