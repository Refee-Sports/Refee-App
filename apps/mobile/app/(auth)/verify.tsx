import { useEffect, useState } from "react";
import {
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  EMAIL_CODE_LENGTH,
  cleanCode,
  maskEmail,
  sendEmailCode,
  verifyEmailCode,
} from "@/lib/auth/emailCode";
import { palette } from "@refee/design";
import { BackButton, CodeField, TextLink } from "@/components/ui/Controls";

const RESEND_SECONDS = 60;

export default function Verify() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { email = "" } = useLocalSearchParams<{ email: string }>();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  // Countdown until "resend" unlocks.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // Auto-submit when all digits are entered.
  useEffect(() => {
    if (code.length === EMAIL_CODE_LENGTH) void handleVerify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleVerify = async (entered: string) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setNotice(null);

    const { error: verifyError } = await verifyEmailCode(email, entered);
    setLoading(false);

    if (verifyError) {
      setError(verifyError.message);
      setCode("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // AuthGate in _layout.tsx routes us into the app (or onboarding) automatically.
  };

  const handleResend = async () => {
    if (secondsLeft > 0) return;
    Haptics.selectionAsync();
    setError(null);
    const { error: sendError } = await sendEmailCode(email);
    if (sendError) {
      setError(sendError.message);
      return;
    }
    setNotice("New code sent.");
    setSecondsLeft(RESEND_SECONDS);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-paper"
    >
      <View style={{ height: insets.top }} />

      <View className="flex-row items-center justify-between px-5 py-3">
        <BackButton onPress={() => router.back()} />
        <Text className="text-ink-60 font-mono-bold text-[9px] uppercase" style={{ letterSpacing: 2 }}>
          <Text className="text-ink">02</Text> / 02 · SIGN IN
        </Text>
        <View className="w-9" />
      </View>

      <ScrollView
        className="flex-1"
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
      >
        <Text className="text-signal font-mono-bold text-[10px] uppercase mt-4 mb-3" style={{ letterSpacing: 2 }}>
          VERIFY · STEP 2 OF 2
        </Text>
        <Text className="text-ink font-display" style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1.5 }}>
          CHECK YOUR{"\n"}
          <Text className="text-signal">EMAIL.</Text>
        </Text>
        <Text className="text-ink-80 mt-3 mb-7" style={{ fontSize: 14, lineHeight: 20 }}>
          We sent a 6-digit code to <Text className="text-ink font-body-bold">{maskEmail(email)}</Text>. It can take a
          minute — check spam if it isn&apos;t there.
        </Text>

        <CodeField
          value={code}
          onChangeText={(v) => setCode(cleanCode(v))}
          length={EMAIL_CODE_LENGTH}
          error={!!error}
          editable={!loading}
        />

        {error && <Text className="text-foul-ink font-mono text-xs mt-3 uppercase text-center">{error}</Text>}
        {notice && !error && <Text className="text-court-ink font-mono text-xs mt-3 uppercase text-center">{notice}</Text>}

        <View className="border-t border-b border-ink-20 mt-6 py-3 flex-row justify-between items-center">
          {secondsLeft > 0 ? (
            <Text className="text-ink-60 font-mono-bold text-[11px] uppercase" style={{ letterSpacing: 1.5 }}>
              RESEND IN <Text className="text-ink">0:{secondsLeft.toString().padStart(2, "0")}</Text>
            </Text>
          ) : (
            <TextLink label="Resend code" tone="signal" size={11} onPress={handleResend} />
          )}
          <TextLink label="Wrong email?" tone="signal" size={11} onPress={() => router.back()} />
        </View>

        {loading && (
          <View className="mt-6 items-center">
            <ActivityIndicator color={palette.signal} />
            <Text className="text-ink-60 font-mono-bold text-[10px] uppercase mt-2" style={{ letterSpacing: 2 }}>
              VERIFYING...
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
