import { useCallback, useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import {
  fetchMessages,
  canSendInConversation,
  sendMessage,
  markRead,
  subscribeToConversation,
  type MessageRow,
} from "@/lib/messages/queries";

const TZ = "America/Chicago";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ,
  });
}

export function ChatThread({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<MessageRow>>(null);

  const [myId, setMyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [canSend, setCanSend] = useState(false);
  const [readOnlyReason, setReadOnlyReason] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { messages: msgs } = await fetchMessages(conversationId);
    setMessages(msgs);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    let uid: string | null = null;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      uid = session.user.id;
      setMyId(uid);
      const [, permission] = await Promise.all([
        load(),
        canSendInConversation(conversationId, uid),
      ]);
      setCanSend(permission.allowed);
      setReadOnlyReason(permission.readOnlyReason);
      await markRead(conversationId, uid);
    })();

    const channel = subscribeToConversation(conversationId, () => {
      void load();
      if (uid) void markRead(conversationId, uid);
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, load]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !myId || sending || !canSend) return;
    Haptics.selectionAsync();
    setSending(true);
    setDraft("");
    // optimistic append
    setMessages((m) => [
      ...m,
      {
        id: `local-${Date.now()}`,
        conversationId,
        senderId: myId,
        senderName: "You",
        body,
        createdAt: new Date().toISOString(),
      },
    ]);
    const { error } = await sendMessage(conversationId, myId, body);
    if (error) {
      await load(); // resync on failure
    }
    setSending(false);
  };

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-5 py-3 flex-row items-center gap-3 border-b border-ink-20">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70"
        >
          <Text className="text-ink font-mono-bold text-base">←</Text>
        </Pressable>
        <Text
          className="font-mono-bold text-[10px] text-ink uppercase flex-1"
          style={{ letterSpacing: 2 }}
        >
          MESSAGES
        </Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#1F4FCC" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, gap: 8 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const mine = item.senderId === myId;
              return (
                <View className={mine ? "items-end" : "items-start"}>
                  <View
                    className={`max-w-[80%] border px-3.5 py-2.5 ${
                      mine ? "bg-ink border-ink" : "bg-chalk border-ink-20"
                    }`}
                  >
                    {!mine && (
                      <Text
                        className="font-mono-bold text-[8px] text-signal uppercase mb-1"
                        style={{ letterSpacing: 1.5 }}
                      >
                        {item.senderName.toUpperCase()}
                      </Text>
                    )}
                    <Text
                      className={`font-mono text-[13px] ${mine ? "text-paper" : "text-ink"}`}
                      style={{ lineHeight: 19 }}
                    >
                      {item.body}
                    </Text>
                  </View>
                  <Text
                    className="font-mono text-[8px] text-ink-40 uppercase mt-1"
                    style={{ letterSpacing: 1 }}
                  >
                    {fmtTime(item.createdAt)}
                  </Text>
                </View>
              );
            }}
          />
        )}

        {canSend ? (
          <View
            className="border-t border-ink bg-chalk flex-row items-end px-4 py-3 gap-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="MESSAGE..."
              placeholderTextColor="rgba(8,17,28,0.36)"
              multiline
              className="flex-1 border border-ink bg-paper px-3 py-2.5 font-mono text-[13px] text-ink"
              style={{ maxHeight: 100, letterSpacing: 0.5 }}
            />
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim() || sending}
              className={`w-11 h-11 items-center justify-center border border-ink ${
                draft.trim() ? "bg-signal" : "bg-paper"
              } active:opacity-70`}
            >
              <Feather name="arrow-up" size={18} color={draft.trim() ? "#E5E1D6" : "rgba(8,17,28,0.36)"} />
            </Pressable>
          </View>
        ) : (
          <View
            className="border-t border-ink bg-hi-vis px-5 py-4"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <Text className="font-mono-bold text-[10px] text-ink uppercase" style={{ letterSpacing: 1.2 }}>
              READ-ONLY UPDATE
            </Text>
            <Text className="font-mono text-[10px] text-ink-60 mt-1" style={{ lineHeight: 15 }}>
              {readOnlyReason ?? "You can read this conversation, but cannot reply."}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
