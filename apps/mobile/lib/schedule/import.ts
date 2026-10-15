import * as DocumentPicker from "expo-document-picker";
import { File as LocalFile } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { notifyNewGames } from "@/lib/push/send";
import { SCHEDULE_CSV_TEMPLATE, type ScheduleImportRow } from "./csv";
import { shareCsv } from "@/lib/files/share";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

export async function pickScheduleCsv(): Promise<{ name: string; text: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["text/csv", "text/comma-separated-values", "text/plain"],
    copyToCacheDirectory: true,
    multiple: false,
    base64: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > MAX_CSV_BYTES) throw new Error("CSV files must be 5 MB or smaller.");
  const text = asset.file ? await asset.file.text() : await new LocalFile(asset.uri).text();
  if (new TextEncoder().encode(text).byteLength > MAX_CSV_BYTES) throw new Error("CSV files must be 5 MB or smaller.");
  return { name: asset.name, text };
}

export async function downloadScheduleTemplate() {
  await shareCsv("refee-schedule-template.csv", SCHEDULE_CSV_TEMPLATE, "Save Refee schedule template");
}

export async function importTournamentSchedule(tournamentId: string, rows: ScheduleImportRow[]) {
  const games = rows.map((row) => ({
    home_team: row.homeTeam,
    away_team: row.awayTeam,
    starts_at: row.startsAt,
    venue_name: row.venueName,
    venue_city: row.venueCity,
    venue_state: row.venueState,
    venue_address: row.venueAddress,
    venue_zip: row.venueZip,
    level: row.level,
    crew_size: row.crewSize,
    pay_per_game: row.payPerGame,
    duration_minutes: row.durationMinutes,
    age_group: row.ageGroup,
    gender: row.gender,
    ruleset: row.ruleset,
    uniform_requirements: row.uniformRequirements,
    game_format: row.gameFormat,
    period_minutes: row.periodMinutes,
    ruleset_modifications: row.rulesetModifications,
  }));
  const { data, error } = await supabase.rpc("import_tournament_schedule", {
    p_tournament_id: tournamentId,
    p_games: games,
  });
  if (error) return { count: 0, error: new Error(error.message) };
  const result = data as { count?: number; game_ids?: string[] } | null;
  // Tell the referees these games suit. Best-effort; the backend decides who.
  void notifyNewGames(result?.game_ids ?? []);
  return { count: Number(result?.count ?? rows.length), error: null };
}
