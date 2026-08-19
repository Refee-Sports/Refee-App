import { Text as RNText, TextInput as RNTextInput, type TextProps, type TextInputProps } from "react-native";
import { MAX_FONT_SCALE } from "@/lib/ui/typography";

// Design-system text primitives. Prefer these in NEW code over importing Text /
// TextInput straight from react-native — they apply the app's Dynamic Type cap
// explicitly (existing raw usages are covered by the global cap in
// lib/ui/text-scaling.ts). Both accept the usual RN props; an explicit
// maxFontSizeMultiplier still overrides the default.

export function Text(props: TextProps) {
  return <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}

export function TextInput(props: TextInputProps) {
  return <RNTextInput maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}
