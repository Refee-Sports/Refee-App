import { useState } from "react";
import {
  Text,
  TextInput,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ScrollScreen } from "@/components/layout/ScrollScreen";
import { getSupabaseSetupError, supabase } from "@/lib/supabase";
import { createAssignorProfile } from "@/lib/assignor/queries";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";
import { REGION_CODE_ERROR, US_STATES } from "@refee/core/geo/regions";
import { dateOfBirthError, isAdult, usDateInput } from "@refee/core/identity/age";


const STEPS = ["NAME", "LOCATION"];

type FormData = {
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  /** Date of birth as typed on the keypad: MMDDYYYY digits. */
  dobDigits: string;
};

export default function AssignorOnboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setProfileComplete, setPrimaryRole } = useOnboardingStore();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    city: "",
    state: "",
    dobDigits: "",
  });

  const set = (key: keyof FormData) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const canAdvance = [
    form.firstName.trim().length >= 1 &&
      form.lastName.trim().length >= 1 &&
      isAdult(usDateInput(form.dobDigits).iso),
    form.city.trim().length >= 1 && US_STATES.includes(form.state.toUpperCase()),
  ];

  const handleNext = () => {
    Haptics.selectionAsync();
    setError(null);
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    Haptics.selectionAsync();
    setError(null);
    if (step === 0) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  };

  const handleSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError(null);

    try {
      const setupErr = getSupabaseSetupError();
      if (setupErr) {
        setError(setupErr);
        setLoading(false);
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!user || userError) {
        await supabase.auth.signOut();
        return;
      }

      const { error: saveError } = await createAssignorProfile(user.id, {
        firstName: form.firstName.trim(),
        lastInitial: form.lastName.trim()[0]?.toUpperCase() ?? "?",
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
        dateOfBirth: usDateInput(form.dobDigits).iso,
        legalFirstName: form.firstName.trim(),
        legalLastName: form.lastName.trim(),
      });

      if (saveError) {
        setError(saveError.message || "Something went wrong. Please try again.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setLoading(false);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setProfileComplete(true);
      setPrimaryRole("assignor");
      // Then go and prove who they are — nobody can staff a game until that's
      // done. Skipping lands them in the app, not a dead end.
      router.replace("/verify" as any);
    } catch (err: any) {
      setError(err?.message ?? "An unexpected error occurred.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoading(false);
    }
  };

  const handleExit = () => {
    Alert.alert(
      "Leave setup?",
      "You can finish your profile next time you sign in.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => { await supabase.auth.signOut(); },
        },
      ]
    );
  };

  const isLastStep = step === 1;
  const progress = (step + 1) / 2;

  return (
    <ScrollScreen
      keyboard
      header={
        <>
          <View className="flex-row items-center justify-between px-5 py-3">
            <Pressable
              onPress={handleBack}
              className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70"
            >
              <Text className="text-ink font-mono-bold text-base">←</Text>
            </Pressable>
            <Text
              className="text-ink-60 font-mono-bold text-[9px] uppercase"
              style={{ letterSpacing: 2 }}
            >
              <Text className="text-ink">{String(step + 1).padStart(2, "0")}</Text>
              {" / 02 · ASSIGNOR"}
            </Text>
            <Pressable
              onPress={handleExit}
              className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70"
            >
              <Text className="text-ink font-mono-bold text-base">✕</Text>
            </Pressable>
          </View>
          <View className="h-0.5 bg-ink-20 mx-5">
            <View
              className="h-full bg-signal"
              style={{ width: `${progress * 100}%` }}
            />
          </View>
        </>
      }
      footer={
        <View
          className="border-t-[1.5px] border-ink bg-paper px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          {error && (
            <Text
              className="text-foul font-mono text-[10px] uppercase mb-3"
              style={{ letterSpacing: 1 }}
            >
              {error}
            </Text>
          )}
          <Pressable
            onPress={isLastStep ? handleSubmit : handleNext}
            disabled={!canAdvance[step] || loading}
            className={`py-4 ${canAdvance[step] && !loading ? "bg-ink" : "bg-ink-20"} active:opacity-80`}
          >
            <View className="flex-row justify-center items-center gap-2">
              {loading ? (
                <ActivityIndicator color="#E5E1D6" />
              ) : (
                <>
                  <Text
                    className={`font-mono-bold ${canAdvance[step] ? "text-paper" : "text-ink-40"}`}
                    style={{ fontSize: 12, letterSpacing: 2.5 }}
                  >
                    {isLastStep ? "CREATE ACCOUNT" : "NEXT"}
                  </Text>
                  <Text
                    className={`font-mono-bold text-base ${canAdvance[step] ? "text-paper" : "text-ink-40"}`}
                  >
                    →
                  </Text>
                </>
              )}
            </View>
          </Pressable>
        </View>
      }
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20 }}
    >
      <Text
        className="text-signal font-mono-bold text-[10px] uppercase mb-3"
        style={{ letterSpacing: 2 }}
      >
        {STEPS[step]} · STEP {step + 1} OF 2
      </Text>

      {step === 0 && <NameStep form={form} set={set} />}
      {step === 1 && <LocationStep form={form} set={set} />}
    </ScrollScreen>
  );
}

