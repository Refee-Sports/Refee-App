import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { cleanCode, confirmEmailChange, EMAIL_CODE_LENGTH, requestEmailChange } from "@/lib/auth/emailCode";

/** Shows the account's email and moves it to a new address with a 6-digit code. */
export function ChangeEmail() {
  const [current, setCurrent] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "enter" | "code">("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setCurrent(data.user?.email ?? null));
  }, []);

  const send = async () => {
    Haptics.selectionAsync();
    setBusy(true);
    setError(null);
    const result = await requestEmailChange(email);
    setBusy(false);
    if (result.error) setError(result.error.message);
    else setStep("code");
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = await confirmEmailChange(email, code);
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const { data } = await supabase.auth.getUser();
    setCurrent(data.user?.email ?? email);
    setStep("idle");
    setEmail("");
    setCode("");
    setDone(true);
  };

  return (
    <View className="mt-8 border border-ink bg-chalk p-5">
      <Text className="font-mono-bold text-[11px] uppercase">Email</Text>
      <Text className="mt-3 font-mono text-[13px]">{current ?? "No email on this account"}</Text>
      {done ? (
        <Text className="mt-2 text-court-ink text-[13px]">Email updated. Use it next time you sign in with a code.</Text>
      ) : null}

      {step === "idle" ? (
        <Pressable
          onPress={() => {
            setStep("enter");
            setDone(false);
          }}
          className="mt-4 border border-ink px-4 py-4"
        >
          <Text className="font-mono-bold text-[10px] uppercase text-center">Change email</Text>
        </Pressable>
      ) : null}

      {step === "enter" ? (
        <View className="mt-4">
          <Text className="font-mono-bold text-[10px] uppercase">New email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            className="mt-2 border border-ink bg-paper px-3 py-3 font-mono text-[14px]"
          />
          <Text className="mt-2 text-ink-60 text-[12px] leading-[18px]">
            We&apos;ll send a code to the new address. Your old address gets a notice once the change goes through.
          </Text>
          <Pressable
            disabled={busy || !email}
            onPress={() => void send()}
            className="mt-4 bg-ink px-4 py-4 disabled:opacity-40"
          >
            <Text className="font-mono-bold text-[10px] uppercase text-paper text-center">
              {busy ? "Sending…" : "Send code"}
            </Text>
          </Pressable>
          <Pressable onPress={() => setStep("idle")} className="mt-3 py-2">
            <Text className="font-mono-bold text-[10px] uppercase underline text-center">Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {step === "code" ? (
        <View className="mt-4">
          <Text className="font-mono-bold text-[10px] uppercase">Code sent to {email.trim().toLowerCase()}</Text>
          <TextInput
            value={code}
            onChangeText={(value) => setCode(cleanCode(value))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={EMAIL_CODE_LENGTH}
            className="mt-2 border border-ink bg-paper px-3 py-3 font-mono text-[18px] tracking-[6px]"
          />
          <Pressable
            disabled={busy || code.length !== EMAIL_CODE_LENGTH}
            onPress={() => void confirm()}
            className="mt-4 bg-ink px-4 py-4 disabled:opacity-40"
          >
            <Text className="font-mono-bold text-[10px] uppercase text-paper text-center">
              {busy ? "Checking…" : "Confirm new email"}
            </Text>
          </Pressable>
          <Pressable onPress={() => setStep("enter")} className="mt-3 py-2">
            <Text className="font-mono-bold text-[10px] uppercase underline text-center">Use a different email</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <Text className="mt-4 border border-foul bg-foul/10 p-3 text-foul-ink text-[13px]">{error}</Text>
      ) : null}
    </View>
  );
}
