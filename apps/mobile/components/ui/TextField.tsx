import { forwardRef, useState, type ReactNode } from "react";
import { View, type TextInput as RNTextInput, type TextInputProps } from "react-native";
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
  /** Drawn inside the field, before / after the text (e.g. a search icon, a spinner). */
  leading?: ReactNode;
  trailing?: ReactNode;
};

/**
 * Chalk-filled input with 10px corners and a 1.5px ink border. No hover or
 * press state; on focus the border turns signal with a soft signal glow.
 * Errors switch the border and caption to foul-ink.
 */
export const TextField = forwardRef<RNTextInput, TextFieldProps>(function TextField(
  { label, error, hint, leading, trailing, onFocus, onBlur, style, editable, ...props },
  ref
) {
  const adorned = !!(leading || trailing);
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
        {adorned ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderWidth: 1.5,
              borderColor: c.border,
              borderRadius: radius.sm,
              backgroundColor: c.bg,
              paddingHorizontal: 14,
            }}
          >
            {leading}
            <TextInput
              {...props}
              ref={ref}
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
                { flex: 1, paddingVertical: 14, fontFamily: "JetBrainsMono_500Medium", fontSize: 14, color: c.text },
                style,
              ]}
            />
            {trailing}
          </View>
        ) : (
        <TextInput
          {...props}
          ref={ref}
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
        )}
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
});

/** A field with an ink-filled affix: the "$" on min pay, "MI" on radius. */
export function AffixField({
  prefix,
  suffix,
  label,
  hint,
  error,
  onFocus,
  onBlur,
  ...props
}: TextFieldProps & { prefix?: string; suffix?: string }) {
  const [focused, setFocused] = useState(false);
  const c = fieldLook({ focused, error: !!error });
  const affix = (text: string) => (
    <View style={{ backgroundColor: c.text, paddingHorizontal: 16, justifyContent: "center" }}>
      <Text className="font-mono-bold text-base" style={{ letterSpacing: 0.5, color: c.bg }}>
        {text}
      </Text>
    </View>
  );
  return (
    <View>
      {label ? <Label>{label}</Label> : null}
      <View>
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
        <View
          style={{
            flexDirection: "row",
            borderWidth: 1.5,
            borderColor: c.border,
            borderRadius: radius.sm,
            overflow: "hidden",
          }}
        >
          {prefix ? affix(prefix) : null}
          <TextInput
            {...props}
            placeholderTextColor={c.placeholder}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={{
              flex: 1,
              backgroundColor: c.bg,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontFamily: "JetBrainsMono_500Medium",
              fontSize: 14,
              color: c.text,
            }}
          />
          {suffix ? affix(suffix) : null}
        </View>
      </View>
      {error ? (
        <Text className="mt-1.5 font-mono text-[9px] uppercase" style={{ letterSpacing: 1.2, color: c.error }}>
          {error}
        </Text>
      ) : hint ? (
        <Text className="mt-1.5 font-mono text-[9px] uppercase" style={{ letterSpacing: 1.2, color: c.hint }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
