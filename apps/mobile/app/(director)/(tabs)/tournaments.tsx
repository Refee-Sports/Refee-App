import { useCallback, useState } from "react";
import { Text, View, Pressable, ActivityIndicator, FlatList, RefreshControl, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import {
  fetchMyTournaments,
  fetchGamesNeedingCompletion,
  fetchStandaloneGames,
  type TournamentRow,
  type NeedsCompletionRow,
  type DirectorGameRow,
} from "@/lib/director/queries";
import { runAutoPay } from "@/lib/payments/queries";
import { Wordmark } from "@/components/ui/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { formatDateOnly } from "@refee/core/time";

const STATUS_COLORS: Record<string, string> = {
  open: "#1F4FCC",
  staffed: "#00A85C",
  completed: "rgba(8,17,28,0.40)",
  cancelled: "#E53E3E",
};

/** A tournament's date-only start/end, shown as the calendar day it is. */
function formatDate(ymd: string) {
  return formatDateOnly(ymd, { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

export default function TournamentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [singleGames, setSingleGames] = useState<DirectorGameRow[]>([]);
  const [needsCompletion, setNeedsCompletion] = useState<NeedsCompletionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); setRefreshing(false); return; }

    // Games auto-complete on the hourly sweep-game-lifecycle job; this only
    // pays games from before charge-at-booking that finished since last visit.
    void runAutoPay().then(({ result }) => {
      if (result && result.paid.length > 0) {
        const total = result.paid.reduce((s, p) => s + p.total, 0);
        Alert.alert(
          "Crews paid automatically",
          `${result.paid.length} completed game${result.paid.length !== 1 ? "s" : ""} charged ($${total} total) and referees paid.`
        );
      }
    });

    const [{ tournaments: rows, error: fetchErr }, nudge, { games: solo }] = await Promise.all([
      fetchMyTournaments(session.user.id),
      fetchGamesNeedingCompletion(session.user.id),
      fetchStandaloneGames(session.user.id),
    ]);
    setTournaments(rows);
    setNeedsCompletion(nudge);
    setSingleGames(solo);
    if (fetchErr) setError(fetchErr.message);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleNew = () => {
    Haptics.selectionAsync();
    Alert.alert("Create new", "What do you want to create?", [
      { text: "Tournament", onPress: () => router.push("/(director)/tournament/create" as any) },
      { text: "Single game", onPress: () => router.push("/(director)/game/create" as any) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-5 pt-1 pb-3 flex-row items-center justify-between">
        <Wordmark size={26} />
        <Pressable
          onPress={handleNew}
          className="h-9 px-3 bg-ink items-center justify-center flex-row gap-1.5 active:opacity-70"
        >
          <Feather name="plus" size={14} color="#E5E1D6" />
          <Text className="text-paper font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 1.5 }}>
            New
          </Text>
        </Pressable>
      </View>

      {/* Telemetry */}
      <View className="px-5 pb-1.5 flex-row justify-between">
        <Text className="font-mono text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 2 }}>
          <Text className="font-mono-bold text-ink">TOURNAMENTS</Text>
          {` · ${tournaments.length} TOTAL`}
        </Text>
      </View>
      <View className="px-5 mb-4">
        <ZebraRule variant="signal" thin />
      </View>

      {/* Completion nudge — games ended but not yet closed out */}
      {needsCompletion.length > 0 && (
        <View className="mx-5 mb-4 border border-ink bg-hivis">
          <View className="px-4 py-2.5 border-b border-ink/20 flex-row items-center gap-2">
            <Feather name="alert-circle" size={13} color="#08111C" />
            <Text className="font-mono-bold text-[10px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>
              {needsCompletion.length} GAME{needsCompletion.length !== 1 ? "S" : ""} NEED CLOSING OUT
            </Text>
          </View>
          {needsCompletion.slice(0, 4).map((g) => (
            <Pressable
              key={g.id}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(`/(director)/game/${g.id}` as any);
              }}
              className="px-4 py-2.5 flex-row items-center justify-between active:opacity-70 border-b border-ink/10"
            >
              <View className="flex-1 pr-2">
                <Text className="font-mono-bold text-[11px] text-ink uppercase" style={{ letterSpacing: 0.5 }} numberOfLines={1}>
                  {g.title}
                </Text>
                <Text className="font-mono text-[9px] text-ink/60 uppercase" style={{ letterSpacing: 1 }}>
                  {g.acceptedCount} REF{g.acceptedCount !== 1 ? "S" : ""} · MARK COMPLETE TO PAY
                </Text>
              </View>
              <Feather name="chevron-right" size={14} color="#08111C" />
            </Pressable>
          ))}
          <Text className="px-4 py-2 font-mono text-[8px] text-ink/50 uppercase" style={{ letterSpacing: 1 }}>
            AUTO-COMPLETES 24H AFTER GAME END IF NOT DONE
          </Text>
        </View>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1F4FCC" />
        </View>
      ) : (
        <FlatList
          data={tournaments}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 80 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#1F4FCC" />
          }
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={
            singleGames.length === 0 ? (
              <EmptyState onCreate={handleNew} />
            ) : null
          }
          renderItem={({ item }) => (
            <TournamentCard
              tournament={item}
              onPress={() => router.push(`/(director)/tournament/${item.id}` as any)}
            />
          )}
          ListFooterComponent={
            singleGames.length > 0 ? (
              <View className="mt-5">
                <Text className="font-mono-bold text-[10px] text-ink uppercase mb-3" style={{ letterSpacing: 2.5 }}>
                  ── SINGLE GAMES ({singleGames.length})
                </Text>
                <View className="gap-2">
                  {singleGames.map((g) => (
                    <SingleGameCard
                      key={g.id}
                      game={g}
                      onPress={() => router.push(`/(director)/game/${g.id}` as any)}
                    />
                  ))}
                </View>
              </View>
            ) : null
          }
        />
      )}

      {error && (
        <Text className="text-foul font-mono text-xs text-center px-5 mb-4" style={{ letterSpacing: 0.5 }}>
          {error}
        </Text>
      )}
    </View>
  );
}

function TournamentCard({
  tournament,
  onPress,
}: {
  tournament: TournamentRow;
  onPress: () => void;
}) {
  const statusColor = STATUS_COLORS[tournament.status] ?? "rgba(8,17,28,0.40)";
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      className="border border-ink bg-chalk active:opacity-75"
    >
      {/* Status bar */}
      <View className="h-1" style={{ backgroundColor: statusColor }} />

      <View className="px-4 pt-3 pb-4">
        <View className="flex-row items-start justify-between mb-1">
          <Text
            className="text-ink font-display flex-1 pr-2"
            style={{ fontSize: 20, letterSpacing: -0.5, lineHeight: 22 }}
            numberOfLines={2}
          >
            {tournament.name.toUpperCase()}
          </Text>
          <Text
            className="font-mono-bold text-[9px] uppercase"
            style={{ letterSpacing: 1.5, color: statusColor, marginTop: 2 }}
          >
            {tournament.status}
          </Text>
        </View>

        <Text className="font-mono text-[10px] text-ink-60 uppercase" style={{ letterSpacing: 1 }}>
          {tournament.venue_city.toUpperCase()}, {tournament.venue_state}
        </Text>

        <View className="flex-row items-center gap-3 mt-3">
          <DataPill label="START" value={formatDate(tournament.starts_on)} />
          <DataPill label="END" value={formatDate(tournament.ends_on)} />
        </View>
      </View>

      <View className="border-t border-ink-20 px-4 py-2.5 flex-row justify-between items-center">
        <Text className="font-mono text-[9px] text-ink-40 uppercase" style={{ letterSpacing: 1.5 }}>
          BASKETBALL · DIRECT HIRE
        </Text>
        <Feather name="chevron-right" size={14} color="rgba(8,17,28,0.40)" />
      </View>
    </Pressable>
  );
}

