import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import {
  extractRosterCode,
  fetchMyRosterInvites,
  fetchMyRosters,
  leaveRoster,
  respondToRosterInvite,
  type MyRosterRow,
  type RosterInviteRow,
} from "@/lib/assignor/queries";

/**
 * Every roster (organization) this referee is on. A referee can be on any
 * number of them; each one is an assignor who can offer them games.
 */
export default function MyOrganizations() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rosters, setRosters] = useState<MyRosterRow[]>([]);
  const [invites, setInvites] = useState<RosterInviteRow[]>([]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const [mine, pending] = await Promise.all([
      fetchMyRosters(session.user.id),
      fetchMyRosterInvites(session.user.id),
    ]);
    setRosters(mine.rosters);
    setInvites(pending.invites);
    setError(mine.error?.message ?? pending.error?.message ?? null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const respond = async (invite: RosterInviteRow, accept: boolean) => {
    if (busyId) return;
    Haptics.selectionAsync();
    setBusyId(invite.roster_id);
    const { error: e } = await respondToRosterInvite(invite.roster_id, accept);
    setBusyId(null);
    if (e) Alert.alert("Couldn't update the invite", e.message);
    else await load();
  };

  const leave = (roster: MyRosterRow) => {
    Alert.alert(
      `Leave ${roster.assignor_name}'s roster?`,
      "You'll stop seeing their games and announcements. Games you've already accepted stay on your schedule.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => {
            setBusyId(roster.roster_id);
            void leaveRoster(roster.roster_id).then(async ({ error: e }) => {
              setBusyId(null);
              if (e) Alert.alert("Couldn't leave", e.message);
              else await load();
            });
          },
        },
      ]
    );
  };

  const joinWithCode = () => {
    const parsed = extractRosterCode(code);
    if (!parsed) {
      Alert.alert("That doesn't look like a roster code", "Codes are 8 letters and numbers, like K7M2QX9A.");
      return;
    }
    setCode("");
    router.push(`/join/${parsed}` as any);
  };

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-3 flex-row items-center justify-between border-b border-ink">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 border border-ink items-center justify-center active:opacity-70"
        >
          <Feather name="arrow-left" size={16} color="#08111C" />
        </Pressable>
        <Text className="font-mono-bold text-[9px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>
          MY ORGANIZATIONS
        </Text>
        <View className="w-9" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#1F4FCC" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#1F4FCC" />}
          keyboardShouldPersistTaps="handled"
        >
          {invites.length > 0 ? (
            <>
              <Text className="font-mono-bold text-[9px] text-ink uppercase mb-2" style={{ letterSpacing: 1.5 }}>
                INVITATIONS ({invites.length})
              </Text>
              {invites.map((invite) => (
                <View key={invite.roster_id} className="border border-signal bg-signal/5 px-4 py-3 mb-2">
                  <Text className="font-mono-bold text-[11px] text-ink uppercase">{invite.assignor_name}</Text>
                  <Text className="font-mono text-[9px] text-ink-60 uppercase mt-0.5" style={{ letterSpacing: 1 }}>
                    INVITES YOU TO THEIR ROSTER{invite.assignor_city ? ` · ${invite.assignor_city}, ${invite.assignor_state}` : ""}
                  </Text>
                  <View className="flex-row gap-2 mt-3">
                    <Pressable
                      disabled={busyId !== null}
                      onPress={() => void respond(invite, true)}
                      className="flex-1 bg-ink py-2.5 items-center active:opacity-80"
                    >
                      {busyId === invite.roster_id ? <ActivityIndicator size="small" color="#E5E1D6" /> : (
                        <Text className="text-paper font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 1.5 }}>JOIN</Text>
                      )}
                    </Pressable>
                    <Pressable
                      disabled={busyId !== null}
                      onPress={() => void respond(invite, false)}
                      className="flex-1 border border-ink py-2.5 items-center active:opacity-70"
                    >
                      <Text className="text-ink font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 1.5 }}>DECLINE</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          ) : null}

          <Text className="font-mono-bold text-[9px] text-ink uppercase mt-4 mb-2" style={{ letterSpacing: 1.5 }}>
            YOU&apos;RE ON {rosters.length} {rosters.length === 1 ? "ROSTER" : "ROSTERS"}
          </Text>
          {rosters.length === 0 ? (
            <View className="border border-dashed border-ink-20 px-5 py-6">
              <Text className="text-ink-40 font-mono text-[10px] uppercase text-center" style={{ letterSpacing: 1.2, lineHeight: 15 }}>
                You&apos;re not on any assignor&apos;s roster yet. Ask an assignor for their QR code or invite code.
              </Text>
            </View>
          ) : (
            rosters.map((roster) => (
              <View key={roster.roster_id} className="border border-ink bg-chalk px-4 py-3 mb-2 flex-row items-center">
                <View className="w-9 h-9 bg-ink items-center justify-center mr-3">
                  <Text className="text-paper font-mono-bold text-[10px]">{roster.assignor_name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View className="flex-1 pr-2">
                  <Text className="font-mono-bold text-[11px] text-ink uppercase" numberOfLines={1}>{roster.assignor_name}</Text>
                  <Text className="font-mono text-[8px] text-ink-40 uppercase mt-1" style={{ letterSpacing: 0.8 }} numberOfLines={1}>
                    {roster.assignor_city ? `${roster.assignor_city}, ${roster.assignor_state} · ` : ""}
                    {roster.joined_at ? `JOINED ${new Date(roster.joined_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()}` : "ON ROSTER"}
                  </Text>
                </View>
                <Pressable
                  disabled={busyId !== null}
                  onPress={() => leave(roster)}
                  className="border border-foul px-2.5 py-2 active:opacity-70"
                >
                  {busyId === roster.roster_id ? <ActivityIndicator size="small" color="#E53E3E" /> : (
                    <Text className="font-mono-bold text-[8px] text-foul" style={{ letterSpacing: 1 }}>LEAVE</Text>
                  )}
                </Pressable>
              </View>
            ))
          )}

          <Text className="font-mono-bold text-[9px] text-ink uppercase mt-6 mb-2" style={{ letterSpacing: 1.5 }}>
            JOIN WITH A CODE
          </Text>
          <View className="flex-row gap-2">
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="ROSTER CODE"
              placeholderTextColor="rgba(8,17,28,0.35)"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={40}
              className="flex-1 border border-ink bg-chalk px-3 py-3 font-mono-bold text-[13px] text-ink"
              style={{ letterSpacing: 3 }}
            />
            <Pressable
              onPress={joinWithCode}
              disabled={code.trim().length < 6}
              className={`px-5 justify-center ${code.trim().length >= 6 ? "bg-ink" : "bg-ink-20"}`}
            >
              <Text className={`font-mono-bold text-[10px] uppercase ${code.trim().length >= 6 ? "text-paper" : "text-ink-40"}`} style={{ letterSpacing: 1.5 }}>
                NEXT
              </Text>
            </Pressable>
          </View>
          <Text className="font-mono text-[9px] text-ink-60 uppercase mt-2" style={{ letterSpacing: 1 }}>
            Scanned a QR code with your camera? It opens Refee here automatically.
          </Text>

          {error ? <Text className="text-foul font-mono text-[10px] uppercase mt-4">{error}</Text> : null}
        </ScrollView>
      )}
    </View>
  );
}
