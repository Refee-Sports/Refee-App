import { LEVELS } from "../basketball/options";
import type { ExtractedGame, ExtractedSchedule } from "./ai-import";

// The Refee schedule template: a CSV directors fill in from Excel or Google
// Sheets. Files in this shape are read here — instantly, and without AI —
// straight into the same review table the AI reader fills. Pay, crew size and
// game length are set once on the import screen, so the template only carries
// what changes from game to game.

export const TEMPLATE_COLUMNS = [
  "home_team",
  "away_team",
  "date",
  "time",
  "court",
  "level",
  "team_level",
  "age_group",
  "notes",
] as const;
type Column = (typeof TEMPLATE_COLUMNS)[number];

export const TEMPLATE_FILE_NAME = "refee-schedule-template.csv";
/** Rows carrying this note are the template's examples and are skipped. */
export const EXAMPLE_NOTE = "Example - replace with your games";
const MAX_ROWS = 500;

/** Splits CSV text into records. Handles quoted fields, doubled quotes and CRLF. */
export function parseCsvRecords(input: string): { records: string[][]; error: string | null } {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n") {
      record.push(field.replace(/\r$/, ""));
      records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) return { records: [], error: "The CSV contains an unclosed quoted field." };
  if (field.length > 0 || record.length > 0) {
    record.push(field.replace(/\r$/, ""));
    records.push(record);
  }
  return { records, error: null };
}

const cell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** The downloadable template, with example rows dated for this tournament. */
export function buildScheduleTemplate(opts: { date?: string | null; courts?: string[] | null } = {}): string {
  const date = opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? opts.date : "2026-09-20";
  const [courtA = "Court 1", courtB = "Court 2"] = opts.courts ?? [];
  const rows: string[][] = [
    [...TEMPLATE_COLUMNS],
    ["Long Island Friars", "Queens Knights", date, "1:30 PM", courtA, "High School", "Varsity", "", EXAMPLE_NOTE],
    ["BX Mustangs", "Queens Crusaders", date, "2:45 PM", courtB, "High School", "JV", "", EXAMPLE_NOTE],
    ["Garden City Hawks", "Mineola Owls", date, "4:00 PM", courtA, "Youth / Rec", "", "U14", EXAMPLE_NOTE],
  ];
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const squash = (s: string) => norm(s).replace(/ /g, "");

// Headers people actually type, mapped onto template columns.
const HEADER_ALIASES: Record<string, Column> = {
  "home team": "home_team",
  home: "home_team",
  host: "home_team",
  "away team": "away_team",
  away: "away_team",
  visitor: "away_team",
  visitors: "away_team",
  "visiting team": "away_team",
  guest: "away_team",
  date: "date",
  "game date": "date",
  day: "date",
  time: "time",
  "start time": "time",
  start: "time",
  "game time": "time",
  tip: "time",
  "tip off": "time",
  tipoff: "time",
  court: "court",
  gym: "court",
  "court number": "court",
  "court no": "court",
  level: "level",
  "competition level": "level",
  "team level": "team_level",
  squad: "team_level",
  "age group": "age_group",
  age: "age_group",
  "age division": "age_group",
  notes: "notes",
  note: "notes",
  comments: "notes",
};

const LEVEL_ALIASES: Record<string, string> = {
  hs: "high_school",
  highschool: "high_school",
  youth: "youth_rec",
  rec: "youth_rec",
  aau: "youth_rec",
  juniorcollege: "juco",
  ncaam: "ncaa_mens",
  ncaaw: "ncaa_womens",
};

function toLevel(raw: string): string | null {
  const key = squash(raw);
  for (const level of LEVELS) {
    if (key === squash(level.id) || key === squash(level.label)) return level.id;
  }
  return LEVEL_ALIASES[key] ?? null;
}

function toTeamLevel(raw: string): ExtractedGame["team_level"] {
  const key = squash(raw);
  if (["varsity", "v", "var"].includes(key)) return "varsity";
  if (["jv", "juniorvarsity"].includes(key)) return "jv";
  if (["freshman", "frosh", "fr"].includes(key)) return "freshman";
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "13:30", "1:30 PM", "1:30pm", "1 PM", Excel's "1:30:00 PM" → "13:30". */
export function parseTimeCell(raw: string): string | null {
  const m = raw.trim().toLowerCase().replace(/\./g, "").match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm|a|p)?$/);
  if (!m || (!m[2] && !m[3])) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  if (minute > 59) return null;
  if (m[3]) {
    if (hour < 1 || hour > 12) return null;
    if (m[3].startsWith("p") && hour !== 12) hour += 12;
    if (m[3].startsWith("a") && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }
  return `${pad(hour)}:${pad(minute)}`;
}

/** "2026-09-20", "9/20/2026", Excel's "9/20/26", "Sun 9/20" (with a year) → "2026-09-20". */
export function parseDateCell(raw: string, year?: string | null): string | null {
  const s = raw.trim().replace(/^[a-z]{3,9},?\s+/i, "");
  let y: number;
  let mo: number;
  let d: number;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?$/))) {
    mo = Number(m[1]);
    d = Number(m[2]);
    y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : Number(year);
  } else {
    return null;
  }
  if (!Number.isInteger(y) || y < 2000) return null;
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/**
 * Reads a CSV in the template's shape (or close to it — common header names
 * work). Returns null when the file doesn't look like a schedule sheet, so the
 * caller can hand it to the AI reader instead.
 */
