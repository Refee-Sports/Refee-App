import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { sendRosterBlast } from "@/lib/assignor/queries";
import { BackButton } from "@/components/ui/Controls";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";

const MAX_LENGTH = 1000;

/** Message blast: one-way message to everyone on the roster. Referees see it in their inbox and can't reply. */
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
                `Your message blast went to ${recipientIds.length} ${recipientIds.length === 1 ? "referee" : "referees"}.`,
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
        <BackButton onPress={() => router.back()} />
        <Text className="font-mono-bold text-[9px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>
          SEND MESSAGE BLAST TO ROSTER
        </Text>
        <View className="w-9" />
      </View>

      <View className="flex-1 px-5 pt-5">
        <Text className="text-ink-80" style={{ fontSize: 14, lineHeight: 20 }}>
          Send a notification to every referee on your roster — a schedule change, a new tournament, a reminder.
          They&apos;ll see it in their inbox and can&apos;t reply.
        </Text>
        <View className="mt-4">
          <TextField
            value={body}
            style={{ minHeight: 160, textAlignVertical: "top", fontSize: 15 }}
            onChangeText={(t) => setBody(t.slice(0, MAX_LENGTH))}
            placeholder="What do your referees need to know?"
            multiline
            autoFocus
          />
        </View>
        <Text className="font-mono text-[9px] text-ink-60 text-right mt-1.5" style={{ letterSpacing: 1 }}>
          {body.length} / {MAX_LENGTH}
        </Text>
      </View>

      <View className="px-4 pt-3 border-t-[1.5px] border-ink bg-paper" style={{ paddingBottom: insets.bottom + 16 }}>
        <Button
          label="Send message blast"
          fullWidth
          loading={busy}
          loadingLabel="Sending"
          disabled={body.trim().length === 0}
          onPress={send}
        />
      </View>
    </View>
  );
}
