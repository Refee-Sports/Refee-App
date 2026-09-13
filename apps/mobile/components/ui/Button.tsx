import { Pressable, Text, View } from "react-native";
import { ReactNode } from "react";

type Variant = "primary" | "hi-vis" | "secondary" | "danger";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  showArrow?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
};

const styles: Record<Variant, { bg: string; text: string; border: string }> = {
  primary: {
    bg: "bg-ink",
    text: "text-paper",
    border: "border-ink",
  },
  "hi-vis": {
    bg: "bg-hi-vis",
    text: "text-ink",
    border: "border-hi-vis",
  },
  secondary: {
    bg: "bg-transparent",
    text: "text-ink",
    border: "border-ink",
  },
  danger: {
    bg: "bg-transparent",
    text: "text-foul",
    border: "border-foul",
  },
};

/**
 * Sport-tech button: squared corners, mono uppercase label, optional arrow.
 * Hover/press doesn't apply on mobile but the brutalist offset shadow is
 * visible on web.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  showArrow = false,
  fullWidth = false,
  icon,
}: Props) {
  const s = styles[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`
        ${s.bg} ${s.border} border-[1.5px]
        py-4 px-5
        ${fullWidth ? "w-full" : ""}
        ${disabled ? "opacity-40" : ""}
        active:opacity-80
      `}
    >
      <View className="flex-row items-center justify-center gap-2">
        {icon}
        <Text
          className={`${s.text} font-mono-bold text-xs uppercase`}
          style={{ letterSpacing: 2 }}
        >
          {label}
        </Text>
        {showArrow && (
          <Text className={`${s.text} font-mono-bold text-base ml-1`}>→</Text>
        )}
      </View>
    </Pressable>
  );
}
