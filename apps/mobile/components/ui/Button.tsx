import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Pressable, Text, View, type PressableProps } from "react-native";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

export type ButtonVariant = "primary" | "hi-vis" | "secondary" | "danger" | "danger-fill" | "court";

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

const C = {
  ink: "#08111C",
  paper: "#E5E1D6",
  hiVis: "#C9F031",
  court: "#00A85C",
  foulInk: "#B3202C",
};

const look: Record<ButtonVariant, { bg: string; bgPressed: string; border: string; fg: string }> = {
  primary: { bg: C.ink, bgPressed: "#2B3440", border: C.ink, fg: C.paper },
  "hi-vis": { bg: C.hiVis, bgPressed: "#B1D61F", border: C.ink, fg: C.ink },
  secondary: { bg: "transparent", bgPressed: "rgba(8,17,28,0.10)", border: C.ink, fg: C.ink },
  danger: { bg: "transparent", bgPressed: "rgba(8,17,28,0.10)", border: C.foulInk, fg: C.foulInk },
  "danger-fill": { bg: C.foulInk, bgPressed: "#961A24", border: C.foulInk, fg: "#FFFFFF" },
  court: { bg: C.court, bgPressed: C.court, border: C.ink, fg: C.ink },
};

/**
 * Sport-tech button: rounded-md corners, mono uppercase label, optional arrow.
 * Pushes in instantly on touch-down and eases back over 120ms (skipped under
 * Reduce Motion); holds its width while loading; turns court green with a
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
  const scale = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const isDone = done && !loading;
  const v: ButtonVariant = isDone ? "court" : variant;
  const c = look[v];
  const text = isDone ? doneLabel ?? label : label;
  const inactive = !!disabled || loading;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (isDone) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [isDone]);

  return (
    <View style={{ alignSelf: fullWidth ? "stretch" : "flex-start", gap: 6 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={loading ? loadingLabel ?? label : text}
          accessibilityState={{ disabled: !!disabled, busy: loading }}
          disabled={inactive}
          hitSlop={4}
          onPressIn={(e) => {
            if (!reduceMotion) scale.setValue(0.97); // instant on touch-down
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPressIn?.(e);
          }}
          onPressOut={(e) => {
            Animated.timing(scale, { toValue: 1, duration: reduceMotion ? 0 : 120, useNativeDriver: true }).start();
            onPressOut?.(e);
          }}
          style={({ pressed }) => ({
            minHeight: 48,
            paddingHorizontal: 24,
            paddingVertical: 15,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: c.border,
            backgroundColor: pressed ? c.bgPressed : c.bg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            opacity: disabled ? 0.4 : 1,
          })}
          {...rest}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, opacity: loading ? 0 : 1 }}>
            {isDone ? <Feather name="check" size={16} color={c.fg} /> : icon}
            <Text
              style={{
                fontFamily: "JetBrainsMono_700Bold",
                fontSize: 12,
                letterSpacing: 1.68, // 0.14em
                textTransform: "uppercase",
                color: c.fg,
              }}
            >
              {text}
            </Text>
            {showArrow && !isDone && <Feather name="arrow-right" size={16} color={c.fg} />}
          </View>
          {loading && <ActivityIndicator color={c.fg} style={{ position: "absolute" }} />}
        </Pressable>
      </Animated.View>
      {disabled && disabledReason ? (
        <Text
          style={{
            fontFamily: "JetBrainsMono_700Bold",
            fontSize: 9,
            letterSpacing: 0.9,
            textTransform: "uppercase",
            color: "rgba(8,17,28,0.6)",
          }}
        >
          {disabledReason}
        </Text>
      ) : null}
    </View>
  );
}

export default Button;
