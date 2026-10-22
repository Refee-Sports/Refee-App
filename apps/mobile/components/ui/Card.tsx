import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { choice, palette, radius } from "@refee/design";
import { choiceLook } from "@/lib/ui/looks";
import { Tappable } from "./Tappable";

/**
 * A chalk card with 18px corners. Pass `onPress` to make it tappable: it
 * then presses to 98% with the chalk-press tint, like the other choices.
 * `quiet` uses the light ink-20 border for list cards; `hi-vis` is the
 * highlighted call-out (e.g. "3 open games match you").
 */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  style,
  variant = "default",
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "quiet" | "hi-vis";
}) {
  const shape: ViewStyle = {
    borderWidth: 1,
    borderColor: variant === "quiet" ? palette.ink20 : palette.ink,
    borderRadius: radius.lg,
    overflow: "hidden",
  };
  const fill = (pressed: boolean) =>
    variant === "hi-vis"
      ? pressed ? palette.hiVisPress : palette.hiVis
      : choiceLook({ selected: false, pressed }).bg;
  if (!onPress) return <View style={[shape, { backgroundColor: fill(false) }, style]}>{children}</View>;
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      scaleTo={choice.scale.card}
      style={({ pressed }) => [shape, { backgroundColor: fill(pressed) }, style]}
    >
      {children}
    </Tappable>
  );
}
