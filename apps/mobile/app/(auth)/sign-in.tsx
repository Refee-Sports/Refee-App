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
import { signInWithAppleOAuth, signInWithGoogleOAuth } from "@/lib/oauth";
import { isValidEmail, normalizeEmail, sendEmailCode } from "@/lib/auth/emailCode";
import { getSupabaseConfig, isLocalSupabaseUrl } from "@/lib/supabase-config";
import { getSupabaseSetupError, supabase } from "@/lib/supabase";

/**
 * Sign in with Apple, Google, or a one-time code emailed to you. No passwords,
 * no SMS.
 */
export default function SignIn() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { url: supabaseUrl } = getSupabaseConfig();
  const supabaseHost = supabaseUrl.replace(/^https?:\/\//, "");

  const canSubmit = isValidEmail(email);
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
    if (!canSubmit || sending) return;
    setSending(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const setupErr = getSupabaseSetupError();
    if (setupErr) {
      setSending(false);
      setError(setupErr);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Drop any stale session so the code signs in the account it was sent to.
    await supabase.auth.signOut();

    const { error: sendError } = await sendEmailCode(email);
    setSending(false);
    if (sendError) {
      setError(sendError.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    router.push({
      pathname: "/(auth)/verify",
      params: { email: normalizeEmail(email) },
    });
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
            <Text className="text-ink-60 font-mono-bold text-[9px] uppercase" style={{ letterSpacing: 2 }}>
              or use your email
            </Text>
            <View className="flex-1 h-px bg-ink/15" />
          </View>
        </View>

        <View className="px-5">
          <Text className="text-signal font-mono-bold text-[10px] uppercase mt-2 mb-3" style={{ letterSpacing: 2 }}>
            EMAIL · STEP 1
          </Text>
          <Text className="text-ink font-display" style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1.5 }}>
            ENTER YOUR{"\n"}
            <Text className="text-signal">EMAIL.</Text>
          </Text>
          <Text className="text-ink-80 mt-3 mb-6" style={{ fontSize: 14, lineHeight: 20 }}>
            We&apos;ll email you a 6-digit code. No passwords. New here? The same code creates your account.
          </Text>

          {__DEV__ && supabaseHost ? (
            <Text className="text-ink-40 font-mono text-[9px] uppercase mb-4" style={{ letterSpacing: 1.2 }}>
              DEV · API {supabaseHost}
              {isLocalSupabaseUrl(supabaseUrl) ? " · LOCAL — CODES ARRIVE AT http://127.0.0.1:54324" : " · HOSTED"}
            </Text>
          ) : null}

          <Text className="text-ink-60 font-mono-bold text-[9px] uppercase mb-2" style={{ letterSpacing: 2 }}>
            EMAIL ADDRESS
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="rgba(8,17,28,0.36)"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            editable={!oauthBusy}
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
            className="border-[1.5px] border-ink bg-chalk px-4 py-3.5 text-ink font-mono"
            style={{ fontSize: 14 }}
          />

          {error && <Text className="text-foul font-mono text-xs mt-3 uppercase">{error}</Text>}

          <Text className="text-ink-60 font-mono text-[9px] mt-4 uppercase" style={{ letterSpacing: 1.4 }}>
            BY CONTINUING YOU AGREE TO REFEE&apos;S TERMS &amp; PRIVACY POLICY.
          </Text>
        </View>
      </ScrollView>

      <View className="border-t-[1.5px] border-ink bg-paper px-4 pt-3" style={{ paddingBottom: insets.bottom + 16 }}>
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || sending || oauthBusy}
          className={`py-4 ${canSubmit && !sending && !oauthBusy ? "bg-ink" : "bg-ink-20"} active:opacity-80`}
        >
          <View className="flex-row justify-center items-center gap-2">
            {sending ? (
              <ActivityIndicator color="#E5E1D6" />
            ) : (
              <>
                <Text
                  className={`font-mono-bold ${canSubmit && !oauthBusy ? "text-paper" : "text-ink-40"}`}
                  style={{ fontSize: 12, letterSpacing: 2.5 }}
                >
                  EMAIL ME A CODE
                </Text>
                <Text className={`font-mono-bold text-base ${canSubmit && !oauthBusy ? "text-paper" : "text-ink-40"}`}>
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
