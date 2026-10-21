import { useState, type ReactNode } from "react";
import { View, type TextInputProps } from "react-native";
import { fieldFocusGlow, radius } from "@refee/design";
import { fieldLook } from "@/lib/ui/looks";
import { Text, TextInput } from "./Text";

/** The uppercase mono caption above a field. */
export function Label({ children }: { children: ReactNode }) {
  return (
    <Text className="font-mono-bold text-[9px] uppercase text-ink-60 mb-2" style={{ letterSpacing: 2 }}>
      {children}
    </Text>
  );
}

type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
};

/**
 * Chalk-filled input with 10px corners and a 1.5px ink border. No hover or
 * press state; on focus the border turns signal with a soft signal glow.
 * Errors switch the border and caption to foul-ink.
 */
export function TextField({ label, error, hint, onFocus, onBlur, style, editable, ...props }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const c = fieldLook({ focused, error: !!error });
  return (
    <View>
      {label ? <Label>{label}</Label> : null}
      <View style={{ opacity: editable === false ? 0.4 : 1 }}>
        {c.glow ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -fieldFocusGlow.width,
              bottom: -fieldFocusGlow.width,
              left: -fieldFocusGlow.width,
              right: -fieldFocusGlow.width,
              borderRadius: radius.sm + fieldFocusGlow.width,
              borderWidth: fieldFocusGlow.width,
              borderColor: fieldFocusGlow.color,
            }}
          />
        ) : null}
        <TextInput
          {...props}
          editable={editable}
          placeholderTextColor={c.placeholder}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            {
              borderWidth: 1.5,
              borderColor: c.border,
              borderRadius: radius.sm,
              backgroundColor: c.bg,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontFamily: "JetBrainsMono_500Medium",
              fontSize: 14,
              color: c.text,
            },
            style,
          ]}
        />
      </View>
      {error ? (
        <Text className="mt-1 font-mono text-[9px] uppercase" style={{ letterSpacing: 1, color: c.error }}>
          {error}
        </Text>
      ) : hint ? (
        <Text className="mt-1 font-mono text-[9px] uppercase" style={{ letterSpacing: 1, color: c.hint }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
