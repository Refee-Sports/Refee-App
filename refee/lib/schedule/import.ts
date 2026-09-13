import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File as LocalFile, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { supabase } from "@/lib/supabase";
import { SCHEDULE_CSV_TEMPLATE, type ScheduleImportRow } from "./csv";

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
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([SCHEDULE_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "refee-schedule-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const file = new LocalFile(Paths.cache, "refee-schedule-template.csv");
  file.create({ overwrite: true });
  file.write(SCHEDULE_CSV_TEMPLATE);
  if (!await Sharing.isAvailableAsync()) throw new Error("File sharing is not available on this device.");
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    UTI: "public.comma-separated-values-text",
    dialogTitle: "Save Refee schedule template",
  });
}

export async function importTournamentSchedule(tournamentId: string, rows: ScheduleImportRow[]) {
  const games = rows.map((row) => ({
    home_team: row.homeTeam,
    away_team: row.awayTeam,
    starts_at: row.startsAt,
    venue_name: row.venueName,
    venue_city: row.venueCity,
    venue_state: row.venueState,
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
  return { count: Number((data as { count?: number } | null)?.count ?? rows.length), error: null };
}
