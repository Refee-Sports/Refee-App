import { Text, View } from "react-native";
import { radius, type BadgeVariant } from "@refee/design";
import { badgeLook } from "@/lib/ui/looks";
import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

type Variant = BadgeVariant;

type Props = {
  label: string;
  variant?: Variant;
  pulse?: boolean;
  withDot?: boolean;
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

/** A status pill: badges are status, not controls, so they never react to touch. */
export function Badge({ label, variant = "neutral", pulse, withDot }: Props) {
  const c = badgeLook(variant);
  return (
    <View
      className="border flex-row items-center gap-1.5 px-2.5 py-[5px]"
      style={{ backgroundColor: c.bg, borderColor: c.border, borderRadius: radius.full }}
    >
      {withDot && (pulse ? <PulseDot color={c.dot} /> : (
        <View className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: c.dot }} />
      ))}
      <Text className="font-mono-bold text-[9px] uppercase" style={{ letterSpacing: 1.5, color: c.fg }}>
        {label}
      </Text>
    </View>
  );
}