export function parseTemplateCsv(text: string, opts: { year?: string | null } = {}): ExtractedSchedule | null {
  const { records, error } = parseCsvRecords(text.replace(/^\uFEFF/, ""));
  if (error) return null;
  const rows = records.filter((r) => r.some((c) => c.trim().length > 0));
  if (rows.length === 0) return null;

  const header = rows[0].map((h) => HEADER_ALIASES[norm(h)] ?? null);
  const col = (name: Column) => header.indexOf(name);
  if (col("home_team") < 0 || col("away_team") < 0 || (col("date") < 0 && col("time") < 0)) return null;

  const problems: string[] = [];
  const games: ExtractedGame[] = [];
  let examples = 0;
  const body = rows.slice(1);

  for (let i = 0; i < body.length && games.length < MAX_ROWS; i += 1) {
    const record = body[i];
    const get = (name: Column) => {
      const at = col(name);
      return at < 0 ? "" : (record[at] ?? "").trim();
    };
    const notes = get("notes");
    if (notes === EXAMPLE_NOTE) {
      examples += 1;
      continue;
    }

    const issues: string[] = [];
    const dateRaw = get("date");
    const date = dateRaw ? parseDateCell(dateRaw, opts.year) : null;
    if (dateRaw && !date) issues.push(`Couldn't read the date "${dateRaw}"`);
    const timeRaw = get("time");
    const time = timeRaw ? parseTimeCell(timeRaw) : null;
    if (timeRaw && !time) issues.push(`Couldn't read the time "${timeRaw}"`);
    const levelRaw = get("level");
    const level = levelRaw ? toLevel(levelRaw) : null;
    if (levelRaw && !level) issues.push(`"${levelRaw}" isn't a Refee level`);
    const teamLevelRaw = get("team_level");
    const teamLevel = teamLevelRaw ? toTeamLevel(teamLevelRaw) : null;
    if (teamLevelRaw && !teamLevel) issues.push(`"${teamLevelRaw}" isn't varsity, JV or freshman`);

    games.push({
      home_team: get("home_team"),
      away_team: get("away_team"),
      date: date ?? "",
      time: time ?? "",
      court: get("court") || null,
      venue_name: null,
      venue_address: null,
      venue_city: null,
      venue_state: null,
      venue_zip: null,
      level,
      team_level: teamLevel,
      age_group: get("age_group") || null,
      gender: null,
      notes: [...issues, notes].filter(Boolean).join(" · ") || null,
      confidence: issues.length > 0 ? "low" : "high",
    });
  }

  if (body.length - examples > MAX_ROWS) {
    problems.push(`Only the first ${MAX_ROWS} games were read. Split the file to import the rest.`);
  }
  if (games.length === 0) {
    problems.push(
      examples > 0
        ? "Only the template's example rows were found. Replace them with your games."
        : "The file has column headers but no games."
    );
  }
  return {
    games,
    venue: { name: null, address: null, city: null, state: null, zip: null },
    event_notes: null,
    problems,
  };
}
