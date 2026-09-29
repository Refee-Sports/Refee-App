import { useEffect, useRef, useState } from "react";
import {
  Text,
  TextInput,
  View,
  Pressable,
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

  const inputRef = useRef<TextInput>(null);

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
      inputRef.current?.focus();
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
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70"
        >
          <Text className="text-ink font-mono-bold text-base">←</Text>
        </Pressable>
        <Text className="text-ink-60 font-mono-bold text-[9px] uppercase" style={{ letterSpacing: 2 }}>
          <Text className="text-ink">02</Text> / 08
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
          VERIFY · STEP 2
        </Text>
        <Text className="text-ink font-display" style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1.5 }}>
          CHECK YOUR{"\n"}
          <Text className="text-signal">EMAIL.</Text>
        </Text>
        <Text className="text-ink-80 mt-3 mb-7" style={{ fontSize: 14, lineHeight: 20 }}>
          We sent a 6-digit code to <Text className="text-ink font-body-bold">{maskEmail(email)}</Text>. It can take a
          minute — check spam if it isn&apos;t there.
        </Text>

        {/* Code cells — a hidden TextInput captures input, the cells are visual. */}
        <View className="relative">
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(v) => setCode(cleanCode(v))}
            keyboardType="number-pad"
            maxLength={EMAIL_CODE_LENGTH + 4}
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            className="absolute opacity-0 top-0 left-0 right-0 bottom-0 z-10"
            autoFocus
          />
          <Pressable onPress={() => inputRef.current?.focus()}>
            <View className="flex-row justify-between gap-1.5">
              {Array.from({ length: EMAIL_CODE_LENGTH }).map((_, i) => {
                const filled = !!code[i];
                const active = i === code.length;
                return (
                  <View
                    key={i}
                    className={`flex-1 aspect-square border-[1.5px] items-center justify-center ${
                      filled ? "bg-ink border-ink" : "bg-chalk border-ink"
                    }`}
                  >
                    <Text
                      className={`font-display ${filled ? "text-paper" : "text-ink"}`}
                      style={{ fontSize: 26, letterSpacing: -1 }}
                    >
                      {code[i] ?? (active ? "_" : "")}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Pressable>
        </View>

        {error && <Text className="text-foul font-mono text-xs mt-3 uppercase text-center">{error}</Text>}
        {notice && !error && <Text className="text-court font-mono text-xs mt-3 uppercase text-center">{notice}</Text>}

        <View className="border-t border-b border-ink-20 mt-6 py-3 flex-row justify-between items-center">
          {secondsLeft > 0 ? (
            <Text className="text-ink-60 font-mono-bold text-[11px] uppercase" style={{ letterSpacing: 1.5 }}>
              RESEND IN <Text className="text-ink">0:{secondsLeft.toString().padStart(2, "0")}</Text>
            </Text>
          ) : (
            <Pressable onPress={handleResend}>
              <Text className="text-signal font-mono-bold text-[11px] uppercase underline" style={{ letterSpacing: 1.5 }}>
                RESEND CODE
              </Text>
            </Pressable>
          )}
          <Pressable onPress={() => router.back()}>
            <Text className="text-signal font-mono-bold text-[11px] uppercase underline" style={{ letterSpacing: 1.5 }}>
              WRONG EMAIL?
            </Text>
          </Pressable>
        </View>

        {loading && (
          <View className="mt-6 items-center">
            <ActivityIndicator color="#1F4FCC" />
            <Text className="text-ink-60 font-mono-bold text-[10px] uppercase mt-2" style={{ letterSpacing: 2 }}>
              VERIFYING...
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
