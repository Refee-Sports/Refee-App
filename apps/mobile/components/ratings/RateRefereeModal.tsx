import { useState } from "react";
import { Text, View, Modal } from "react-native";
import * as Haptics from "expo-haptics";
import type { CategoryRatings } from "@/lib/director/queries";
import { palette } from "@refee/design";
import { TextField } from "@/components/ui/TextField";
import { IconButton } from "@/components/ui/Controls";
import { Chip } from "@/components/ui/Choice";
import { Button } from "@/components/ui/Button";
import { Feather } from "@expo/vector-icons";

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
      <View className="flex-1 justify-end" style={{ backgroundColor: palette.ink60 }}>
        <View className="bg-paper border-t-2 border-ink px-5 pt-5 pb-10">
          <View className="flex-row items-center justify-between mb-1">
            <Text
              className="font-mono-bold text-[10px] text-ink-60 uppercase"
              style={{ letterSpacing: 2 }}
            >
              RATE REFEREE
            </Text>
            <IconButton
              accessibilityLabel="Close"
              onPress={onClose}
              icon={(color) => <Feather name="x" size={16} color={color} />}
            />
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
                    <Chip key={n} label={String(n)} selected={active} onPress={() => setScore(cat.key, n)} accessibilityLabel={`${cat.label} ${n} of 5`} />
                  );
                })}
              </View>
            </View>
          ))}

          <View className="mb-4">
            <TextField
              value={comment}
              style={{ minHeight: 60 }}
              onChangeText={setComment}
              placeholder="OPTIONAL COMMENT..."
              multiline
            />
          </View>

          <Button
            label="Submit rating"
            fullWidth
            loading={submitting}
            loadingLabel="Submitting"
            disabled={!complete}
            onPress={() => onSubmit(scores, comment)}
          />
        </View>
      </View>
    </Modal>
  );
}
