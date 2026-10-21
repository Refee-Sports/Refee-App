import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { cancelTournament } from "@/lib/director/queries";

/**
 * Cancels every game still open in an event (rain-out, venue lost), then the
 * event. Shared by the director's and the assignor's tournament screens.
 */
export function CancelTournamentButton({
  tournamentId,
  userId,
  status,
  onCancelled,
}: {
  tournamentId: string;
  userId: string | null;
  status: string;
  onCancelled: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (status === "cancelled" || status === "completed" || !userId) return null;

  const confirm = () => {
    Alert.alert(
      "Cancel the whole event?",
      "Every game that hasn't been played is cancelled, and its referees and applicants are told. Games already played stay completed. Late-cancel fees apply per game as usual.",
      [
        { text: "Keep event", style: "cancel" },
        {
          text: "Cancel event",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            const { error, gamesCancelled } = await cancelTournament(tournamentId, userId);
            setBusy(false);
            if (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Could not cancel the event", error.message);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(
              "Event cancelled",
              gamesCancelled === 1 ? "1 game was cancelled." : `${gamesCancelled} games were cancelled.`
            );
            onCancelled();
          },
        },
      ]
    );
  };

  return (
    <View className="mt-6 mb-4">
      <Pressable
        onPress={confirm}
        disabled={busy}
        className="border-[1.5px] border-foul py-3.5 items-center active:opacity-80 disabled:opacity-40"
      >
        {busy ? (
          <ActivityIndicator color="#E63946" />
        ) : (
          <Text className="text-foul-ink font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 1.5 }}>
            CANCEL ENTIRE EVENT
          </Text>
        )}
      </Pressable>
    </View>
  );
}
