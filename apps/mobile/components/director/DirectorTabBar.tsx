import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "@refee/design";

type DirectorTab = "tournaments" | "messages" | "profile";

const ITEMS: { key: DirectorTab; icon: keyof typeof Feather.glyphMap; label: string; href: string }[] = [
  { key: "tournaments", icon: "grid", label: "Tournaments", href: "/(director)/(tabs)/tournaments" },
  { key: "messages", icon: "message-square", label: "Messages", href: "/(director)/(tabs)/messages" },
  { key: "profile", icon: "user", label: "Profile", href: "/(director)/(tabs)/profile" },
];

/**
 * Faithful copy of the director tab bar, rendered on detail screens (which sit
 * above the tab navigator, so the real bar is hidden). Styling matches
 * app/(director)/(tabs)/_layout.tsx; `active` highlights the owning tab.
 */
export function DirectorTabBar({ active }: { active?: DirectorTab }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row"
      style={{
        backgroundColor: palette.paper,
        borderTopWidth: 1,
        borderTopColor: palette.ink,
        paddingTop: 10,
        paddingBottom: insets.bottom + 6,
      }}
    >
      {ITEMS.map((it) => {
        const focused = active === it.key;
        const color = focused ? palette.signal : palette.ink40;
        return (
          <Pressable
            key={it.key}
            onPress={() => router.navigate(it.href as never)}
            className="flex-1 items-center active:opacity-60"
            accessibilityRole="button"
            accessibilityLabel={it.label}
          >
            <Feather name={it.icon} size={20} color={color} />
            <Text
              numberOfLines={1}
              className="font-mono-bold uppercase"
              style={{ fontSize: 8, letterSpacing: 0.5, marginTop: 3, color }}
            >
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
