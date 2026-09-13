import { View, Text } from "react-native";
import type { ReactNode } from "react";

type Props = {
  tab: string;
  children: ReactNode;
  className?: string;
};

export function DataCard({ tab, children, className = "" }: Props) {
  return (
    <View className={`border border-ink bg-chalk mb-3 relative mt-2 ${className}`}>
      <View
        className="absolute -top-2.5 left-3 bg-paper px-1.5 z-10"
        style={{ paddingHorizontal: 6 }}
      >
        <Text
          className="text-ink font-mono-bold text-[8px] uppercase"
          style={{ letterSpacing: 1.8 }}
        >
          {tab}
        </Text>
      </View>
      {children}
    </View>
  );
}
