import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { sendRosterBlast } from "@/lib/assignor/queries";

const MAX_LENGTH = 1000;

/** One-way announcement to everyone on the roster. Referees see it in their inbox and can't reply. */
export default function AnnounceToRoster() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const canSend = body.trim().length > 0 && !busy;

  const send = () => {
    if (!canSend) return;
    Alert.alert(
      "Send to your whole roster?",
      "Every referee on your roster gets this as a notification. They can read it but can't reply — they'd message you directly.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: () => {
            void (async () => {
              setBusy(true);
              const { recipientIds, error } = await sendRosterBlast(body);
              setBusy(false);
              if (error) {
                Alert.alert("Not sent", error.message);
                return;
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                "Sent",
                `Your announcement went to ${recipientIds.length} ${recipientIds.length === 1 ? "referee" : "referees"}.`,
                [{ text: "Done", onPress: () => router.back() }]
              );
            })();
          },
        },
      ]
    );
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
          ANNOUNCE TO ROSTER
        </Text>
        <View className="w-9" />
      </View>

      <View className="flex-1 px-5 pt-5">
        <Text className="text-ink-80" style={{ fontSize: 14, lineHeight: 20 }}>
          Send a notification to every referee on your roster — a schedule change, a new tournament, a reminder.
          They&apos;ll see it in their inbox and can&apos;t reply.
        </Text>
        <TextInput
          value={body}
          onChangeText={(t) => setBody(t.slice(0, MAX_LENGTH))}
          placeholder="What do your referees need to know?"
          placeholderTextColor="rgba(8,17,28,0.35)"
          multiline
          autoFocus
          className="border border-ink bg-chalk px-3 py-3 mt-4 text-ink"
          style={{ minHeight: 160, textAlignVertical: "top", fontSize: 15 }}
        />
        <Text className="font-mono text-[9px] text-ink-60 text-right mt-1.5" style={{ letterSpacing: 1 }}>
          {body.length} / {MAX_LENGTH}
        </Text>
      </View>

      <View className="px-4 pt-3 border-t-[1.5px] border-ink bg-paper" style={{ paddingBottom: insets.bottom + 16 }}>
        <Pressable
          onPress={send}
          disabled={!canSend}
          className={`py-4 items-center ${canSend ? "bg-ink" : "bg-ink-20"} active:opacity-80`}
        >
          {busy ? (
            <ActivityIndicator color="#E5E1D6" />
          ) : (
            <Text
              className={`font-mono-bold ${canSend ? "text-paper" : "text-ink-40"}`}
              style={{ fontSize: 12, letterSpacing: 2.5 }}
            >
              SEND ANNOUNCEMENT
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
