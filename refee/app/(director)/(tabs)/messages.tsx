import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConversationList } from "@/components/messages/ConversationList";

export default function DirectorMessages() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View className="flex-1 bg-paper">
      <View style={{ height: insets.top }} />
      <View className="px-5 pt-4 pb-3">
        <Text
          className="text-ink font-display"
          style={{ fontSize: 26, lineHeight: 26, letterSpacing: -1 }}
        >
          MESSAGES
        </Text>
      </View>
      <ConversationList
        onOpen={(id) => router.push(`/(director)/conversation/${id}` as any)}
      />
    </View>
  );
}
