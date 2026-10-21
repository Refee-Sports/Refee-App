import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { choice, disabledOpacity, palette, radius } from "@refee/design";
import { chipLook, choiceLook, toggleLook } from "@/lib/ui/looks";
import { Tappable } from "./Tappable";
import { Text } from "./Text";

// The choice kit: one selection idiom (signal border, signal-tint wash,
// signal label), "ring to choose" on web and press-to-tint here.

/** A full-width selectable row — sports, certs, levels, rulesets. */
export function OptionRow({
  label,
  sublabel,
  selected,
  onPress,
  dim = false,
  disabled,
}: {
  label: string;
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
  /** The lighter unselected border (the levels list). */
  dim?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={choice.scale.optionRow}
      style={({ pressed }) => {
        const c = choiceLook({ selected, pressed, dim });
        return {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderWidth: 1.5,
          borderRadius: radius.md,
          borderColor: c.border,
          backgroundColor: c.bg,
          paddingHorizontal: 16,
          paddingVertical: 14,
          opacity: disabled ? disabledOpacity : 1,
        };
      }}
    >
      {({ pressed }) => {
        const fg = choiceLook({ selected, pressed, dim }).fg;
        return (
          <>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text className="font-mono-bold text-sm" style={{ letterSpacing: 1, color: fg }}>
                {label}
              </Text>
              {sublabel ? (
                <Text className="mt-0.5 font-mono text-[9px] text-ink-60" style={{ letterSpacing: 0.5 }} numberOfLines={1}>
                  {sublabel}
                </Text>
              ) : null}
            </View>
            {selected ? <Feather name="check" size={16} color={fg} /> : null}
          </>
        );
      }}
    </Tappable>
  );
}

/** Wrapping row of chips. */
export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{children}</View>;
}

/** A pill filter/option: light outline, signal when selected. */
export function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={choice.scale.chip}
      style={({ pressed }) => {
        const c = chipLook({ selected, pressed });
        return {
          minHeight: 36,
          justifyContent: "center",
          borderWidth: 1,
          borderRadius: radius.full,
          borderColor: c.border,
          backgroundColor: c.bg,
          paddingHorizontal: 16,
          paddingVertical: 10,
          opacity: disabled ? disabledOpacity : 1,
        };
      }}
    >
      {({ pressed }) => (
        <Text
          className="font-mono-bold text-[10px] uppercase"
          style={{ letterSpacing: 1.4, color: chipLook({ selected, pressed }).fg }}
        >
          {label}
        </Text>
      )}
    </Tappable>
  );
}

/** The big numeric picker — 4 QUARTERS / 2 HALVES, crew size. */
export function BigChoice({
  num,
  label,
  selected,
  onPress,
  disabled,
}: {
  num: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={`${num} ${label}`}
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={choice.scale.bigChoice}
      wrapperStyle={{ flex: 1 }}
      style={({ pressed }) => {
        const c = choiceLook({ selected, pressed });
        return {
          alignItems: "center",
          borderWidth: 1.5,
          borderRadius: radius.md,
          borderColor: c.border,
          backgroundColor: c.bg,
          paddingVertical: 16,
          opacity: disabled ? disabledOpacity : 1,
        };
      }}
    >
      {({ pressed }) => {
        const fg = choiceLook({ selected, pressed }).fg;
        return (
          <>
            <Text className="font-display" style={{ fontSize: 28, letterSpacing: -1, color: fg }}>
              {num}
            </Text>
            <Text
              className="font-mono-bold text-[9px] uppercase"
              style={{ letterSpacing: 2, color: selected ? fg : palette.ink60 }}
            >
              {label}
            </Text>
          </>
        );
      }}
    </Tappable>
  );
}

/** The pill switch. The thumb stretches 18px → 24px while held. */
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** Read by VoiceOver/TalkBack. */
  label: string;
}) {
  const [held, setHeld] = useState(false);
  const c = toggleLook({ checked, held });
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={8}
      onPressIn={() => setHeld(true)}
      onPressOut={() => setHeld(false)}
      onPress={() => {
        Haptics.selectionAsync();
        onChange(!checked);
      }}
      style={{
        width: 50,
        height: 28,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: palette.ink,
        backgroundColor: c.track,
        opacity: disabled ? disabledOpacity : 1,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 4,
          left: c.thumbLeft,
          width: c.thumbWidth,
          height: 18,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: c.thumbBorder,
          backgroundColor: c.thumb,
        }}
      />
    </Pressable>
  );
}
