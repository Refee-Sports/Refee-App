import { useCallback, useState } from "react";
import { Text, View, ActivityIndicator, FlatList, RefreshControl, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import {
  fetchMyTournaments,
  fetchGamesNeedingCompletion,
  fetchMyPaymentIssues,
  fetchStandaloneGames,
  type TournamentRow,
  type NeedsCompletionRow,
  type DirectorGameRow,
} from "@/lib/director/queries";
import type { PaymentIssue } from "@refee/core/director/payment-issues";
import { DirectorDashboard } from "@/components/director/DirectorDashboard";
import { runAutoPay } from "@/lib/payments/queries";
import { Wordmark } from "@/components/ui/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { formatDateOnly } from "@refee/core/time";
import { palette, choice } from "@refee/design";
import { Tappable } from "@/components/ui/Tappable";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const STATUS_COLORS: Record<string, string> = {
  open: palette.signal,
  staffed: palette.courtInk,
  completed: palette.ink60,
  cancelled: palette.foulInk,
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
  const [paymentIssues, setPaymentIssues] = useState<PaymentIssue[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); setRefreshing(false); return; }
    setUserId(session.user.id);

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

    const [{ tournaments: rows, error: fetchErr }, nudge, { games: solo }, issues] = await Promise.all([
      fetchMyTournaments(session.user.id),
      fetchGamesNeedingCompletion(session.user.id),
      fetchStandaloneGames(session.user.id),
      fetchMyPaymentIssues(session.user.id),
    ]);
    setTournaments(rows);
    setNeedsCompletion(nudge);
    setPaymentIssues(issues);
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
        <Button label="New" size="sm" icon={<Feather name="plus" size={14} color={palette.paper} />} onPress={handleNew} />
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

      {/* Payment problems the director has to act on */}
      {paymentIssues.length > 0 && (
        <View className="mx-5 mb-4 border border-foul bg-foul/10">
          <View className="px-4 py-2.5 border-b border-foul/30 flex-row items-center gap-2">
            <Feather name="credit-card" size={13} color={palette.foul} />
            <Text className="font-mono-bold text-[10px] text-foul-ink uppercase" style={{ letterSpacing: 1.5 }}>
              {paymentIssues.length} PAYMENT ISSUE{paymentIssues.length !== 1 ? "S" : ""}
            </Text>
          </View>
          {paymentIssues.slice(0, 4).map((issue) => (
            <Tappable
              scaleTo={choice.scale.optionRow}
              style={({ pressed }) => ({ backgroundColor: pressed ? palette.chalkPress : undefined })}
              key={issue.gameId}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(`/(director)/game/${issue.gameId}` as any);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${issue.title}. ${issue.message}`}
              className="px-4 py-2.5 flex-row items-center justify-between border-b border-foul/20"
            >
              <View className="flex-1 pr-2">
                <Text className="font-mono-bold text-[11px] text-ink uppercase" style={{ letterSpacing: 0.5 }} numberOfLines={1}>
                  {issue.title}
                </Text>
                <Text className="text-[12px] text-ink-60 leading-[17px] mt-0.5">{issue.message}</Text>
              </View>
              <Feather name="chevron-right" size={14} color={palette.ink} />
            </Tappable>
          ))}
          {paymentIssues.length > 4 ? (
            <Text className="px-4 py-2 font-mono text-[8px] text-ink-60 uppercase" style={{ letterSpacing: 1 }}>
              +{paymentIssues.length - 4} MORE · OPEN EACH GAME TO FIX
            </Text>
          ) : null}
        </View>
      )}

      {/* Completion nudge — games ended but not yet closed out */}
      {needsCompletion.length > 0 && (
        <View className="mx-5 mb-4 border border-ink bg-hi-vis">
          <View className="px-4 py-2.5 border-b border-ink/20 flex-row items-center gap-2">
            <Feather name="alert-circle" size={13} color={palette.ink} />
            <Text className="font-mono-bold text-[10px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>
              {needsCompletion.length} GAME{needsCompletion.length !== 1 ? "S" : ""} NEED CLOSING OUT
            </Text>
          </View>
          {needsCompletion.slice(0, 4).map((g) => (
            <Tappable
              scaleTo={choice.scale.optionRow}
              style={({ pressed }) => ({ backgroundColor: pressed ? palette.chalkPress : undefined })}
              key={g.id}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(`/(director)/game/${g.id}` as any);
              }}
              className="px-4 py-2.5 flex-row items-center justify-between border-b border-ink/10"
            >
              <View className="flex-1 pr-2">
                <Text className="font-mono-bold text-[11px] text-ink uppercase" style={{ letterSpacing: 0.5 }} numberOfLines={1}>
                  {g.title}
                </Text>
                <Text className="font-mono text-[9px] text-ink/60 uppercase" style={{ letterSpacing: 1 }}>
                  {g.acceptedCount} REF{g.acceptedCount !== 1 ? "S" : ""} · MARK COMPLETE TO PAY
                </Text>
              </View>
              <Feather name="chevron-right" size={14} color={palette.ink} />
            </Tappable>
          ))}
          <Text className="px-4 py-2 font-mono text-[8px] text-ink/50 uppercase" style={{ letterSpacing: 1 }}>
            AUTO-COMPLETES 1H AFTER GAME END IF NOT DONE
          </Text>
        </View>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={palette.signal} />
        </View>
      ) : (
        <FlatList
          data={tournaments}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 80 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.signal} />
          }
          ListHeaderComponent={
            // The list pads its sides; the dashboard sets its own.
            userId ? (
              <View style={{ marginHorizontal: -20 }} className="mb-4">
                <DirectorDashboard userId={userId} />
              </View>
            ) : null
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
        <Text className="text-foul-ink font-mono text-xs text-center px-5 mb-4" style={{ letterSpacing: 0.5 }}>
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
  const statusColor = STATUS_COLORS[tournament.status] ?? palette.ink60;
  return (
    <Card onPress={onPress} accessibilityLabel={tournament.name}>
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
        <Text className="font-mono text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 1.5 }}>
          BASKETBALL · DIRECT HIRE
        </Text>
        <Feather name="chevron-right" size={14} color={palette.ink40} />
      </View>
    </Card>
  );
}

function SingleGameCard({ game, onPress }: { game: DirectorGameRow; onPress: () => void }) {
  const statusColor = STATUS_COLORS[game.status] ?? palette.ink60;
  const title = game.home_team && game.away_team
    ? `${game.home_team} vs ${game.away_team}`
    : game.title;
  return (
    <Card onPress={onPress} accessibilityLabel={title}>
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
    </Card>
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
        <Feather name="grid" size={28} color={palette.ink20} />
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
      <Button label="Create tournament" showArrow onPress={onCreate} />
    </View>
  );
}
