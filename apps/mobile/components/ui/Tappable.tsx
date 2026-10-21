import type { ReactNode } from "react";
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { usePressScale } from "./usePress";

export type TappableProps = Omit<PressableProps, "children" | "style"> & {
  children: ReactNode | ((state: { pressed: boolean }) => ReactNode);
  /** How far it presses in: 0.97 actions, 0.96 chips/big choice, 0.98 rows/cards. */
  scaleTo?: number;
  /** Light impact for actions, selection tick for choices. */
  haptic?: "light" | "selection" | "none";
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** Style for the outer animated wrapper (layout: flex, alignSelf…). */
  wrapperStyle?: StyleProp<ViewStyle>;
};

/**
 * The base every tappable control is built on: the design system's pressed
 * state (instant scale on touch-down, 120ms ease back, Reduce Motion aware)
 * plus haptics. Reach for Button / OptionRow / Chip / BigChoice / Toggle /
 * Card first; use this directly only for taps none of them fit.
 */
export function Tappable({
  children,
  scaleTo = 0.98,
  haptic = "selection",
  style,
  wrapperStyle,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: TappableProps) {
  const press = usePressScale(scaleTo);
  return (
    <Animated.View style={[wrapperStyle, { transform: [{ scale: press.scale }] }]}>
      <Pressable
        disabled={disabled}
        onPressIn={(e) => {
          press.pressIn();
          if (haptic === "light") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (haptic === "selection") Haptics.selectionAsync();
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          press.pressOut();
          onPressOut?.(e);
        }}
        style={style}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
