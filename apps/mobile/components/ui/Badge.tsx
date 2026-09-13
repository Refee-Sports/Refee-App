import { Text, View } from "react-native";
import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

type Variant = "live" | "confirmed" | "signal" | "warn" | "foul" | "neutral" | "ink";

type Props = {
  label: string;
  variant?: Variant;
  pulse?: boolean;
  withDot?: boolean;
};

const styles: Record<Variant, { bg: string; text: string; border: string }> = {
  live: { bg: "bg-hi-vis", text: "text-ink", border: "border-ink" },
  confirmed: { bg: "bg-transparent", text: "text-court", border: "border-court" },
  signal: { bg: "bg-transparent", text: "text-signal", border: "border-signal" },
  warn: { bg: "bg-transparent", text: "text-whistle", border: "border-whistle" },
  foul: { bg: "bg-transparent", text: "text-foul", border: "border-foul" },
  neutral: { bg: "bg-transparent", text: "text-ink", border: "border-ink" },
  ink: { bg: "bg-ink", text: "text-paper", border: "border-ink" },
};

function PulseDot({ color }: { color: string }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.3, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      className="w-[5px] h-[5px] rounded-full"
      style={[{ backgroundColor: color }, animStyle]}
    />
  );
}

export function Badge({ label, variant = "neutral", pulse, withDot }: Props) {
  const s = styles[variant];
  const dotColor =
    variant === "live"
      ? "#08111C"
      : variant === "confirmed"
      ? "#00A85C"
      : variant === "signal"
      ? "#1F4FCC"
      : "#08111C";

  return (
    <View
      className={`${s.bg} ${s.border} border flex-row items-center gap-1.5 px-2 py-1`}
    >
      {withDot && (pulse ? <PulseDot color={dotColor} /> : (
        <View
          className="w-[5px] h-[5px] rounded-full"
          style={{ backgroundColor: dotColor }}
        />
      ))}
      <Text
        className={`${s.text} font-mono-bold text-[9px] uppercase`}
        style={{ letterSpacing: 1.5 }}
      >
        {label}
      </Text>
    </View>
  );
}
