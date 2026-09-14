import { supabase } from "../client";

// AI-assisted schedule import, shared by web and mobile. The extract-schedule
// edge function reads a photo, PDF or CSV and returns games for review; nothing
// is posted until the director confirms, and posting goes through
// import_tournament_schedule with the same validation as manual entry.

export type ExtractedGame = {
  home_team: string;
  away_team: string;
  /** YYYY-MM-DD, or "" when the file gave no date. */
  date: string;
  /** 24-hour HH:MM at the venue, or "". */
  time: string;
  court: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_city: string | null;
  venue_state: string | null;
  venue_zip: string | null;
  level: string | null;
  team_level: "varsity" | "jv" | "freshman" | null;
  age_group: string | null;
  gender: string | null;
  notes: string | null;
  confidence: "high" | "medium" | "low";
};

export type ExtractedSchedule = {
  games: ExtractedGame[];
  venue: {
    name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  /** Doors time, check-in, parking — goes into arrival notes. */
  event_notes: string | null;
  problems: string[];
};

export type ScheduleUpload = {
  fileName: string;
  mimeType: string;
  /** Base64 for photos and PDFs; plain text for CSV/TXT. */
  data: string;
};

/** Sends an upload to the AI reader. `tournamentId` scopes permission and context. */
export async function extractSchedule(
  upload: ScheduleUpload,
  opts: { tournamentId?: string | null; mode?: "tournament" | "single" } = {}
): Promise<{ schedule: ExtractedSchedule | null; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke("extract-schedule", {
    body: {
      ...upload,
      tournamentId: opts.tournamentId ?? null,
      mode: opts.mode ?? (opts.tournamentId ? "tournament" : "single"),
    },
  });
  if (error) {
    // The function answers with { error } — surface that text, not "non-2xx".
    const context = (error as { context?: Response }).context;
    let message = error.message;
    try {
      const body = context ? await context.json() : null;
      if (body?.error) message = body.error;
    } catch {
      /* keep the generic message */
    }
    return { schedule: null, error: new Error(message) };
  }
  return { schedule: (data as { schedule: ExtractedSchedule }).schedule, error: null };
}

/** One reviewed game, ready to post. Blank venue fields come from the tournament. */
export type ImportGame = {
  homeTeam: string;
  awayTeam: string;
  /** Wall-clock start at the venue, "2026-09-20T13:30". */
  startsLocal: string;
  level: string;
  teamLevel?: string | null;
  ageGroup?: string | null;
  gender?: string | null;
  crewSize: number;
  payPerGame: number;
  durationMinutes: number;
  court?: string | null;
  arrivalNotes?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  venueZip?: string | null;
  venueCity?: string | null;
  venueState?: string | null;
};

/** Posts reviewed games to a tournament in one transaction. */
export async function importScheduleGames(
  tournamentId: string,
  games: ImportGame[]
): Promise<{ count: number; gameIds: string[]; error: Error | null }> {
  const payload = games.map((g) => ({
    home_team: g.homeTeam,
    away_team: g.awayTeam,
    starts_local: g.startsLocal,
    level: g.level,
    team_level: g.teamLevel || null,
    age_group: g.ageGroup || null,
    gender: g.gender || null,
    crew_size: g.crewSize,
    pay_per_game: g.payPerGame,
    duration_minutes: g.durationMinutes,
    court: g.court || null,
    arrival_notes: g.arrivalNotes || null,
    venue_name: g.venueName || null,
    venue_address: g.venueAddress || null,
    venue_zip: g.venueZip || null,
    venue_city: g.venueCity || null,
    venue_state: g.venueState || null,
  }));
  const { data, error } = await supabase.rpc("import_tournament_schedule", {
    p_tournament_id: tournamentId,
    p_games: payload,
  });
  if (error) return { count: 0, gameIds: [], error: new Error(error.message) };
  const result = data as { count?: number; game_ids?: string[] } | null;
  return { count: Number(result?.count ?? games.length), gameIds: result?.game_ids ?? [], error: null };
}

/** Reads a File/Blob for upload: base64 for photos and PDFs, text for CSV. */
export async function readUpload(file: { name: string; type: string; text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer> }): Promise<ScheduleUpload> {
  const isText = file.type.startsWith("text/") || /\.(csv|tsv|txt)$/i.test(file.name);
  if (isText) return { fileName: file.name, mimeType: file.type || "text/csv", data: await file.text() };
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { fileName: file.name, mimeType: file.type, data: btoa(binary) };
}
