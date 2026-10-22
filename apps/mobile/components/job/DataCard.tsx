import { View, Text } from "react-native";
import type { ReactNode } from "react";

type Props = {
  tab: string;
  children: ReactNode;
  className?: string;
};

/** A labelled card. The label sits above the card, so rounded corners and
 *  cards that clip their content (the map) both keep it visible. */
export function DataCard({ tab, children, className = "" }: Props) {
  return (
    <View className="mb-3">
      <Text
        className="text-ink-60 font-mono-bold text-[9px] uppercase mb-1.5 ml-1"
        style={{ letterSpacing: 1.8 }}
      >
        {tab}
      </Text>
      <View className={`rounded-lg border border-ink bg-chalk ${className}`}>{children}</View>
    </View>
  );
}
