import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, Text, View, type PressableProps } from "react-native";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { buttonPressScale, palette, radius, type ButtonVariant } from "@refee/design";
import { buttonLook } from "@/lib/ui/looks";
import { Tappable } from "./Tappable";

export type { ButtonVariant };

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  loadingLabel?: string; // read by VoiceOver/TalkBack while loading, e.g. "Accepting"
  done?: boolean; // swaps to the court Done style with a check
  doneLabel?: string; // e.g. "Accepted"
  disabledReason?: string; // shown under the button when disabled
  showArrow?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

/**
 * Sport-tech button: rounded-md corners, mono uppercase label, optional arrow.
 * Pushes in through Tappable (instant, 120ms ease back, Reduce Motion aware);
 * holds its width while loading; turns court green with a
 * check when `done`.
 */
export function Button({
  label,
  variant = "primary",
  loading = false,
  loadingLabel,
  done = false,
  doneLabel,
  disabledReason,
  showArrow = false,
  fullWidth = false,
  icon,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const isDone = done && !loading;
  const v: ButtonVariant = isDone ? "court" : variant;
  const text = isDone ? doneLabel ?? label : label;
  const inactive = !!disabled || loading;
  const fg = buttonLook(v, false).fg;

  useEffect(() => {
    if (isDone) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [isDone]);

  return (
    <View style={{ alignSelf: fullWidth ? "stretch" : "flex-start", gap: 6 }}>
      <Tappable
        accessibilityRole="button"
        accessibilityLabel={loading ? loadingLabel ?? label : text}
        accessibilityState={{ disabled: !!disabled, busy: loading }}
        disabled={inactive}
        hitSlop={4}
        scaleTo={buttonPressScale}
        haptic="light"
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={({ pressed }) => {
          const c = buttonLook(v, pressed);
          return {
            minHeight: 48,
            paddingHorizontal: 24,
            paddingVertical: 15,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: c.border,
            backgroundColor: c.bg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            opacity: disabled ? 0.4 : 1,
          };
        }}
        {...rest}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, opacity: loading ? 0 : 1 }}>
          {isDone ? <Feather name="check" size={16} color={fg} /> : icon}
          <Text
            style={{
              fontFamily: "JetBrainsMono_700Bold",
              fontSize: 12,
              letterSpacing: 1.68, // 0.14em
              textTransform: "uppercase",
              color: fg,
            }}
          >
            {text}
          </Text>
          {showArrow && !isDone && <Feather name="arrow-right" size={16} color={fg} />}
        </View>
        {loading && <ActivityIndicator color={fg} style={{ position: "absolute" }} />}
      </Tappable>
      {disabled && disabledReason ? (
        <Text
          style={{
            fontFamily: "JetBrainsMono_700Bold",
            fontSize: 9,
            letterSpacing: 0.9,
            textTransform: "uppercase",
            color: palette.ink60,
          }}
        >
          {disabledReason}
        </Text>
      ) : null}
    </View>
  );
}

export default Button;
