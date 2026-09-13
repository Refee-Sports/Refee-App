import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Wordmark } from "@/components/ui/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { supabase } from "@/lib/supabase";
import {
  fetchMyAssignedTournaments,
  fetchTournamentInvites,
  type TournamentInviteRow,
} from "@/lib/assignor/queries";

type SectionRow =
  | { kind: "heading"; id: string; label: string; count: number }
  | { kind: "tournament"; id: string; tournament: TournamentInviteRow; invited: boolean };

function orgName(tournament: TournamentInviteRow) {
  const hirer = Array.isArray(tournament.hirer) ? tournament.hirer[0] : tournament.hirer;
  return hirer?.org_name ?? "Tournament director";
}

function dateRange(tournament: TournamentInviteRow) {
  const format = (value: string) =>
    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).toUpperCase();
  return `${format(tournament.starts_on)}–${format(tournament.ends_on)}`;
}

export default function AssignorTournaments() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [invites, setInvites] = useState<TournamentInviteRow[]>([]);
  const [assigned, setAssigned] = useState<TournamentInviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const [inviteResult, assignedResult] = await Promise.all([
      fetchTournamentInvites(session.user.id),
      fetchMyAssignedTournaments(session.user.id),
    ]);
    setInvites(inviteResult.invites);
    setAssigned(assignedResult.tournaments);
    setError(inviteResult.error?.message ?? assignedResult.error?.message ?? null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const rows: SectionRow[] = [
    ...(invites.length
      ? [{ kind: "heading" as const, id: "invites", label: "INVITES & PROPOSALS", count: invites.length },
         ...invites.map((tournament) => ({ kind: "tournament" as const, id: `invite-${tournament.id}`, tournament, invited: true }))]
      : []),
    { kind: "heading", id: "assigned", label: "ASSIGNED TOURNAMENTS", count: assigned.length },
    ...assigned.map((tournament) => ({ kind: "tournament" as const, id: `assigned-${tournament.id}`, tournament, invited: false })),
  ];

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <View className="px-5 pt-1 pb-3 flex-row items-center justify-between">
        <Wordmark size={26} />
        <View className="border border-ink px-2.5 py-1.5 bg-chalk">
          <Text className="font-mono-bold text-[9px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>ASSIGNOR</Text>
        </View>
      </View>
      <View className="px-5 pb-1.5 flex-row justify-between">
        <Text className="font-mono text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 2 }}>
          <Text className="font-mono-bold text-ink">TOURNAMENTS</Text>{` · ${assigned.length} ACTIVE`}
        </Text>
        {invites.length > 0 && (
          <Text className="font-mono-bold text-[9px] text-signal uppercase" style={{ letterSpacing: 1.5 }}>
            {invites.length} NEED ACTION
          </Text>
        )}
      </View>
      <View className="px-5 mb-4"><ZebraRule variant="signal" thin /></View>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#1F4FCC" /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#1F4FCC" />}
          ListEmptyComponent={<EmptyState />}
          renderItem={({ item }) => item.kind === "heading" ? (
            <Text className="font-mono-bold text-[10px] text-ink uppercase mt-3 mb-2" style={{ letterSpacing: 2 }}>
              ── {item.label} ({item.count})
            </Text>
          ) : (
            <Pressable
              onPress={() => { Haptics.selectionAsync(); router.push(`/(assignor)/tournament/${item.tournament.id}` as any); }}
              className="border border-ink bg-chalk mb-2 active:opacity-75"
            >
              <View className={`h-1 ${item.invited ? "bg-signal" : "bg-court"}`} />
              <View className="px-4 pt-3 pb-3">
                <View className="flex-row justify-between items-start">
                  <Text className="font-display text-ink flex-1 pr-3" style={{ fontSize: 20, lineHeight: 22, letterSpacing: -0.5 }} numberOfLines={2}>
                    {item.tournament.name.toUpperCase()}
                  </Text>
                  <Text className="font-mono-bold text-[8px] text-signal uppercase" style={{ letterSpacing: 1.2 }}>
                    {item.invited ? item.tournament.assignor_status : "ACCEPTED"}
                  </Text>
                </View>
                <Text className="font-mono text-[9px] text-ink-60 uppercase mt-1" style={{ letterSpacing: 1 }}>
                  {orgName(item.tournament).toUpperCase()} · {item.tournament.venue_city.toUpperCase()}, {item.tournament.venue_state}
                </Text>
              </View>
              <View className="border-t border-ink-20 px-4 py-2.5 flex-row justify-between items-center">
                <Text className="font-mono text-[9px] text-ink-40 uppercase" style={{ letterSpacing: 1.2 }}>
                  {dateRange(item.tournament)} · {item.tournament.total_games ?? "—"} GAMES
                </Text>
                <Feather name="chevron-right" size={14} color="rgba(8,17,28,0.4)" />
              </View>
            </Pressable>
          )}
        />
      )}
      {error && <Text className="text-foul font-mono text-[10px] text-center px-5 mb-4 uppercase">{error}</Text>}
    </View>
  );
}

function EmptyState() {
  return (
    <View className="items-center justify-center px-8 py-24">
      <Feather name="calendar" size={28} color="rgba(8,17,28,0.35)" />
      <Text className="font-mono-bold text-[11px] text-ink uppercase text-center mt-4" style={{ letterSpacing: 1.5 }}>
        NO TOURNAMENTS YET
      </Text>
      <Text className="font-mono text-[9px] text-ink-40 uppercase text-center mt-2" style={{ letterSpacing: 1 }}>
        Director invitations and accepted events will appear here.
      </Text>
    </View>
  );
}
