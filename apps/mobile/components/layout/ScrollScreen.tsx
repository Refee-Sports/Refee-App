import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ScrollScreenProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  /** Extra padding below scroll content (e.g. bottom tab bar). */
  bottomOffset?: number;
  /** Wrap scroll area in KeyboardAvoidingView (forms). */
  keyboard?: boolean;
  className?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: Omit<ScrollViewProps, "children" | "contentContainerStyle" | "style">;
};

/**
 * Full-screen shell: safe area + optional fixed header/footer + scrollable body.
 * Use for profile, onboarding (sign-up), and other long forms.
 */
export function ScrollScreen({
  children,
  header,
  footer,
  bottomOffset = 0,
  keyboard = false,
  className = "bg-paper",
  contentContainerStyle,
  scrollViewProps,
}: ScrollScreenProps) {
  const insets = useSafeAreaInsets();
  const scrollBottomPadding = insets.bottom + bottomOffset + 24;

  const scrollView = (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets={keyboard && Platform.OS === "ios"}
      contentContainerStyle={[{ paddingBottom: scrollBottomPadding }, contentContainerStyle]}
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
  );

  const scrollBody = keyboard ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
      keyboardVerticalOffset={insets.top}
    >
      {scrollView}
    </KeyboardAvoidingView>
  ) : (
    scrollView
  );

  return (
    <View className={`flex-1 ${className}`}>
      <View style={{ height: insets.top }} />
      {header}
      {scrollBody}
      {footer}
    </View>
  );
}
