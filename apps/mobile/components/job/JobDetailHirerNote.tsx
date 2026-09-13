import { Text, View } from "react-native";

type Props = {
  note: string;
};

export function JobDetailHirerNote({ note }: Props) {
  return (
    <View className="mb-4 border-l-[3px] border-signal bg-signal/10 px-3.5 py-4">
      <Text
        className="text-signal font-mono-bold text-[9px] uppercase mb-2"
        style={{ letterSpacing: 1.8 }}
      >
        ▸ NOTE FROM ORGANIZER
      </Text>
      <Text className="text-ink text-[13px]" style={{ lineHeight: 19 }}>
        {note}
      </Text>
    </View>
  );
}
