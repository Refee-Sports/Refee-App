import { ActivityIndicator, Pressable, Text, View } from "react-native";

type Props = {
  variant: "welcome" | "sign-in";
  loading: "google" | "apple" | null;
  onGoogle: () => void;
  onApple: () => void;
};

export function SocialAuthButtons({ variant, loading, onGoogle, onApple }: Props) {
  const busy = loading !== null;
  const googleBorder =
    variant === "welcome" ? "border border-paper/25" : "border border-ink/25";

  return (
    <View className="gap-2.5">
      <Pressable
        onPress={onGoogle}
        disabled={busy}
        className={`flex-row items-center justify-center gap-2 py-4 bg-chalk active:opacity-80 ${googleBorder}`}
      >
        {loading === "google" ? (
          <ActivityIndicator color="#08111C" />
        ) : (
          <Text
            className="text-ink font-mono-bold uppercase"
            style={{ fontSize: 11, letterSpacing: 2 }}
          >
            Continue with Google
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={onApple}
        disabled={busy}
        className="flex-row items-center justify-center gap-2 py-4 bg-black active:opacity-80"
      >
        {loading === "apple" ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text
            className="text-white font-mono-bold uppercase"
            style={{ fontSize: 11, letterSpacing: 2 }}
          >
            Continue with Apple
          </Text>
        )}
      </Pressable>
    </View>
  );
}
