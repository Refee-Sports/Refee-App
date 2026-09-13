import { useState } from "react";
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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { sendEmailMagicLink, signInWithAppleOAuth, signInWithGoogleOAuth } from "@/lib/oauth";
import { getSupabaseConfig, isLocalSupabaseUrl } from "@/lib/supabase-config";
import { getSupabaseSetupError, supabase } from "@/lib/supabase";

/**
 * Phone-first auth — no passwords. Supabase Auth handles SMS OTP.
 */
export default function SignIn() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [emailSent, setEmailSent] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { url: supabaseUrl } = getSupabaseConfig();
  const supabaseHost = supabaseUrl.replace(/^https?:\/\//, "");

  // Format phone as user types: (512) 555-8429
  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const isValidPhone = phone.replace(/\D/g, "").length === 10;
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = method === "phone" ? isValidPhone : isValidEmail;
  const oauthBusy = oauthLoading !== null;

  const runOAuth = async (provider: "google" | "apple") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const setupErr = getSupabaseSetupError();
    if (setupErr) {
      setOauthError(setupErr);
      setError(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setOauthError(null);
    setError(null);
    setOauthLoading(provider);
    const result =
      provider === "google" ? await signInWithGoogleOAuth() : await signInWithAppleOAuth();
    setOauthLoading(null);
    if (result.error) {
      setOauthError(result.error.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setPhoneLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const setupErr = getSupabaseSetupError();
    if (setupErr) {
      setPhoneLoading(false);
      setError(setupErr);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Drop stale JWT so OTP attaches to the seeded phone user, not a ghost account.
    await supabase.auth.signOut();

    if (method === "email") {
      const result = await sendEmailMagicLink(email);
      setPhoneLoading(false);
      if (result.error) {
        setError(result.error.message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      setEmailSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    const e164 = "+1" + phone.replace(/\D/g, "");
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });

    setPhoneLoading(false);

    if (error) {
      const raw = error.message ?? "";
      const networkLike =
        /network request failed/i.test(raw) ||
        /fetch/i.test(raw) ||
        /failed to fetch/i.test(raw);
      const unsupportedProvider = /unsupported phone provider/i.test(raw);
      const { url: activeSupabaseUrl } = getSupabaseConfig();
      const isLocalSupabase = isLocalSupabaseUrl(activeSupabaseUrl);
      setError(
        networkLike
          ? "Can't reach Supabase. Confirm EXPO_PUBLIC_SUPABASE_URL is your hosted https://…supabase.co URL (not localhost on a real phone), Wi‑Fi is on, then restart Expo."
          : unsupportedProvider && isLocalSupabase
            ? "Local Supabase phone auth is off or Expo loaded the wrong .env. Run: npm run supabase:stop && npm run supabase:start, then npm run start:local (not npm start). Use (555) 555-0100 and OTP 123456."
            : unsupportedProvider
              ? "Supabase needs an SMS provider. For hosted: Dashboard → Authentication → Phone + Twilio. For local dev: use npm run start:local with test OTP instead."
              : raw
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    router.push({
      pathname: "/(auth)/verify",
      params: { phone: e164, formattedPhone: phone },
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-paper"
    >
      <View style={{ height: insets.top }} />

      {/* Header */}
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
          <Text className="text-ink">01</Text> / 08
        </Text>
        <View className="w-9" />
      </View>

      <ScrollView
        className="flex-1"
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        <View className="px-5 pb-4">
          <SocialAuthButtons
            variant="sign-in"
            loading={oauthLoading}
            onGoogle={() => runOAuth("google")}
            onApple={() => runOAuth("apple")}
          />
          {oauthError ? (
            <Text className="text-foul font-mono text-xs mt-3 uppercase">{oauthError}</Text>
          ) : null}
          <View className="flex-row items-center gap-3 mt-5 mb-2">
            <View className="flex-1 h-px bg-ink/15" />
            <Text
              className="text-ink-60 font-mono-bold text-[9px] uppercase"
              style={{ letterSpacing: 2 }}
            >
              or continue with
            </Text>
            <View className="flex-1 h-px bg-ink/15" />
          </View>
        </View>

        <View className="px-5">
        <View className="flex-row border border-ink mt-2 mb-5">
          {(["phone", "email"] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => { setMethod(value); setError(null); setEmailSent(false); }}
              className={`flex-1 py-3 items-center ${method === value ? "bg-ink" : "bg-chalk"}`}
            >
              <Text className={`font-mono-bold text-[9px] uppercase ${method === value ? "text-paper" : "text-ink"}`} style={{ letterSpacing: 1.5 }}>
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text
          className="text-signal font-mono-bold text-[10px] uppercase mt-2 mb-3"
          style={{ letterSpacing: 2 }}
        >
          {method.toUpperCase()} · STEP 1
        </Text>
        <Text
          className="text-ink font-display"
          style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1.5 }}
        >
          ENTER YOUR{"\n"}
          <Text className="text-signal">{method === "phone" ? "NUMBER." : "EMAIL."}</Text>
        </Text>
        <Text className="text-ink-80 mt-3 mb-6" style={{ fontSize: 14, lineHeight: 20 }}>
          {method === "phone"
            ? "We'll text you a 6-digit code. No passwords. You sign in the same way on every new device."
            : "We'll email you a secure, single-use sign-in link. No password required."}
        </Text>

        {__DEV__ && supabaseHost ? (
          <Text
            className="text-ink-40 font-mono text-[9px] uppercase mb-4"
            style={{ letterSpacing: 1.2 }}
          >
            DEV · API {supabaseHost}
            {isLocalSupabaseUrl(supabaseUrl) ? " · LOCAL" : " · HOSTED"}
          </Text>
        ) : null}

        {/* Passwordless phone or email input */}
        <Text
          className="text-ink-60 font-mono-bold text-[9px] uppercase mb-2"
          style={{ letterSpacing: 2 }}
        >
          {method === "phone" ? "PHONE NUMBER" : "EMAIL ADDRESS"}
        </Text>
        {method === "phone" ? (
          <View className="flex-row border-[1.5px] border-ink">
            <View className="bg-ink px-4 justify-center">
              <Text className="text-paper font-mono-bold text-base" style={{ letterSpacing: 0.5 }}>+1</Text>
            </View>
            <TextInput value={phone} onChangeText={(v) => setPhone(formatPhone(v))} placeholder="(512) 555-8429" placeholderTextColor="rgba(8,17,28,0.36)" keyboardType="phone-pad" autoFocus={!oauthBusy} editable={!oauthBusy} className="flex-1 bg-chalk px-4 py-3.5 text-ink font-mono" style={{ fontSize: 14 }} maxLength={14} />
          </View>
        ) : (
          <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="rgba(8,17,28,0.36)" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!oauthBusy} className="border-[1.5px] border-ink bg-chalk px-4 py-3.5 text-ink font-mono" style={{ fontSize: 14 }} />
        )}

        {emailSent && (
          <View className="border border-court bg-court/10 px-4 py-3 mt-3">
            <Text className="font-mono-bold text-[10px] text-ink uppercase" style={{ letterSpacing: 1 }}>CHECK YOUR EMAIL</Text>
            <Text className="font-mono text-[9px] text-ink-60 mt-1">Open the Refee sign-in link on this device. The link expires and can only be used once.</Text>
          </View>
        )}

        {error && (
          <Text className="text-foul font-mono text-xs mt-3 uppercase">{error}</Text>
        )}

        <Text
          className="text-ink-60 font-mono text-[9px] mt-4 uppercase"
          style={{ letterSpacing: 1.4 }}
        >
          BY CONTINUING YOU AGREE TO REFEE&apos;S TERMS &amp; PRIVACY POLICY.
        </Text>
        </View>
      </ScrollView>

      {/* Sticky bottom action */}
      <View
        className="border-t-[1.5px] border-ink bg-paper px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || phoneLoading || oauthBusy}
          className={`py-4 ${canSubmit && !phoneLoading && !oauthBusy ? "bg-ink" : "bg-ink-20"} active:opacity-80`}
        >
          <View className="flex-row justify-center items-center gap-2">
            {phoneLoading ? (
              <ActivityIndicator color="#E5E1D6" />
            ) : (
              <>
                <Text
                  className={`font-mono-bold ${canSubmit && !oauthBusy ? "text-paper" : "text-ink-40"}`}
                  style={{ fontSize: 12, letterSpacing: 2.5 }}
                >
                  {method === "phone" ? "SEND CODE" : emailSent ? "RESEND LINK" : "EMAIL SIGN-IN LINK"}
                </Text>
                <Text
                  className={`font-mono-bold text-base ${canSubmit && !oauthBusy ? "text-paper" : "text-ink-40"}`}
                >
                  →
                </Text>
              </>
            )}
          </View>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