function SingleGameCard({ game, onPress }: { game: DirectorGameRow; onPress: () => void }) {
  const statusColor = STATUS_COLORS[game.status] ?? "rgba(8,17,28,0.40)";
  const title = game.home_team && game.away_team
    ? `${game.home_team} vs ${game.away_team}`
    : game.title;
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      className="border border-ink bg-chalk active:opacity-75"
    >
      <View className="h-1" style={{ backgroundColor: statusColor }} />
      <View className="px-4 pt-3 pb-3">
        <View className="flex-row items-start justify-between mb-1">
          <Text
            className="text-ink font-mono-bold text-[12px] uppercase flex-1 pr-2"
            style={{ letterSpacing: 0.5 }}
            numberOfLines={1}
          >
            {title.toUpperCase()}
          </Text>
          <Text className="font-mono-bold text-[8px] uppercase" style={{ letterSpacing: 1.5, color: statusColor }}>
            {game.status}
          </Text>
        </View>
        <Text className="font-mono text-[10px] text-ink-60 uppercase" style={{ letterSpacing: 1 }}>
          {game.venue_city.toUpperCase()}, {game.venue_state} · ${game.pay_per_game}/REF
        </Text>
      </View>
    </Pressable>
  );
}

function DataPill({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="font-mono text-[8px] text-ink-40 uppercase mb-0.5" style={{ letterSpacing: 1.5 }}>
        {label}
      </Text>
      <Text className="font-mono-bold text-[10px] text-ink uppercase" style={{ letterSpacing: 0.5 }}>
        {value}
      </Text>
    </View>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="w-16 h-16 border-2 border-ink-20 items-center justify-center mb-5">
        <Feather name="grid" size={28} color="rgba(8,17,28,0.20)" />
      </View>
      <Text
        className="font-display text-ink text-center mb-2"
        style={{ fontSize: 24, letterSpacing: -0.5, lineHeight: 24 }}
      >
        {"NO TOURNAMENTS\nYET"}
      </Text>
      <Text className="font-mono text-[11px] text-ink-60 text-center mb-8" style={{ letterSpacing: 0.5 }}>
        Create your first tournament to start posting game assignments.
      </Text>
      <Pressable
        onPress={() => { Haptics.selectionAsync(); onCreate() ; }}
        className="bg-ink px-8 py-4 active:opacity-80"
      >
        <Text className="text-paper font-mono-bold text-[11px] uppercase" style={{ letterSpacing: 2 }}>
          CREATE TOURNAMENT →
        </Text>
      </Pressable>
    </View>
  );
}