function NameStep({
  form,
  set,
}: {
  form: FormData;
  set: (k: keyof FormData) => (v: string) => void;
}) {
  return (
    <View>
      <Text
        className="text-ink font-display"
        style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1.5 }}
      >
        {"YOUR\n"}
        <Text className="text-signal">NAME</Text>
      </Text>
      <Text className="text-ink-80 mt-3 mb-7" style={{ fontSize: 14, lineHeight: 20 }}>
        This is how directors and your roster of referees will see you.
      </Text>

      <DLabel>FIRST NAME</DLabel>
      <DInput value={form.firstName} onChangeText={set("firstName")} placeholder="Morgan" autoFocus autoCapitalize="words" />

      <DLabel style={{ marginTop: 16 }}>LAST NAME</DLabel>
      <DInput value={form.lastName} onChangeText={set("lastName")} placeholder="Ellis" autoCapitalize="words" />

      <DLabel style={{ marginTop: 16 }}>DATE OF BIRTH</DLabel>
      <DInput
        value={usDateInput(form.dobDigits).display}
        onChangeText={set("dobDigits")}
        placeholder="MM/DD/YYYY"
        keyboardType="number-pad"
        maxLength={10}
        error={dateOfBirthError(usDateInput(form.dobDigits).iso) ?? undefined}
      />
      <Text className="text-ink-60 font-mono text-[9px] mt-1 uppercase" style={{ letterSpacing: 1 }}>
        Refee is 18+. We check this against your ID.
      </Text>

      {form.firstName.trim() && form.lastName.trim() ? (
        <View className="mt-5 border border-signal/30 bg-signal/5 px-3.5 py-2.5 flex-row items-center gap-2">
          <Text className="text-signal font-mono text-base">▸</Text>
          <Text className="text-ink-80 font-mono text-xs" style={{ letterSpacing: 0.5 }}>
            OTHERS WILL SEE:{" "}
            <Text className="text-ink font-mono-bold">
              {form.firstName.trim()} {form.lastName.trim()[0].toUpperCase()}.
            </Text>
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function LocationStep({
  form,
  set,
}: {
  form: FormData;
  set: (k: keyof FormData) => (v: string) => void;
}) {
  const stateVal = form.state.toUpperCase();
  const stateValid = US_STATES.includes(stateVal);
  return (
    <View>
      <Text
        className="text-ink font-display"
        style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1.5 }}
      >
        {"WHERE ARE\n"}
        <Text className="text-signal">YOU BASED?</Text>
      </Text>
      <Text className="text-ink-80 mt-3 mb-7" style={{ fontSize: 14, lineHeight: 20 }}>
        Directors looking for a local staffing partner will find you here.
      </Text>

      <DLabel>CITY</DLabel>
      <DInput value={form.city} onChangeText={set("city")} placeholder="Austin" autoFocus autoCapitalize="words" />

      <DLabel style={{ marginTop: 16 }}>STATE (2-LETTER CODE)</DLabel>
      <DInput
        value={form.state}
        onChangeText={(v) => set("state")(v.toUpperCase().slice(0, 2))}
        placeholder="TX"
        autoCapitalize="characters"
        maxLength={2}
        error={form.state.length === 2 && !stateValid ? REGION_CODE_ERROR : undefined}
      />

      <View className="mt-6 border border-ink-20 bg-chalk px-4 py-3.5">
        <Text className="font-mono-bold text-[9px] text-ink-60 uppercase mb-1" style={{ letterSpacing: 1.5 }}>
          NEXT UP
        </Text>
        <Text className="font-mono text-[11px] text-ink-80" style={{ letterSpacing: 0.3 }}>
          Build your referee roster and wait for directors to invite you to staff their tournaments — or ask a director you already work with to invite you.
        </Text>
      </View>
    </View>
  );
}

function DLabel({ children, style }: { children: string; style?: object }) {
  return (
    <Text
      className="text-ink-60 font-mono-bold text-[9px] uppercase mb-2"
      style={[{ letterSpacing: 2 }, style]}
    >
      {children}
    </Text>
  );
}

function DInput({
  error,
  ...props
}: React.ComponentProps<typeof TextInput> & { error?: string }) {
  return (
    <>
      <TextInput
        placeholderTextColor="rgba(8,17,28,0.36)"
        className={`border-[1.5px] bg-chalk px-4 py-3.5 text-ink font-mono ${
          error ? "border-foul" : "border-ink"
        }`}
        style={{ fontSize: 14 }}
        {...props}
      />
      {error ? (
        <Text className="text-foul font-mono text-[9px] mt-1 uppercase" style={{ letterSpacing: 1 }}>
          {error}
        </Text>
      ) : null}
    </>
  );
}
