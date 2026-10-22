import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import {
  assignMyself,
  canAssignMyself,
  directAssignRefToGame,
  fetchAssignorGame,
  fetchGameCrew,
  fetchMyRoster,
  removeRefFromGame,
  setGameStaffingMode,
  type AssignorGameRow,
  type RosterMemberRow,
} from "@/lib/assignor/queries";
import { getOrCreateDM, postCrewNote } from "@/lib/messages/queries";
import { crewChatOpen } from "@refee/core/messages/permissions";
import { cancelGame, completeGame } from "@/lib/director/queries";
import { fetchRoles, type Role } from "@/lib/roles/queries";
import { formatGameDate, formatGameTimeWithZone } from "@refee/core/time";
import { palette } from "@refee/design";
import { BackButton, IconButton } from "@/components/ui/Controls";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Choice";
import { Tappable } from "@/components/ui/Tappable";

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
  const [note, setNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    setUserId(session.user.id);
    const [gameResult, crewResult, rosterResult, rolesResult] = await Promise.all([
      fetchAssignorGame(id),
      fetchGameCrew(id),
      fetchMyRoster(session.user.id),
      fetchRoles(session.user.id),
    ]);
    setRoles(rolesResult.roles);
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

  // ADR 0002, case C: an assignor who also referees can put themselves on the game.
  const assignSelf = async () => {
    if (!id || !userId || busyId || !game) return;
    setBusyId("self");
    const result = await assignMyself(id, userId, game.assignor_staffing_mode ?? "assignor_direct");
    setBusyId(null);
    if (result.error) Alert.alert("Couldn't add you", result.error.message);
    else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    }
  };

  // The event's assignor runs game day, so they can close a game out like the director.
  const markCompleted = () => {
    if (!id || !userId || busyId) return;
    Alert.alert("Mark game completed?", "Each confirmed referee's pay is locked in.", [
      { text: "Not yet", style: "cancel" },
      {
        text: "Mark completed",
        onPress: async () => {
          setBusyId("complete");
          const result = await completeGame(id, userId);
          setBusyId(null);
          if (result.error) Alert.alert("Not completed", result.error.message);
          else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await load();
          }
        },
      },
    ]);
  };

  const cancel = () => {
    if (!id || !userId || busyId) return;
    Alert.alert(
      "Cancel this game?",
      "Confirmed referees and applicants are told. A late-cancel fee applies close to tip-off.",
      [
        { text: "Keep game", style: "cancel" },
        {
          text: "Cancel game",
          style: "destructive",
          onPress: async () => {
            setBusyId("cancel");
            const result = await cancelGame(id, userId);
            setBusyId(null);
            if (result.error) Alert.alert("Not cancelled", result.error.message);
            else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await load();
            }
          },
        },
      ]
    );
  };

  /** One-way update to everyone confirmed on this game (they see it in their inbox). */
  const sendNote = async () => {
    if (!id || posting || note.trim().length === 0) return;
    setPosting(true);
    const result = await postCrewNote(id, note);
    setPosting(false);
    if (result.error) {
      Alert.alert("Not sent", result.error.message);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNote("");
    Alert.alert("Sent", "Everyone confirmed on this game will see your update.");
  };

  /** Private 1:1 thread with a referee on this game. */
  const messageRef = async (refId: string) => {
    if (busyId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setBusyId(`dm:${refId}`);
    const { conversationId, error: dmError } = await getOrCreateDM(session.user.id, refId);
    setBusyId(null);
    if (dmError || !conversationId) {
      Alert.alert("Couldn't open the conversation", dmError?.message ?? "Try again.");
      return;
    }
    router.push(`/(assignor)/conversation/${conversationId}` as any);
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

  if (loading) return <View className="flex-1 bg-paper items-center justify-center"><ActivityIndicator color={palette.signal} /></View>;
  if (!game) return <View className="flex-1 bg-paper items-center justify-center"><Text className="font-mono-bold text-ink">GAME NOT AVAILABLE</Text></View>;

  const assignedIds = new Set(crew.map((member) => member.ref_id));
  // Everyone on the roster can be offered a game — the availability switch on a
  // referee's profile only orders the list, it doesn't hide them from their own assignor.
  const available = roster
    .filter((member) => member.status === "accepted" && !assignedIds.has(member.ref_id))
    .sort((a, b) => Number(b.is_available) - Number(a.is_available));
  const mode = game.assignor_staffing_mode ?? "assignor_direct";
  const showAssignSelf =
    userId !== null &&
    canAssignMyself({ userId, roles, crewRefIds: crew.map((m) => m.ref_id), crewSize: game.crew_size });

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-3 flex-row items-center justify-between border-b border-ink">
        <BackButton onPress={() => router.back()} />
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
            <View className="flex-row gap-1.5 mb-5">
              {(["assignor_direct", "self_assign"] as const).map((value) => (
                <View key={value} style={{ flex: 1 }}>
                  <Chip
                    label={value === "assignor_direct" ? "Offer from roster" : "Roster self-claim"}
                    selected={mode === value}
                    disabled={busyId !== null}
                    onPress={() => void setMode(value)}
                  />
                </View>
              ))}
            </View>

            {mode === "self_assign" && (
              <View className="border border-signal bg-signal-tint px-4 py-3 mb-5">
                <Text className="font-mono text-[9px] text-ink uppercase" style={{ letterSpacing: 1 }}>
                  Accepted roster referees can claim this game until the crew is full. Conflicts and capacity are checked atomically.
                </Text>
              </View>
            )}

            <Text className="font-mono-bold text-[9px] text-ink uppercase mb-2" style={{ letterSpacing: 1.5 }}>ACTIVE CREW ({crew.length})</Text>
            {crew.length === 0 ? (
              <Text className="font-mono text-[9px] text-ink-60 uppercase py-3">No offers or accepted referees yet.</Text>
            ) : crew.map((member) => (
              <View key={member.id} className="rounded-lg border border-ink bg-chalk px-4 py-3 mb-2 flex-row items-center">
                <Tappable
                  accessibilityRole="button"
                  scaleTo={0.98}
                  wrapperStyle={{ flex: 1 }}
                  onPress={() => router.push(`/(assignor)/referee/${member.ref_id}` as any)}
                >
                  <Text className="font-mono-bold text-[10px] text-ink uppercase">{member.display_name}</Text>
                  <Text className="font-mono text-[8px] text-ink-60 uppercase mt-1">{member.role} · {member.status} · VIEW PROFILE</Text>
                </Tappable>
                <View className="mr-2">
                  <IconButton
                    accessibilityLabel={`Message ${member.display_name}`}
                    size={32}
                    disabled={busyId !== null}
                    onPress={() => void messageRef(member.ref_id)}
                    icon={(color) =>
                      busyId === `dm:${member.ref_id}` ? (
                        <ActivityIndicator size="small" color={color} />
                      ) : (
                        <Feather name="message-square" size={12} color={color} />
                      )
                    }
                  />
                </View>
                <Button
                  label="Remove"
                  variant="danger"
                  size="sm"
                  loading={busyId === member.id}
                  loadingLabel="Removing"
                  disabled={busyId !== null}
                  onPress={() => remove(member)}
                />
              </View>
            ))}

            {showAssignSelf && (
              <View className="rounded-lg border-[1.5px] border-signal bg-chalk px-4 py-3 mt-1 flex-row items-center">
                <View className="flex-1 pr-3">
                  <Text className="font-mono-bold text-[10px] text-ink uppercase">WORK THIS GAME YOURSELF</Text>
                  <Text className="font-mono text-[8px] text-ink-60 uppercase mt-1">You referee too · schedule conflicts are still checked</Text>
                </View>
                <Button
                  label="Assign myself"
                  size="sm"
                  loading={busyId === "self"}
                  loadingLabel="Assigning"
                  disabled={busyId !== null}
                  onPress={() => void assignSelf()}
                />
              </View>
            )}

            <Text className="font-mono-bold text-[9px] text-ink uppercase mt-5 mb-2" style={{ letterSpacing: 1.5 }}>MESSAGE THE CREW</Text>
            {/* Crew messages close 24 hours after the game (0077). */}
            {crewChatOpen(game) ? (
              <>
                <TextField
                  value={note}
                  style={{ minHeight: 70, textAlignVertical: "top" }}
                  onChangeText={setNote}
                  placeholder="A one-way update for everyone confirmed on this game"
                  multiline
                />
                <View className="mt-2">
                  <Button
                    label="Send update"
                    fullWidth
                    loading={posting}
                    loadingLabel="Sending"
                    disabled={note.trim().length === 0}
                    onPress={() => void sendNote()}
                  />
                </View>
              </>
            ) : (
              <Text className="font-mono text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 1 }}>
                Crew messages closed 24 hours after the game
              </Text>
            )}

            {mode === "assignor_direct" && <Text className="font-mono-bold text-[9px] text-ink uppercase mt-5 mb-2" style={{ letterSpacing: 1.5 }}>AVAILABLE ROSTER ({available.length})</Text>}
          </View>
        )}
        ListEmptyComponent={mode === "assignor_direct" ? (
          <Text className="font-mono text-[9px] text-ink-40 uppercase text-center py-8">No available accepted roster referees remain for this game.</Text>
        ) : null}
        ListFooterComponent={game.status !== "completed" && game.status !== "cancelled" ? (
          <View className="mt-6 gap-2">
            {new Date(game.starts_at).getTime() <= Date.now() && (
              <Button
                label="Mark game completed"
                variant="court"
                fullWidth
                loading={busyId === "complete"}
                loadingLabel="Completing"
                disabled={busyId !== null}
                onPress={markCompleted}
              />
            )}
            <Button
              label="Cancel game"
              variant="danger"
              fullWidth
              loading={busyId === "cancel"}
              loadingLabel="Cancelling"
              disabled={busyId !== null}
              onPress={cancel}
            />
          </View>
        ) : null}
        renderItem={({ item }) => (
          <View className="rounded-lg border border-ink bg-chalk px-4 py-3 mb-2 flex-row items-center">
            <Tappable
                  accessibilityRole="button"
                  scaleTo={0.98}
                  wrapperStyle={{ flex: 1 }}
                  onPress={() => router.push(`/(assignor)/referee/${item.ref_id}` as any)}
                >
              <Text className="font-mono-bold text-[10px] text-ink uppercase">{item.display_name}</Text>
              <Text className="font-mono text-[8px] text-ink-60 uppercase mt-1">{item.city}, {item.state} · {item.rating.toFixed(1)} RATING · VIEW PROFILE</Text>
            </Tappable>
            <Button
              label="Offer"
              size="sm"
              loading={busyId === item.ref_id}
              loadingLabel="Offering"
              disabled={busyId !== null || crew.length >= game.crew_size}
              onPress={() => void offer(item)}
            />
          </View>
        )}
      />
      {error && <Text className="text-foul-ink font-mono text-[10px] text-center px-5 mb-4 uppercase">{error}</Text>}
    </View>
  );
}
