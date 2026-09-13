import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { fetchTournamentById, type TournamentRow } from "@/lib/director/queries";
import { parseScheduleCsv, type ScheduleParseResult } from "@/lib/schedule/csv";
import { downloadScheduleTemplate, importTournamentSchedule, pickScheduleCsv } from "@/lib/schedule/import";

export function ScheduleImporter({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tournament, setTournament] = useState<TournamentRow | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ScheduleParseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchTournamentById(tournamentId).then(({ tournament: value, error: fetchError }) => {
      setTournament(value);
      setError(fetchError?.message ?? (value ? null : "Tournament not found."));
      setLoading(false);
    });
  }, [tournamentId]);

  const chooseFile = async () => {
    if (!tournament || working) return;
    setWorking(true);
    setError(null);
    try {
      const picked = await pickScheduleCsv();
      if (picked) {
        setFileName(picked.name);
        setPreview(parseScheduleCsv(picked.text, {
          startsOn: tournament.starts_on,
          endsOn: tournament.ends_on,
          timezone: tournament.timezone,
          venueName: tournament.venue_name,
          venueCity: tournament.venue_city,
          venueState: tournament.venue_state,
          ruleset: tournament.ruleset,
          uniformRequirements: tournament.uniform_requirements,
          gameFormat: tournament.game_format,
          periodMinutes: tournament.period_minutes,
          rulesetModifications: tournament.ruleset_modifications,
        }));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read that CSV.");
    } finally {
      setWorking(false);
    }
  };

  const save = async () => {
    if (!preview?.canImport || working) return;
    setWorking(true);
    setError(null);
    const result = await importTournamentSchedule(tournamentId, preview.validRows);
    setWorking(false);
    if (result.error) {
      setError(result.error.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Schedule imported", `${result.count} game${result.count === 1 ? "" : "s"} were created.`, [
      { text: "Done", onPress: () => router.back() },
    ]);
  };

  if (loading) return <View className="flex-1 bg-paper items-center justify-center"><ActivityIndicator color="#1F4FCC" /></View>;

  const invalidCount = preview?.rows.filter((row) => row.errors.length > 0).length ?? 0;
  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-3 flex-row items-center justify-between border-b border-ink">
        <Pressable onPress={() => router.back()} className="w-9 h-9 border border-ink items-center justify-center active:opacity-70">
          <Feather name="x" size={16} color="#08111C" />
        </Pressable>
        <Text className="font-mono-bold text-[10px] text-ink uppercase" style={{ letterSpacing: 1.7 }}>IMPORT SCHEDULE</Text>
        <View className="w-9" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120 }}>
        <Text className="font-display text-ink uppercase" style={{ fontSize: 34, lineHeight: 34, letterSpacing: -1.2 }}>BULK ADD GAMES</Text>
        <Text className="font-mono text-[10px] text-ink-60 uppercase mt-2" style={{ letterSpacing: 1 }}>
          {tournament?.name ?? "Tournament"} · {tournament?.timezone ?? ""}
        </Text>

        <View className="border border-ink bg-chalk p-4 mt-6">
          <Text className="font-mono-bold text-[10px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>1 · USE THE TEMPLATE</Text>
          <Text className="font-mono text-[9px] text-ink-60 mt-2 leading-4">KEEP THE COLUMN HEADERS. USE 24-HOUR TIME AND AN IANA TIMEZONE SUCH AS AMERICA/CHICAGO.</Text>
          <Pressable onPress={() => void downloadScheduleTemplate().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not save the template."))} className="border border-ink px-4 py-3 mt-4 flex-row justify-center items-center gap-2 active:opacity-70">
            <Feather name="download" size={13} color="#08111C" />
            <Text className="font-mono-bold text-[9px] text-ink uppercase">DOWNLOAD CSV TEMPLATE</Text>
          </Pressable>
        </View>

        <View className="border border-ink bg-chalk p-4 mt-3">
          <Text className="font-mono-bold text-[10px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>2 · UPLOAD AND REVIEW</Text>
          <Pressable onPress={() => void chooseFile()} disabled={working || !tournament} className="bg-ink px-4 py-3 mt-4 flex-row justify-center items-center gap-2 active:opacity-70">
            {working && !preview ? <ActivityIndicator color="#E5E1D6" /> : <Feather name="upload" size={13} color="#E5E1D6" />}
            <Text className="font-mono-bold text-[9px] text-paper uppercase">{fileName ? "CHOOSE ANOTHER CSV" : "CHOOSE CSV"}</Text>
          </Pressable>
          {fileName && <Text className="font-mono text-[9px] text-ink-60 mt-3" numberOfLines={1}>{fileName.toUpperCase()}</Text>}
        </View>

        {error && <View className="border border-foul bg-foul/10 px-4 py-3 mt-3"><Text className="font-mono-bold text-[9px] text-foul uppercase">{error}</Text></View>}
        {preview?.fileErrors.map((message) => <View key={message} className="border border-foul bg-foul/10 px-4 py-3 mt-3"><Text className="font-mono text-[9px] text-foul uppercase">{message}</Text></View>)}

        {preview && preview.rows.length > 0 && (
          <View className="mt-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="font-mono-bold text-[10px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>PREVIEW · {preview.rows.length} GAMES</Text>
              <Text className={`font-mono-bold text-[9px] uppercase ${invalidCount ? "text-foul" : "text-court"}`}>{invalidCount ? `${invalidCount} INVALID` : "READY"}</Text>
            </View>
            {preview.rows.map((row) => (
              <View key={row.rowNumber} className={`border bg-chalk p-3 mb-2 ${row.errors.length ? "border-foul" : "border-ink"}`}>
                <View className="flex-row justify-between gap-3">
                  <Text className="font-mono-bold text-[10px] text-ink uppercase flex-1" numberOfLines={1}>ROW {row.rowNumber} · {row.homeTeam || "?"} VS {row.awayTeam || "?"}</Text>
                  <Text className={`font-mono-bold text-[8px] ${row.errors.length ? "text-foul" : "text-court"}`}>{row.errors.length ? "FIX" : "OK"}</Text>
                </View>
                <Text className="font-mono text-[8px] text-ink-40 mt-1 uppercase">{row.localWhen}</Text>
                {row.errors.map((message) => <Text key={message} className="font-mono text-[8px] text-foul mt-1 uppercase">• {message}</Text>)}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-ink bg-paper px-5 pt-3" style={{ paddingBottom: insets.bottom + 14 }}>
        <Pressable onPress={() => void save()} disabled={!preview?.canImport || working} className={`py-4 items-center ${preview?.canImport && !working ? "bg-ink" : "bg-ink-20"}`}>
          {working && preview ? <ActivityIndicator color="#E5E1D6" /> : <Text className={`font-mono-bold text-[10px] uppercase ${preview?.canImport ? "text-paper" : "text-ink-40"}`}>IMPORT {preview?.validRows.length ?? 0} GAMES →</Text>}
        </Pressable>
      </View>
    </View>
  );
}
