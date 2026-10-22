import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
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
import { palette } from "@refee/design";
import { BackButton , IconButton } from "@/components/ui/Controls";
import { TextField } from "@/components/ui/TextField";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
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
        <BackButton onPress={() => router.back()} />
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
            <ActivityIndicator color={palette.signal} />
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
            <View className="flex-1">
              <TextField
                value={draft}
                style={{ maxHeight: 100, paddingVertical: 10 }}
                onChangeText={setDraft}
                placeholder="MESSAGE..."
                multiline
              />
            </View>
            <IconButton
              accessibilityLabel="Send message"
              size={44}
              active={!!draft.trim()}
              disabled={!draft.trim() || sending}
              onPress={handleSend}
              icon={(color) => <Feather name="arrow-up" size={18} color={color} />}
            />
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
