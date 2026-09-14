import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import {
  directAssignRefToGame,
  fetchAssignorGame,
  fetchGameCrew,
  fetchMyRoster,
  removeRefFromGame,
  setGameStaffingMode,
  type AssignorGameRow,
  type RosterMemberRow,
} from "@/lib/assignor/queries";
import { formatGameDate, formatGameTimeWithZone } from "@refee/core/time";

type CrewRow = { id: string; ref_id: string; role: string; status: string; display_name: string };

/** "SUN, SEP 20 · 1:30 PM ET" in the venue's zone. */
function formatWhen(value: string, tz?: string | null) {
  const day = formatGameDate(value, tz, { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  return `${day} · ${formatGameTimeWithZone(value, tz)}`;
}

export default function AssignorGameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [game, setGame] = useState<AssignorGameRow | null>(null);
  const [crew, setCrew] = useState<CrewRow[]>([]);
  const [roster, setRoster] = useState<RosterMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    const [gameResult, crewResult, rosterResult] = await Promise.all([
      fetchAssignorGame(id),
      fetchGameCrew(id),
      fetchMyRoster(session.user.id),
    ]);
    setGame(gameResult.game);
    setCrew(crewResult.crew);
    setRoster(rosterResult.members);
    setError(gameResult.error?.message ?? crewResult.error?.message ?? rosterResult.error?.message ?? null);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const setMode = async (mode: "assignor_direct" | "self_assign") => {
    if (!id || busyId) return;
    setBusyId(mode);
    const result = await setGameStaffingMode(id, mode);
    setBusyId(null);
    if (result.error) Alert.alert("Mode not changed", result.error.message);
    else {
      Haptics.selectionAsync();
      setGame((current) => current ? { ...current, assignor_staffing_mode: mode } : current);
    }
  };

  const offer = async (member: RosterMemberRow) => {
    if (!id || busyId) return;
    setBusyId(member.ref_id);
    const result = await directAssignRefToGame(id, member.ref_id);
    setBusyId(null);
    if (result.error) Alert.alert("Offer not sent", result.error.message);
    else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    }
  };

  const remove = (assignment: CrewRow) => {
    Alert.alert("Remove from game?", `${assignment.display_name} will lose this assignment.`, [
      { text: "Keep", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => {
        setBusyId(assignment.id);
        void removeRefFromGame(assignment.id).then(async (result) => {
          setBusyId(null);
          if (result.error) Alert.alert("Could not remove referee", result.error.message);
          else await load();
        });
      } },
    ]);
  };

  if (loading) return <View className="flex-1 bg-paper items-center justify-center"><ActivityIndicator color="#1F4FCC" /></View>;
  if (!game) return <View className="flex-1 bg-paper items-center justify-center"><Text className="font-mono-bold text-ink">GAME NOT AVAILABLE</Text></View>;

  const assignedIds = new Set(crew.map((member) => member.ref_id));
  const available = roster.filter((member) => member.status === "accepted" && member.is_available && !assignedIds.has(member.ref_id));
  const mode = game.assignor_staffing_mode ?? "assignor_direct";

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-3 flex-row items-center justify-between border-b border-ink">
        <Pressable onPress={() => router.back()} className="w-9 h-9 border border-ink items-center justify-center active:opacity-70"><Feather name="arrow-left" size={16} color="#08111C" /></Pressable>
        <Text className="font-mono-bold text-[9px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>STAFF GAME</Text>
        <View className="w-9" />
      </View>

      <FlatList
        data={mode === "assignor_direct" ? available : []}
        keyExtractor={(member) => member.ref_id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }}
        ListHeaderComponent={(
          <View>
            <Text className="font-display text-ink uppercase mt-6" style={{ fontSize: 32, lineHeight: 32, letterSpacing: -1 }}>{game.title}</Text>
            <Text className="font-mono text-[9px] text-ink-60 uppercase mt-2" style={{ letterSpacing: 1 }}>{formatWhen(game.starts_at, game.timezone)} · {game.venue_name}</Text>
            <Text className="font-mono-bold text-[10px] text-signal uppercase mt-2">${game.pay_per_game}/REF · {crew.length}/{game.crew_size} SLOTS ACTIVE</Text>

            <Text className="font-mono-bold text-[9px] text-ink uppercase mt-6 mb-2" style={{ letterSpacing: 1.5 }}>STAFFING MODE</Text>
            <View className="flex-row mb-5">
              {(["assignor_direct", "self_assign"] as const).map((value) => (
                <Pressable key={value} disabled={busyId !== null} onPress={() => void setMode(value)} className={`flex-1 border border-ink py-3 items-center ${mode === value ? "bg-ink" : "bg-chalk"}`}>
                  <Text className={`font-mono-bold text-[8px] uppercase ${mode === value ? "text-paper" : "text-ink"}`}>{value === "assignor_direct" ? "OFFER FROM ROSTER" : "ROSTER SELF-CLAIM"}</Text>
                </Pressable>
              ))}
            </View>

            {mode === "self_assign" && (
              <View className="border border-signal bg-signal/10 px-4 py-3 mb-5">
                <Text className="font-mono text-[9px] text-ink uppercase" style={{ letterSpacing: 1 }}>
                  Accepted roster referees can claim this game until the crew is full. Conflicts and capacity are checked atomically.
                </Text>
              </View>
            )}

            <Text className="font-mono-bold text-[9px] text-ink uppercase mb-2" style={{ letterSpacing: 1.5 }}>ACTIVE CREW ({crew.length})</Text>
            {crew.length === 0 ? (
              <Text className="font-mono text-[9px] text-ink-40 uppercase py-3">No offers or accepted referees yet.</Text>
            ) : crew.map((member) => (
              <View key={member.id} className="border border-ink bg-chalk px-4 py-3 mb-2 flex-row items-center">
                <View className="flex-1">
                  <Text className="font-mono-bold text-[10px] text-ink uppercase">{member.display_name}</Text>
                  <Text className="font-mono text-[8px] text-ink-40 uppercase mt-1">{member.role} · {member.status}</Text>
                </View>
                <Pressable disabled={busyId !== null} onPress={() => remove(member)} className="border border-foul px-2.5 py-2">
                  {busyId === member.id ? <ActivityIndicator size="small" color="#E53E3E" /> : <Text className="font-mono-bold text-[8px] text-foul">REMOVE</Text>}
                </Pressable>
              </View>
            ))}

            {mode === "assignor_direct" && <Text className="font-mono-bold text-[9px] text-ink uppercase mt-5 mb-2" style={{ letterSpacing: 1.5 }}>AVAILABLE ROSTER ({available.length})</Text>}
          </View>
        )}
        ListEmptyComponent={mode === "assignor_direct" ? (
          <Text className="font-mono text-[9px] text-ink-40 uppercase text-center py-8">No available accepted roster referees remain for this game.</Text>
        ) : null}
        renderItem={({ item }) => (
          <View className="border border-ink bg-chalk px-4 py-3 mb-2 flex-row items-center">
            <View className="flex-1">
              <Text className="font-mono-bold text-[10px] text-ink uppercase">{item.display_name}</Text>
              <Text className="font-mono text-[8px] text-ink-40 uppercase mt-1">{item.city}, {item.state} · {item.rating.toFixed(1)} RATING</Text>
            </View>
            <Pressable disabled={busyId !== null || crew.length >= game.crew_size} onPress={() => void offer(item)} className={`px-3 py-2 border border-ink ${crew.length >= game.crew_size ? "bg-ink-20" : "bg-ink"}`}>
              {busyId === item.ref_id ? <ActivityIndicator size="small" color="#E5E1D6" /> : <Text className="font-mono-bold text-[8px] text-paper">OFFER</Text>}
            </Pressable>
          </View>
        )}
      />
      {error && <Text className="text-foul font-mono text-[10px] text-center px-5 mb-4 uppercase">{error}</Text>}
    </View>
  );
}
