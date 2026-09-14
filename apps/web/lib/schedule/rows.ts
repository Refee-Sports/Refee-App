import type { ExtractedSchedule } from "@refee/core/schedule/ai-import";

// Rows in the schedule review table, shared by New tournament and the import
// page, plus the hand-offs that carry reviewed work between screens.

export type ReviewRowState = {
  key: string;
  include: boolean;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  court: string;
  level: string;
  teamLevel: string;
  ageGroup: string;
  notes: string | null;
  confidence: "high" | "medium" | "low";
};

let seq = 0;
const nextRowKey = () => `row-${++seq}`;

export function emptyRow(date: string): ReviewRowState {
  return {
    key: nextRowKey(),
    include: true,
    homeTeam: "",
    awayTeam: "",
    date,
    time: "",
    court: "",
    level: "",
    teamLevel: "",
    ageGroup: "",
    notes: null,
    confidence: "high",
  };
}

/** Review rows for every game in a schedule; games without a date take `fallbackDate`. */
export function rowsFromSchedule(s: ExtractedSchedule, fallbackDate: string): ReviewRowState[] {
  return s.games.map((g) => ({
    key: nextRowKey(),
    include: true,
    homeTeam: g.home_team,
    awayTeam: g.away_team,
    date: g.date || fallbackDate,
    time: g.time,
    court: g.court ?? "",
    level: g.level ?? "",
    teamLevel: g.team_level ?? "",
    ageGroup: g.age_group ?? "",
    notes: g.notes,
    confidence: g.confidence,
  }));
}

/** The one level the file uses for every game, if it's consistent. */
export function soleLevel(s: ExtractedSchedule): string | null {
  const levels = [...new Set(s.games.map((g) => g.level).filter(Boolean))] as string[];
  return levels.length === 1 ? levels[0] : null;
}

// ── Hand-offs (sessionStorage; a failed read just means starting fresh) ─────

export type PendingImport = { rows: ReviewRowState[]; level: string; crewSize: 2 | 3; error: string };

const pendingKey = (tournamentId: string) => `refee:pending-import:${tournamentId}`;
const CARRY_KEY = "refee:carry-schedule";

function put(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or storage full: the director re-uploads */
  }
}

function take<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    sessionStorage.removeItem(key);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Games reviewed while creating a tournament that didn't post; the import page picks them up. */
export const savePendingImport = (tournamentId: string, p: PendingImport) => put(pendingKey(tournamentId), p);
export const takePendingImport = (tournamentId: string) => take<PendingImport>(pendingKey(tournamentId));

/** A multi-game file read on the single-game form, carried to New tournament without re-reading. */
export const carrySchedule = (s: ExtractedSchedule) => put(CARRY_KEY, s);
export const takeCarriedSchedule = () => take<ExtractedSchedule>(CARRY_KEY);
