import { useState } from "react";
import { Text, View, Pressable, Modal, TextInput, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import type { CategoryRatings } from "@/lib/director/queries";

const CATEGORIES: { key: keyof CategoryRatings; label: string; hint: string }[] = [
  { key: "onTime", label: "ON TIME", hint: "Arrived ready before tip-off?" },
  { key: "professionalism", label: "PROFESSIONALISM", hint: "Uniform, conduct, communication" },
  { key: "gameManagement", label: "GAME MANAGEMENT", hint: "Kept the game under control?" },
];

export function RateRefereeModal({
  visible,
  refName,
  submitting,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  refName: string;
  submitting: boolean;
  onSubmit: (scores: CategoryRatings, comment: string) => void;
  onClose: () => void;
}) {
  const [scores, setScores] = useState<CategoryRatings>({
    onTime: 0,
    professionalism: 0,
    gameManagement: 0,
  });
  const [comment, setComment] = useState("");

  const complete = scores.onTime > 0 && scores.professionalism > 0 && scores.gameManagement > 0;

  const setScore = (key: keyof CategoryRatings, value: number) => {
    Haptics.selectionAsync();
    setScores((s) => ({ ...s, [key]: value }));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(8,17,28,0.5)" }}>
        <View className="bg-paper border-t-2 border-ink px-5 pt-5 pb-10">
          <View className="flex-row items-center justify-between mb-1">
            <Text
              className="font-mono-bold text-[10px] text-ink-60 uppercase"
              style={{ letterSpacing: 2 }}
            >
              RATE REFEREE
            </Text>
            <Pressable onPress={onClose} className="active:opacity-70 p-1">
              <Text className="text-ink font-mono-bold text-base">✕</Text>
            </Pressable>
          </View>
          <Text
            className="font-display text-ink uppercase mb-5"
            style={{ fontSize: 24, letterSpacing: -1 }}
          >
            {refName.toUpperCase()}
          </Text>

          {CATEGORIES.map((cat) => (
            <View key={cat.key} className="mb-4">
              <Text
                className="font-mono-bold text-[10px] text-ink uppercase"
                style={{ letterSpacing: 2 }}
              >
                {cat.label}
              </Text>
              <Text className="font-mono text-[9px] text-ink-40 uppercase mb-2" style={{ letterSpacing: 1 }}>
                {cat.hint}
              </Text>
              <View className="flex-row gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = scores[cat.key] >= n;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setScore(cat.key, n)}
                      className={`flex-1 py-3 items-center border ${
                        active ? "bg-ink border-ink" : "bg-chalk border-ink-20"
                      } active:opacity-70`}
                    >
                      <Text
                        className={`font-display ${active ? "text-hi-vis" : "text-ink-40"}`}
                        style={{ fontSize: 16 }}
                      >
                        {n}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="OPTIONAL COMMENT..."
            placeholderTextColor="rgba(8,17,28,0.36)"
            multiline
            className="border border-ink-20 bg-chalk px-3 py-2.5 font-mono text-[12px] text-ink mb-4"
            style={{ minHeight: 60, letterSpacing: 0.5 }}
          />

          <Pressable
            onPress={() => complete && onSubmit(scores, comment)}
            disabled={!complete || submitting}
            className={`py-4 items-center border border-ink ${
              complete ? "bg-signal" : "bg-chalk"
            } active:opacity-70`}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#E5E1D6" />
            ) : (
              <Text
                className={`font-mono-bold text-[11px] uppercase ${
                  complete ? "text-paper" : "text-ink-40"
                }`}
                style={{ letterSpacing: 2 }}
              >
                SUBMIT RATING
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
