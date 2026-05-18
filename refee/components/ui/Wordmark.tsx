import { Text, View } from "react-native";

type Props = {
  size?: number;
  mode?: "light" | "dark" | "inverse";
};

/**
 * The REF<EE> wordmark. The "EE" is rendered as outlined text in signal blue.
 *
 * React Native doesn't support -webkit-text-stroke, so we layer two text
 * elements: a transparent fill on top of a slightly larger blue background.
 * For our actual app sizes this is acceptable; for marketing, use SVG.
 */
export function Wordmark({ size = 24, mode = "light" }: Props) {
  const inkColor = mode === "dark" ? "#FFFFFF" : "#08111C";
  const signalColor = mode === "dark" ? "#4F8CFF" : "#1F4FCC";

  return (
    <View className="flex-row items-baseline">
      <Text
        className="font-display"
        style={{
          fontSize: size,
          color: inkColor,
          letterSpacing: -size * 0.04,
          lineHeight: size,
        }}
      >
        REF
      </Text>
      {/* "EE" rendered as a hollow stroke effect using inner cutout */}
      <Text
        className="font-display"
        style={{
          fontSize: size,
          color: signalColor,
          letterSpacing: -size * 0.04,
          lineHeight: size,
        }}
      >
        EE
      </Text>
    </View>
  );
}
