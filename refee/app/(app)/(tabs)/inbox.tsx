import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Inbox() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-paper">
      <View style={{ height: insets.top }} />
      <View className="flex-1 px-5 pt-4">
        <Text
          className="text-ink font-display"
          style={{ fontSize: 26, lineHeight: 26, letterSpacing: -1 }}
        >
          INBOX
        </Text>
        <Text className="text-ink-60 mt-6 font-mono text-xs uppercase">
          [ Coming next: messages from organizers + system notifications ]
        </Text>
      </View>
    </View>
  );
}
