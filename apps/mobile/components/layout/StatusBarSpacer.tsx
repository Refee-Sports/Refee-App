import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Top spacer that respects iOS notch / Android status bar.
 * The actual time / battery icons are drawn by the OS — we just reserve space.
 */
export function StatusBarSpacer() {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.top }} />;
}

export function BottomSpacer() {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.bottom }} />;
}
