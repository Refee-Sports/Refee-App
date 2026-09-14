// Pure helpers for the extract-schedule function. No Deno APIs, so the unit
// tests run them in Node (apps/mobile/lib/schedule/extract-clean.test.ts).
//
// Claude's tool output is untrusted input: anything malformed is blanked or
// dropped here, and the review screen shows what's missing.

export const LEVELS = ["youth_rec", "high_school", "juco", "naia", "ncaa_mens", "ncaa_womens", "pro_am"];
const TEAM_LEVELS = ["varsity", "jv", "freshman"];
const GENDERS = ["boys", "girls", "men", "women", "coed"];
const CONFIDENCE = ["high", "medium", "low"];

export const MAX_GAMES = 200;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // Claude's per-image limit
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT_CHARS = 200_000;

export const str = (v: unknown, max = 160) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const pick = (v: unknown, allowed: string[]) => (allowed.includes(str(v)) ? str(v) : null);

/** "2026-09-20" when it's a real calendar day, else "". */
function day(v: unknown): string {
  const s = str(v, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? s : "";
}

/** "13:30" (also accepts "9:30"), else "". */
function clock(v: unknown): string {
  const m = str(v, 5).match(/^(\d{1,2}):(\d{2})$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** A two-letter code only: "New York" must not become "NE". */
function stateCode(v: unknown): string | null {
  const s = str(v, 40).toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : null;
}

/** "11530" from "11530" or "11530-1234". */
function zip(v: unknown): string | null {
  const m = str(v, 20).match(/^(\d{5})(?:-\d{4})?$/);
  return m ? m[1] : null;
}

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export type CleanGame = {
  home_team: string;
  away_team: string;
  date: string;
  time: string;
  court: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_city: string | null;
  venue_state: string | null;
  venue_zip: string | null;
  level: string | null;
  team_level: string | null;
  age_group: string | null;
  gender: string | null;
  notes: string | null;
  confidence: string;
};

export type CleanSchedule = {
  games: CleanGame[];
  venue: { name: string | null; address: string | null; city: string | null; state: string | null; zip: string | null };
  event_notes: string | null;
  problems: string[];
  /** The event as a whole, when the file names it (tournament flyers). */
  event: { name: string | null; starts_on: string | null; ends_on: string | null };
};

/** Keep only well-formed games; the review screen shows what's missing. */
export function clean(input: unknown): CleanSchedule {
  const raw = record(input);
  const games = (Array.isArray(raw.games) ? raw.games : [])
    .filter((g): g is Record<string, unknown> => !!g && typeof g === "object" && !Array.isArray(g))
    .slice(0, MAX_GAMES)
    .map((g) => ({
      home_team: str(g.home_team, 120),
      away_team: str(g.away_team, 120),
      date: day(g.date),
      time: clock(g.time),
      court: str(g.court, 80) || null,
      venue_name: str(g.venue_name) || null,
      venue_address: str(g.venue_address) || null,
      venue_city: str(g.venue_city, 120) || null,
      venue_state: stateCode(g.venue_state),
      venue_zip: zip(g.venue_zip),
      level: pick(g.level, LEVELS),
      team_level: pick(g.team_level, TEAM_LEVELS),
      age_group: str(g.age_group, 12) || null,
      gender: pick(g.gender, GENDERS),
      notes: str(g.notes, 280) || null,
      confidence: pick(g.confidence, CONFIDENCE) ?? "low",
    }))
    .filter((g) => g.home_team || g.away_team);
  const venue = record(raw.venue);
  const event = record(raw.event);
  let startsOn: string | null = day(event.starts_on) || null;
  let endsOn: string | null = day(event.ends_on) || null;
  if (startsOn && !endsOn) endsOn = startsOn;
  if (endsOn && !startsOn) startsOn = endsOn;
  if (startsOn && endsOn && endsOn < startsOn) [startsOn, endsOn] = [endsOn, startsOn];
  return {
    games,
    event: { name: str(event.name, 120) || null, starts_on: startsOn, ends_on: endsOn },
    venue: {
      name: str(venue.name) || null,
      address: str(venue.address) || null,
      city: str(venue.city, 120) || null,
      state: stateCode(venue.state),
      zip: zip(venue.zip),
    },
    event_notes: str(raw.event_notes, 280) || null,
    problems: (Array.isArray(raw.problems) ? raw.problems : []).map((p) => str(p, 280)).filter(Boolean).slice(0, 20),
  };
}

/** The Claude content block for an upload, or a message the director can act on. */
export function fileBlock(mimeType: string, data: string, fileName: string) {
  if (IMAGE_TYPES.includes(mimeType)) {
    if (data.length * 0.75 > MAX_IMAGE_BYTES) throw new Error("Photos must be 5 MB or smaller.");
    return { type: "image", source: { type: "base64", media_type: mimeType, data } };
  }
  if (mimeType === "application/pdf") {
    if (data.length * 0.75 > MAX_PDF_BYTES) throw new Error("PDFs must be 10 MB or smaller.");
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  }
  if (mimeType.startsWith("text/") || /\.(csv|tsv|txt)$/i.test(fileName)) {
    if (data.length > MAX_TEXT_CHARS) throw new Error("Text files must be under 200,000 characters.");
    return { type: "text", text: `Uploaded file "${fileName}":\n\n${data}` };
  }
  throw new Error("Upload a photo (JPG, PNG, WebP), a PDF, or a CSV. iPhone HEIC photos: share as JPG.");
}
