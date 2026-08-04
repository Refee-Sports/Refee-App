import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

type Props = {
  jobCode: string;
  onBack: () => void;
};

export function JobDetailHeader({ jobCode, onBack }: Props) {
  return (
    <View className="flex-row items-center justify-between px-5 py-1">
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onBack();
        }}
        className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70"
      >
        <Feather name="chevron-left" size={20} color="#08111C" />
      </Pressable>
      <View className="items-center flex-1 px-2">
        <Text
          className="text-ink-60 font-mono-bold text-[9px] uppercase"
          style={{ letterSpacing: 1.8 }}
        >
          JOB DETAIL
        </Text>
        <Text
          className="text-ink font-mono-bold text-[11px] uppercase mt-0.5"
          style={{ letterSpacing: 1 }}
        >
          JOB{jobCode}
        </Text>
      </View>
      <View className="flex-row gap-1.5">
        <Pressable
          onPress={() => Haptics.selectionAsync()}
          className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70"
        >
          <Feather name="bookmark" size={14} color="#08111C" />
        </Pressable>
        <Pressable
          onPress={() => Haptics.selectionAsync()}
          className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70"
        >
          <Feather name="share-2" size={14} color="#08111C" />
        </Pressable>
      </View>
    </View>
  );
}
