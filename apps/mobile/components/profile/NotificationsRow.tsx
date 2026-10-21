import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { palette } from "@refee/design";

/** The row on every profile that opens the notification switches. */
export function NotificationsRow() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        router.push("/notifications" as any);
      }}
      className="border border-ink bg-chalk px-4 py-3.5 flex-row items-center justify-between active:opacity-70"
    >
      <View>
        <Text className="text-ink font-mono-bold text-[11px] uppercase" style={{ letterSpacing: 1.5 }}>
          NOTIFICATIONS
        </Text>
        <Text className="text-ink-60 font-mono text-[9px] uppercase mt-0.5" style={{ letterSpacing: 1 }}>
          CHOOSE WHAT WE PUSH TO YOUR PHONE
        </Text>
      </View>
      <Feather name="chevron-right" size={16} color={palette.ink} />
    </Pressable>
  );
}
