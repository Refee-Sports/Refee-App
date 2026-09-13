import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Wordmark } from "@/components/ui/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { supabase } from "@/lib/supabase";
import {
  fetchMyRoster,
  inviteToRoster,
  removeFromRoster,
  searchReferees,
  type RefSearchResult,
  type RosterMemberRow,
} from "@/lib/assignor/queries";

export default function AssignorRoster() {
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<RosterMemberRow[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RefSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
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
    setUserId(session.user.id);
    const result = await fetchMyRoster(session.user.id);
    setMembers(result.members);
    setError(result.error?.message ?? null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    if (!userId || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      void searchReferees(query, userId).then((result) => {
        if (cancelled) return;
        const existing = new Set(members.filter((m) => m.status !== "removed").map((m) => m.ref_id));
        setResults(result.results.filter((ref) => !existing.has(ref.id)));
        setError(result.error?.message ?? null);
        setSearching(false);
      });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [members, query, userId]);

  const invite = async (ref: RefSearchResult) => {
    if (!userId || busyId) return;
    Haptics.selectionAsync();
    setBusyId(ref.id);
    const result = await inviteToRoster(userId, ref.id);
    setBusyId(null);
    if (result.error) {
      Alert.alert("Invite not sent", result.error.message);
      return;
    }
    setQuery("");
    setResults([]);
    await load();
  };

  const confirmRemove = (member: RosterMemberRow) => {
    Alert.alert("Remove from roster?", `${member.display_name} will no longer be eligible for new assignments from you.`, [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setBusyId(member.roster_id);
          void removeFromRoster(member.roster_id).then(async (result) => {
            setBusyId(null);
            if (result.error) Alert.alert("Could not remove referee", result.error.message);
            else await load();
          });
        },
      },
    ]);
  };

  const visibleMembers = members.filter((member) => member.status !== "removed");

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <View className="px-5 pt-1 pb-3 flex-row items-center justify-between">
        <Wordmark size={26} />
        <Text className="font-mono-bold text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 1.5 }}>
          {visibleMembers.filter((m) => m.status === "accepted").length} ACTIVE
        </Text>
      </View>
      <View className="px-5 pb-1.5">
        <Text className="font-mono text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 2 }}>
          <Text className="font-mono-bold text-ink">MY ROSTER</Text>{` · ${visibleMembers.length} TOTAL`}
        </Text>
      </View>
      <View className="px-5 mb-4"><ZebraRule variant="signal" thin /></View>

      <View className="mx-5 mb-3 border border-ink bg-chalk flex-row items-center px-3">
        <Feather name="search" size={14} color="rgba(8,17,28,0.5)" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="SEARCH REFEREES BY NAME OR CITY"
          placeholderTextColor="rgba(8,17,28,0.35)"
          autoCapitalize="words"
          className="flex-1 py-3 px-2 font-mono text-[10px] text-ink"
        />
        {searching && <ActivityIndicator size="small" color="#1F4FCC" />}
      </View>

      {query.trim().length >= 2 ? (
        <FlatList
          data={results}
          keyExtractor={(ref) => ref.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 90 }}
          ListEmptyComponent={!searching ? (
            <Text className="font-mono text-[9px] text-ink-40 uppercase text-center py-10" style={{ letterSpacing: 1 }}>
              No eligible referees found. Email/SMS invitations for people without accounts are still being built.
            </Text>
          ) : null}
          renderItem={({ item }) => (
            <PersonRow
              name={item.display_name}
              meta={`${item.city}, ${item.state} · ${item.rating.toFixed(1)} RATING`}
              action="INVITE"
              busy={busyId === item.id}
              onPress={() => void invite(item)}
            />
          )}
        />
      ) : loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#1F4FCC" /></View>
      ) : (
        <FlatList
          data={visibleMembers}
          keyExtractor={(member) => member.roster_id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#1F4FCC" />}
          ListEmptyComponent={(
            <Text className="font-mono text-[9px] text-ink-40 uppercase text-center py-16" style={{ letterSpacing: 1 }}>
              Search above to invite referees already on Refee.
            </Text>
          )}
          renderItem={({ item }) => (
            <PersonRow
              name={item.display_name}
              meta={`${item.city}, ${item.state} · ${item.status}`}
              action="REMOVE"
              destructive
              busy={busyId === item.roster_id}
              onPress={() => confirmRemove(item)}
            />
          )}
        />
      )}
      {error && <Text className="text-foul font-mono text-[10px] text-center px-5 mb-4 uppercase">{error}</Text>}
    </View>
  );
}

function PersonRow({
  name,
  meta,
  action,
  busy,
  destructive = false,
  onPress,
}: {
  name: string;
  meta: string;
  action: string;
  busy: boolean;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <View className="border border-ink bg-chalk px-4 py-3 mb-2 flex-row items-center">
      <View className="w-9 h-9 bg-ink items-center justify-center mr-3">
        <Text className="text-paper font-mono-bold text-[10px]">{name.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View className="flex-1 pr-2">
        <Text className="font-mono-bold text-[11px] text-ink uppercase" numberOfLines={1}>{name}</Text>
        <Text className="font-mono text-[8px] text-ink-40 uppercase mt-1" style={{ letterSpacing: 0.8 }} numberOfLines={1}>{meta}</Text>
      </View>
      <Pressable disabled={busy} onPress={onPress} className={`border px-2.5 py-2 active:opacity-70 ${destructive ? "border-foul" : "border-ink bg-ink"}`}>
        {busy ? <ActivityIndicator size="small" color={destructive ? "#E53E3E" : "#E5E1D6"} /> : (
          <Text className={`font-mono-bold text-[8px] ${destructive ? "text-foul" : "text-paper"}`} style={{ letterSpacing: 1 }}>{action}</Text>
        )}
      </Pressable>
    </View>
  );
}
