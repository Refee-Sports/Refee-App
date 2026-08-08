import { useCallback, useEffect, useState } from "react";
import { Text, View, Pressable, ActivityIndicator, FlatList, Alert } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScrollScreen } from "@/components/layout/ScrollScreen";
import { ZebraRule } from "@/components/ui/ZebraRule";
import {
  fetchTournamentById,
  fetchTournamentGames,
  updateTournamentStatus,
  type TournamentRow,
  type DirectorGameRow,
} from "@/lib/director/queries";

const TZ = "America/Chicago";

function fmt(iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString("en-US", { ...opts, timeZone: TZ }).toUpperCase();
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ,
  });
}


export default function TournamentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tournament, setTournament] = useState<TournamentRow | null>(null);
  const [games, setGames] = useState<DirectorGameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ tournament: t, error: tErr }, { games: g, error: gErr }] = await Promise.all([
      fetchTournamentById(id),
      fetchTournamentGames(id),
    ]);
    setTournament(t);
    setGames(g);
    setError(tErr?.message ?? gErr?.message ?? null);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return (
      <View className="flex-1 bg-paper items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator color="#1F4FCC" />
      </View>
    );
  }

  if (!tournament) {
    return (
      <View className="flex-1 bg-paper items-center justify-center" style={{ paddingTop: insets.top }}>
        <Text className="text-ink font-mono-bold uppercase" style={{ letterSpacing: 1 }}>
          Tournament not found.
        </Text>
      </View>
    );
  }

  const staffedGames = games.filter((g) => g.status === "staffed" || g.status === "completed").length;
  // Tournament is 'staffed' once it has games and all are staffed/completed
  const derivedStatus =
    tournament.status === "completed" || tournament.status === "cancelled"
      ? tournament.status
      : games.length > 0 && staffedGames === games.length
        ? "staffed"
        : "open";

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      {/* Back */}
      <View className="px-5 py-3 flex-row items-center gap-3">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70"
        >
          <Text className="text-ink font-mono-bold text-base">←</Text>
        </Pressable>
        <Text
          className="font-mono-bold text-[10px] text-ink-60 uppercase flex-1"
          style={{ letterSpacing: 2 }}
          numberOfLines={1}
        >
          {tournament.name.toUpperCase()}
        </Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push({
              pathname: "/(director)/tournament/create" as any,
              params: { editId: id },
            });
          }}
          className="h-9 px-3 border border-ink bg-chalk flex-row items-center gap-1.5 active:opacity-70"
        >
          <Feather name="edit-2" size={12} color="#08111C" />
          <Text className="text-ink font-mono-bold text-[9px] uppercase" style={{ letterSpacing: 1.5 }}>
            EDIT
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={games}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        ListHeaderComponent={
          <>
            {/* Tournament hero */}
            <View className="px-5 pb-1.5">
              <Text
                className="font-display text-ink uppercase"
                style={{ fontSize: 30, lineHeight: 28, letterSpacing: -1 }}
              >
                {tournament.name.toUpperCase()}
              </Text>
              <Text className="font-mono text-[10px] text-ink-60 uppercase mt-1.5" style={{ letterSpacing: 1.5 }}>
                {tournament.venue_city.toUpperCase()}, {tournament.venue_state} ·{" "}
                {fmt(tournament.starts_on, { month: "short", day: "numeric" })}–
                {fmt(tournament.ends_on, { month: "short", day: "numeric", year: "numeric" })}
              </Text>
            </View>
            <View className="px-5 my-3">
              <ZebraRule thin />
            </View>

            {/* Stats */}
            <View className="mx-5 border border-ink bg-chalk flex-row mb-4">
              <StatCell label="GAMES" value={String(games.length)} />
              <View className="w-px bg-ink" />
              <StatCell label="STAFFED" value={`${staffedGames}/${games.length}`} />
              <View className="w-px bg-ink" />
              <StatCell label="STATUS" value={derivedStatus.toUpperCase()} />
            </View>

            {/* Games header */}
            <View className="px-5 flex-row items-center justify-between mb-3">
              <Text
                className="font-mono-bold text-[10px] text-ink uppercase"
                style={{ letterSpacing: 2.5 }}
              >
                ── GAMES ({games.length})
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({ pathname: "/(director)/game/create" as any, params: { tournamentId: id } });
                }}
                className="h-8 px-3 bg-ink flex-row items-center gap-1.5 active:opacity-70"
              >
                <Feather name="plus" size={12} color="#E5E1D6" />
                <Text className="text-paper font-mono-bold text-[9px] uppercase" style={{ letterSpacing: 1.5 }}>
                  ADD GAME
                </Text>
              </Pressable>
            </View>

            {games.length === 0 && (
              <View className="mx-5 border border-dashed border-ink-20 px-5 py-8 items-center">
                <Text className="font-mono text-ink-40 text-[11px] uppercase text-center" style={{ letterSpacing: 1 }}>
                  No games yet.{"\n"}Add your first game to start hiring officials.
                </Text>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            className="mx-5 mb-2 border border-ink bg-chalk active:opacity-75"
            onPress={() => {
              Haptics.selectionAsync();
              router.push(`/(director)/game/${item.id}` as any);
            }}
          >
            <View className="px-4 pt-3.5 pb-3">
              <View className="flex-row items-start justify-between mb-1">
                <Text
                  className="text-ink font-mono-bold text-[12px] uppercase flex-1 pr-2"
                  style={{ letterSpacing: 0.5 }}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <GameStatusBadge status={item.status} />
              </View>
              <Text className="font-mono text-[10px] text-ink-60 uppercase" style={{ letterSpacing: 1 }}>
                {fmtTime(item.starts_at)} · {item.venue_city.toUpperCase()}, {item.venue_state}
              </Text>
            </View>
            <View className="border-t border-ink-20 flex-row items-center">
              <View className="flex-1 px-4 py-2.5">
                <Text className="font-mono text-[9px] text-ink-40 uppercase" style={{ letterSpacing: 1 }}>
                  {item.crew_size}-REF · ${item.pay_per_game}/GAME
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({
                    pathname: "/(director)/game/create" as any,
                    params: { tournamentId: id, copyFromId: item.id },
                  });
                }}
                className="px-3 py-2.5 border-l border-ink-20 flex-row items-center gap-1 active:opacity-60"
              >
                <Feather name="copy" size={11} color="#1F4FCC" />
                <Text className="font-mono-bold text-[8px] text-signal uppercase" style={{ letterSpacing: 1 }}>
                  COPY
                </Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 px-3 py-3 items-center">
      <Text className="font-mono text-[8px] text-ink-40 uppercase mb-0.5" style={{ letterSpacing: 2 }}>
        {label}
      </Text>
      <Text className="font-display text-ink" style={{ fontSize: 20, letterSpacing: -0.5 }}>
        {value}
      </Text>
    </View>
  );
}

function GameStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: "#1F4FCC",
    staffed: "#00A85C",
    completed: "#00A85C",
    cancelled: "#E53E3E",
  };
  return (
    <Text
      className="font-mono-bold text-[8px] uppercase"
      style={{ letterSpacing: 1.5, color: colors[status] ?? "rgba(8,17,28,0.40)" }}
    >
      {status}
    </Text>
  );
}
