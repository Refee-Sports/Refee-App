import { useRef, type ReactNode } from "react";
import { View, type TextInput as RNTextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { buttonPressScale, choice, palette, radius, type ColorKey } from "@refee/design";
import { buttonLook, choiceLook } from "@/lib/ui/looks";
import { Tappable } from "./Tappable";
import { Text, TextInput } from "./Text";

// Small controls every screen needs, on the same press behaviour as Button:
// square icon buttons, text links, tappable list rows and the code entry.

/** A 36px square icon button: back, edit, filter, share. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = "outline",
  active = false,
  disabled,
  size = 36,
}: {
  icon: ReactNode | ((color: string) => ReactNode);
  onPress: () => void;
  accessibilityLabel: string;
  /** `ink` for the filled version (e.g. a filter that's on). */
  variant?: "outline" | "ink";
  /** Shows the ink fill, for toggles like an open filter panel. */
  active?: boolean;
  disabled?: boolean;
  size?: number;
}) {
  const filled = variant === "ink" || active;
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, selected: active || undefined }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      scaleTo={buttonPressScale}
      haptic="selection"
      style={({ pressed }) => {
        const c = buttonLook(filled ? "primary" : "secondary", pressed);
        return {
          width: size,
          height: size,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: c.border,
          backgroundColor: filled ? c.bg : pressed ? palette.chalkPress : palette.chalk,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.4 : 1,
        };
      }}
    >
      {typeof icon === "function" ? icon(filled ? palette.paper : palette.ink) : icon}
    </Tappable>
  );
}

/** The standard back button. */
export function BackButton({ onPress, label = "Back" }: { onPress: () => void; label?: string }) {
  return (
    <IconButton
      accessibilityLabel={label}
      onPress={onPress}
      icon={(color) => <Feather name="arrow-left" size={16} color={color} />}
    />
  );
}

const LINK_COLORS: Record<"ink" | "muted" | "signal" | "danger", ColorKey> = {
  ink: "ink",
  muted: "ink60",
  signal: "signal",
  danger: "foulInk",
};

/** An underlined mono text action: Resend code, Wrong email?, Withdraw. */
export function TextLink({
  label,
  onPress,
  tone = "muted",
  size = 9,
  disabled,
  align = "center",
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  tone?: keyof typeof LINK_COLORS;
  size?: number;
  disabled?: boolean;
  align?: "left" | "center" | "right";
  accessibilityLabel?: string;
}) {
  return (
    <Tappable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      scaleTo={buttonPressScale}
      style={{
        paddingVertical: 8,
        alignSelf: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {({ pressed }) => (
        <Text
          className="font-mono-bold uppercase underline"
          style={{
            fontSize: size,
            letterSpacing: 1.5,
            color: palette[pressed && tone === "muted" ? "ink80" : LINK_COLORS[tone]],
          }}
        >
          {label}
        </Text>
      )}
    </Tappable>
  );
}

/** A tappable list row with a trailing arrow: settings, links, quick actions. */
export function ListRow({
  label,
  sublabel,
  onPress,
  leading,
  trailing,
  accessibilityLabel,
  tone = "ink",
}: {
  label: string;
  sublabel?: string;
  onPress: () => void;
  leading?: ReactNode;
  /** Replaces the arrow (e.g. a badge or count). */
  trailing?: ReactNode;
  accessibilityLabel?: string;
  tone?: "ink" | "danger";
}) {
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      scaleTo={choice.scale.optionRow}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderColor: palette.ink20,
        borderRadius: radius.md,
        backgroundColor: choiceLook({ selected: false, pressed }).bg,
        paddingHorizontal: 16,
        paddingVertical: 14,
      })}
    >
      {leading}
      <View style={{ flex: 1 }}>
        <Text
          className="font-mono-bold text-[11px] uppercase"
          style={{ letterSpacing: 1.5, color: tone === "danger" ? palette.foulInk : palette.ink }}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text className="font-mono text-[9px] text-ink-60 mt-0.5" style={{ letterSpacing: 0.5 }}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {trailing ?? <Feather name="chevron-right" size={16} color={palette.ink60} />}
    </Tappable>
  );
}

/** One box per digit over a hidden input; tapping anywhere focuses it. */
export function CodeField({
  value,
  onChangeText,
  length,
  error = false,
  autoFocus = true,
  editable = true,
}: {
  value: string;
  onChangeText: (v: string) => void;
  length: number;
  error?: boolean;
  autoFocus?: boolean;
  editable?: boolean;
}) {
  const input = useRef<RNTextInput>(null);
  return (
    <Tappable
      accessibilityRole="none"
      onPress={() => input.current?.focus()}
      haptic="none"
      scaleTo={1}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 6 }}>
        {Array.from({ length }).map((_, i) => {
          const filled = !!value[i];
          const current = editable && i === value.length;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                aspectRatio: 1,
                borderRadius: radius.sm,
                borderWidth: 1.5,
                borderColor: error ? palette.foulInk : current ? palette.signal : palette.ink,
                backgroundColor: filled ? palette.ink : palette.chalk,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text className="font-display" style={{ fontSize: 24, color: filled ? palette.paper : palette.ink }}>
                {value[i] ?? (current ? "_" : "")}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(t) => onChangeText(t.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus={autoFocus}
        editable={editable}
        accessibilityLabel={`${length}-digit code`}
        style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
      />
    </Tappable>
  );
}
