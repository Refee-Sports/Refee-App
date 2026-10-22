import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BackButton, IconButton } from "@/components/ui/Controls";

type Props = {
  jobCode: string;
  onBack: () => void;
};

export function JobDetailHeader({ jobCode, onBack }: Props) {
  return (
    <View className="flex-row items-center justify-between px-5 py-1">
      <BackButton onPress={onBack} />
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
        <IconButton accessibilityLabel="Save game" onPress={() => {}} icon={(c) => <Feather name="bookmark" size={14} color={c} />} />
        <IconButton accessibilityLabel="Share game" onPress={() => {}} icon={(c) => <Feather name="share-2" size={14} color={c} />} />
      </View>
    </View>
  );
}
