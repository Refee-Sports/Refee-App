import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { Button } from "@/components/ui/Button";
import { Tappable } from "@/components/ui/Tappable";
import { buttonPressScale, palette, radius } from "@refee/design";
import { signInWithAppleOAuth, signInWithGoogleOAuth } from "@/lib/oauth";
import { getSupabaseSetupError, supabase } from "@/lib/supabase";

/**
 * Welcome / 5.1 — first impression.
 * Inverse palette: ink canvas + paper text + hi-vis accents.
 * The three-cell value strip states product capabilities without promising a
 * payout deadline that depends on unsettled marketplace-risk policy.
 */
export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const runOAuth = async (provider: "google" | "apple") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const setupErr = getSupabaseSetupError();
    if (setupErr) {
      setOauthError(setupErr);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setOauthError(null);
    setOauthLoading(provider);
    const { error } =
      provider === "google" ? await signInWithGoogleOAuth() : await signInWithAppleOAuth();
    setOauthLoading(null);
    if (error) {
      setOauthError(error.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const goToSignIn = async () => {
    await supabase.auth.signOut();
    router.push("/(auth)/sign-in");
  };

  const goToGetStarted = async () => {
    await supabase.auth.signOut();
    router.push("/(auth)/sign-in");
  };

  return (
    <View className="flex-1 bg-ink">
      <StatusBar style="light" />

      <View style={{ height: insets.top }} />

      {/* Top zebra strip */}
      <ZebraRule variant="signal" />

      <ScrollView
        className="flex-1"
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 40,
          paddingBottom: 24,
        }}
      >
        {/* Live tag */}
        <View className="flex-row items-center gap-2 mb-4">
          <View className="w-1.5 h-1.5 rounded-full bg-hi-vis" />
          <Text
            className="text-hi-vis font-mono-bold text-[10px] uppercase"
            style={{ letterSpacing: 2 }}
          >
            CALLED UP · LIVE ROSTER
          </Text>
        </View>

        {/* Headline */}
        <Text
          className="text-paper font-display"
          style={{ fontSize: 64, lineHeight: 72, letterSpacing: -2.5 }}
        >
          REF
          <Text className="text-signal-dark">EE</Text>
          {"\n"}EARN ON{"\n"}YOUR <Text className="text-signal-dark">CALL.</Text>
        </Text>

        <Text
          className="text-paper/70 mt-5 mb-8"
          style={{ fontSize: 15, lineHeight: 22, maxWidth: 280 }}
        >
          The on-demand marketplace for officials. Find games, set your rate,
          and track every payout.
        </Text>

        {/* Three-cell value strip */}
        <View className="border border-paper/20 flex-row mb-auto overflow-hidden" style={{ borderRadius: radius.lg }}>
          <View className="flex-1 py-3 border-r border-paper/20 items-center">
            <Text
              className="text-paper font-display"
              style={{ fontSize: 22, letterSpacing: -1, lineHeight: 22 }}
            >
              LIVE<Text className="text-hi-vis">.</Text>
            </Text>
            <Text
              className="text-paper/50 font-mono-bold text-[8px] uppercase mt-1"
              style={{ letterSpacing: 1.5 }}
            >
              ROSTER
            </Text>
          </View>
          <View className="flex-1 py-3 border-r border-paper/20 items-center">
            <Text
              className="text-paper font-display"
              style={{ fontSize: 22, letterSpacing: -1, lineHeight: 22 }}
            >
              CLEAR<Text className="text-hi-vis">.</Text>
            </Text>
            <Text
              className="text-paper/50 font-mono-bold text-[8px] uppercase mt-1"
              style={{ letterSpacing: 1.5 }}
            >
              PAY STATUS
            </Text>
          </View>
          <View className="flex-1 py-3 items-center">
            <Text
              className="text-paper font-display"
              style={{ fontSize: 22, letterSpacing: -1, lineHeight: 22 }}
            >
              YOU<Text className="text-hi-vis">.</Text>
            </Text>
            <Text
              className="text-paper/50 font-mono-bold text-[8px] uppercase mt-1"
              style={{ letterSpacing: 1.5 }}
            >
              SET RATE
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky footer — outside ScrollView so taps always register */}
      <View
        className="border-t border-paper/15 px-6 pt-4 bg-ink"
        style={{ paddingBottom: insets.bottom + 20 }}
      >
        <SocialAuthButtons
          variant="welcome"
          loading={oauthLoading}
          onGoogle={() => runOAuth("google")}
          onApple={() => runOAuth("apple")}
        />

        {oauthError ? (
          <Text
            className="text-foul-ink font-mono text-[11px] mt-3 uppercase"
            style={{ letterSpacing: 0.5 }}
          >
            {oauthError}
          </Text>
        ) : null}

        <View className="flex-row items-center gap-3 my-5">
          <View className="flex-1 h-px bg-paper/25" />
          <Text
            className="text-paper/45 font-mono-bold text-[10px] uppercase"
            style={{ letterSpacing: 3 }}
          >
            or email
          </Text>
          <View className="flex-1 h-px bg-paper/25" />
        </View>

        <View className="mb-2.5">
          <Button label="Get started" variant="hi-vis" showArrow fullWidth onPress={goToGetStarted} />
        </View>

        <Tappable
          accessibilityRole="button"
          accessibilityLabel="Already a ref? Sign in"
          onPress={goToSignIn}
          scaleTo={buttonPressScale}
          style={({ pressed }) => ({
            minHeight: 48,
            justifyContent: "center",
            paddingVertical: 15,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: palette.inkInv40,
            backgroundColor: pressed ? palette.inkInv10 : "transparent",
          })}
        >
          <Text
            className="text-paper text-center font-mono-bold uppercase"
            style={{ fontSize: 11, letterSpacing: 2 }}
          >
            ALREADY A REF? <Text className="text-hi-vis">SIGN IN</Text>
          </Text>
        </Tappable>

        <View className="flex-row justify-between mt-5">
          <Text
            className="text-paper/40 font-mono-bold text-[9px] uppercase"
            style={{ letterSpacing: 1.5 }}
          >
            v0.1
          </Text>
          <Text
            className="text-paper/40 font-mono-bold text-[9px] uppercase"
            style={{ letterSpacing: 1.5 }}
          >
            ● BUILT BY OFFICIALS
          </Text>
        </View>
      </View>
    </View>
  );
}
