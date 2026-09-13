import { Text, View } from "react-native";
import { ReactNode } from "react";

type Props = {
  left: ReactNode;
  right?: ReactNode;
};

/**
 * The mono telemetry strip that sits below the app header.
 * "14 NEW · 3 INVITED" / "RADIUS 25 MI" — readout style.
 */
export function Telemetry({ left, right }: Props) {
  return (
    <View className="px-5 pb-3 flex-row justify-between">
      <Text
        className="text-ink-60 font-mono text-[9px] uppercase"
        style={{ letterSpacing: 1.5 }}
      >
        {left}
      </Text>
      {right ? (
        <Text
          className="text-ink-60 font-mono text-[9px] uppercase"
          style={{ letterSpacing: 1.5 }}
        >
          {right}
        </Text>
      ) : null}
    </View>
  );
}
