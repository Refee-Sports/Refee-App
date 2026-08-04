import { useCallback, useEffect, useState } from "react";
import { Text, View, Pressable, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { fetchConversations, type ConversationRow } from "@/lib/messages/queries";

const TZ = "America/Chicago";

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ }).toUpperCase();
}

export function ConversationList({
  onOpen,
}: {
  onOpen: (conversationId: string) => void;
}) {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { conversations: convos } = await fetchConversations(session.user.id);
    setConversations(convos);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#1F4FCC" />
      </View>
    );
  }

  if (conversations.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text
          className="font-mono text-ink-40 text-[11px] uppercase text-center"
          style={{ letterSpacing: 1 }}
        >
          No messages yet.{"\n"}Threads appear here once you're on a crew or a director messages you.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(c) => c.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#1F4FCC" />
      }
      contentContainerStyle={{ paddingBottom: 40 }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onOpen(item.id);
          }}
          className="mx-5 mb-2 border border-ink bg-chalk px-4 py-3.5 active:opacity-75"
        >
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-row items-center gap-2 flex-1 pr-2">
              {item.unread && <View className="w-2 h-2 bg-signal" />}
              <Text
                className={`text-[12px] text-ink uppercase flex-1 ${item.unread ? "font-mono-bold" : "font-mono"}`}
                style={{ letterSpacing: 0.5 }}
                numberOfLines={1}
              >
                {item.title}
              </Text>
            </View>
            <Text className="font-mono text-[9px] text-ink-40 uppercase" style={{ letterSpacing: 1 }}>
              {fmtWhen(item.lastMessageAt)}
            </Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text
              className="font-mono text-[10px] text-ink-60 flex-1 pr-2"
              numberOfLines={1}
            >
              {item.lastMessageBody ?? "No messages yet"}
            </Text>
            {item.kind === "game_crew" && (
              <Text className="font-mono-bold text-[8px] text-signal uppercase" style={{ letterSpacing: 1 }}>
                CREW · {item.participantCount}
              </Text>
            )}
          </View>
        </Pressable>
      )}
    />
  );
}
