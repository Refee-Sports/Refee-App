import { useState } from "react";
import { ActivityIndicator, Alert, Image, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { pickHeadshot, type PickedHeadshot } from "@/lib/profile/avatar";
import { palette } from "@refee/design";

/**
 * The sign-up step that asks for a headshot. Continuing is blocked by the
 * parent until `photo` is set, and the database refuses a new profile without
 * one — so this is a real requirement, not a suggestion.
 */
export function HeadshotStep({
  photo,
  onChange,
  who = "organizers and officials",
}: {
  photo: PickedHeadshot | null;
  onChange: (photo: PickedHeadshot) => void;
  /** Who will see the photo, for the explanatory line. */
  who?: string;
}) {
  const [busy, setBusy] = useState(false);

  const choose = async (source: "camera" | "library") => {
    if (busy) return;
    Haptics.selectionAsync();
    setBusy(true);
    const { photo: picked, error, cancelled } = await pickHeadshot(source);
    setBusy(false);
    if (cancelled) return;
    if (error) {
      Alert.alert("Couldn't get your photo", error.message);
      return;
    }
    if (picked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onChange(picked);
    }
  };

  return (
    <View>
      <Text className="text-ink font-display" style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1.5 }}>
        ADD YOUR{"\n"}
        <Text className="text-signal">HEADSHOT.</Text>
      </Text>
      <Text className="text-ink-80 mt-3 mb-6" style={{ fontSize: 14, lineHeight: 20 }}>
        A headshot is required to join Refee. {who[0].toUpperCase() + who.slice(1)} see it on your
        profile, so use a clear, recent photo of your face — no logos, sunglasses or group shots.
      </Text>

      <View className="items-center mb-6">
        <View
          className={`w-44 h-44 items-center justify-center overflow-hidden bg-chalk ${
            photo ? "border-2 border-ink" : "border-2 border-dashed border-ink-40"
          }`}
        >
          {busy ? (
            <ActivityIndicator color={palette.signal} />
          ) : photo ? (
            <Image source={{ uri: photo.uri }} style={{ width: 176, height: 176 }} resizeMode="cover" />
          ) : (
            <Feather name="user" size={56} color={palette.ink20} />
          )}
        </View>
        {photo ? (
          <Text className="text-court-ink font-mono-bold text-[10px] uppercase mt-3" style={{ letterSpacing: 1.5 }}>
            ✓ LOOKS GOOD
          </Text>
        ) : (
          <Text className="text-foul-ink font-mono-bold text-[10px] uppercase mt-3" style={{ letterSpacing: 1.5 }}>
            PHOTO REQUIRED TO CONTINUE
          </Text>
        )}
      </View>

      <View className="flex-row gap-3">
        <View style={{ flex: 1 }}>
          <Button
            label={photo ? "Retake" : "Take photo"}
            icon={<Feather name="camera" size={14} color={palette.paper} />}
            fullWidth
            disabled={busy}
            onPress={() => void choose("camera")}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Choose"
            variant="secondary"
            icon={<Feather name="image" size={14} color={palette.ink} />}
            fullWidth
            disabled={busy}
            onPress={() => void choose("library")}
          />
        </View>
      </View>
    </View>
  );
}
