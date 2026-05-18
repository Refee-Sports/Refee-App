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
import { supabase } from "@/lib/supabase";

const CODE_LENGTH = 6;

export default function Verify() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { phone, formattedPhone } = useLocalSearchParams<{
    phone: string;
    formattedPhone: string;
  }>();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [resendDisabled, setResendDisabled] = useState(true);

  const inputRef = useRef<TextInput>(null);

  // Countdown for resend button
  useEffect(() => {
    inputRef.current?.focus();
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setResendDisabled(false);
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-submit when 6 digits are entered
  useEffect(() => {
    if (code.length === CODE_LENGTH) handleVerify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleVerify = async (otpCode: string) => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otpCode,
      type: "sms",
    });

    setLoading(false);

    if (error) {
      setError("That code didn't work. Try again.");
      setCode("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // AuthGate in _layout.tsx will route us to /(app) automatically.
  };

  const handleResend = async () => {
    Haptics.selectionAsync();
    setResendDisabled(true);
    setSecondsLeft(60);
    await supabase.auth.signInWithOtp({ phone });
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setResendDisabled(false);
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  // Mask phone for display: +1 (512) ••• 8429
  const maskedPhone = formattedPhone
    ? `(${formattedPhone.slice(1, 4)}) ••• ${formattedPhone.slice(-4)}`
    : phone;

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
        <Text
          className="text-ink-60 font-mono-bold text-[9px] uppercase"
          style={{ letterSpacing: 2 }}
        >
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
        <Text
          className="text-signal font-mono-bold text-[10px] uppercase mt-4 mb-3"
          style={{ letterSpacing: 2 }}
        >
          VERIFY · STEP 2
        </Text>
        <Text
          className="text-ink font-display"
          style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1.5 }}
        >
          CHECK YOUR{"\n"}
          <Text className="text-signal">PHONE.</Text>
        </Text>
        <Text className="text-ink-80 mt-3 mb-7" style={{ fontSize: 14, lineHeight: 20 }}>
          We sent a 6-digit code to{" "}
          <Text className="text-ink font-body-bold">+1 {maskedPhone}</Text>.
        </Text>

        {/* OTP cells — hidden TextInput captures input, cells are visual */}
        <View className="relative">
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, CODE_LENGTH))}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            // Make the actual input invisible but tappable
            className="absolute opacity-0 top-0 left-0 right-0 bottom-0 z-10"
            autoFocus
          />
          <Pressable onPress={() => inputRef.current?.focus()}>
            <View className="flex-row justify-between gap-1.5">
              {Array.from({ length: CODE_LENGTH }).map((_, i) => {
                const filled = !!code[i];
                const active = i === code.length;
                return (
                  <View
                    key={i}
                    className={`flex-1 aspect-square border-[1.5px] items-center justify-center
                      ${filled ? "bg-ink border-ink" : "bg-chalk border-ink"}`}
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

        {error && (
          <Text className="text-foul font-mono text-xs mt-3 uppercase text-center">
            {error}
          </Text>
        )}

        {/* Resend row */}
        <View className="border-t border-b border-ink-20 mt-6 py-3 flex-row justify-between items-center">
          {resendDisabled ? (
            <Text
              className="text-ink-60 font-mono-bold text-[11px] uppercase"
              style={{ letterSpacing: 1.5 }}
            >
              RESEND IN{" "}
              <Text className="text-ink">
                0:{secondsLeft.toString().padStart(2, "0")}
              </Text>
            </Text>
          ) : (
            <Pressable onPress={handleResend}>
              <Text
                className="text-signal font-mono-bold text-[11px] uppercase underline"
                style={{ letterSpacing: 1.5 }}
              >
                RESEND CODE
              </Text>
            </Pressable>
          )}
          <Pressable onPress={() => router.back()}>
            <Text
              className="text-signal font-mono-bold text-[11px] uppercase underline"
              style={{ letterSpacing: 1.5 }}
            >
              WRONG NUMBER?
            </Text>
          </Pressable>
        </View>

        {/* Why-phone-first explainer */}
        <View className="border border-dashed border-ink-40 mt-6 p-3.5 flex-row gap-2.5">
          <Text className="text-signal font-mono text-base">▸</Text>
          <View className="flex-1">
            <Text
              className="text-ink font-mono-bold text-[9px] uppercase mb-1"
              style={{ letterSpacing: 2 }}
            >
              WHY PHONE FIRST?
            </Text>
            <Text className="text-ink-80 text-[11px]" style={{ lineHeight: 16 }}>
              No passwords. We text you a code each time you sign in on a new
              device. Refs verify each other are real humans.
            </Text>
          </View>
        </View>

        {loading && (
          <View className="mt-6 items-center">
            <ActivityIndicator color="#1F4FCC" />
            <Text
              className="text-ink-60 font-mono-bold text-[10px] uppercase mt-2"
              style={{ letterSpacing: 2 }}
            >
              VERIFYING...
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
