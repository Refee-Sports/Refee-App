import { ActivityIndicator, Text, View } from "react-native";
import { buttonPressScale, palette, radius } from "@refee/design";
import { Tappable } from "@/components/ui/Tappable";

type Props = {
  variant: "welcome" | "sign-in";
  loading: "google" | "apple" | null;
  onGoogle: () => void;
  onApple: () => void;
};

// Provider buttons keep their brand fills (chalk for Google, black for Apple)
// but share Button's shape and press: radius-md, 97% push, instant tint.
const shape = {
  minHeight: 48,
  borderRadius: radius.md,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  paddingVertical: 15,
} as const;

const label = { fontFamily: "JetBrainsMono_700Bold", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" } as const;

export function SocialAuthButtons({ variant, loading, onGoogle, onApple }: Props) {
  const busy = loading !== null;
  const googleBorder = variant === "welcome" ? palette.inkInv20 : palette.ink20;

  return (
    <View className="gap-2.5">
      <Tappable
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        accessibilityState={{ disabled: busy, busy: loading === "google" }}
        onPress={onGoogle}
        disabled={busy}
        scaleTo={buttonPressScale}
        haptic="none"
        style={({ pressed }) => ({
          ...shape,
          borderWidth: 1,
          borderColor: googleBorder,
          backgroundColor: pressed ? palette.chalkPress : palette.chalk,
          opacity: busy && loading !== "google" ? 0.4 : 1,
        })}
      >
        {loading === "google" ? (
          <ActivityIndicator color={palette.ink} />
        ) : (
          <Text style={{ ...label, color: palette.ink }}>Continue with Google</Text>
        )}
      </Tappable>

      <Tappable
        accessibilityRole="button"
        accessibilityLabel="Continue with Apple"
        accessibilityState={{ disabled: busy, busy: loading === "apple" }}
        onPress={onApple}
        disabled={busy}
        scaleTo={buttonPressScale}
        haptic="none"
        style={({ pressed }) => ({
          ...shape,
          // Apple's button is black by their guidelines; it lightens to ink when pressed.
          backgroundColor: pressed ? palette.ink : "black",
          opacity: busy && loading !== "apple" ? 0.4 : 1,
        })}
      >
        {loading === "apple" ? (
          <ActivityIndicator color={palette.inkInv} />
        ) : (
          <Text style={{ ...label, color: palette.inkInv }}>Continue with Apple</Text>
        )}
      </Tappable>
    </View>
  );
}
