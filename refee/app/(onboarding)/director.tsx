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
import { createDirectorProfile } from "@/lib/director/queries";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const ORG_TYPES = [
  { id: "tournament", label: "TOURNAMENT" },
  { id: "league",     label: "LEAGUE" },
  { id: "school",     label: "SCHOOL / UNIVERSITY" },
  { id: "parks_rec",  label: "PARKS & REC" },
];

const STEPS = ["NAME", "ORGANIZATION", "LOCATION"];

type FormData = {
  firstName: string;
  lastName: string;
  orgName: string;
  orgType: string;
  city: string;
  state: string;
};

export default function DirectorOnboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setProfileComplete, setPrimaryRole } = useOnboardingStore();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    orgName: "",
    orgType: "",
    city: "",
    state: "",
  });

  const set = (key: keyof FormData) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const canAdvance = [
    form.firstName.trim().length >= 1 && form.lastName.trim().length >= 1,
    form.orgName.trim().length >= 1 && !!form.orgType,
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

      const { error: saveError } = await createDirectorProfile(user.id, {
        contactFirstName: form.firstName.trim(),
        contactLastInitial: form.lastName.trim()[0]?.toUpperCase() ?? "?",
        orgName: form.orgName.trim(),
        orgType: form.orgType,
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
      });

      if (saveError) {
        setError(saveError.message || "Something went wrong. Please try again.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setLoading(false);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setProfileComplete(true);
      setPrimaryRole("director");
      router.replace("/(director)/(tabs)/tournaments" as any);
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

  const isLastStep = step === 2;
  const progress = (step + 1) / 3;

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
              {" / 03 · DIRECTOR"}
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
        {STEPS[step]} · STEP {step + 1} OF 3
      </Text>

      {step === 0 && (
        <NameStep form={form} set={set} />
      )}
      {step === 1 && (
        <OrgStep form={form} set={set} onSelectType={(t) => setForm((f) => ({ ...f, orgType: t }))} />
      )}
      {step === 2 && (
        <LocationStep form={form} set={set} />
      )}
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
        <Text className="text-signal">CONTACT{"\n"}NAME</Text>
      </Text>
      <Text className="text-ink-80 mt-3 mb-7" style={{ fontSize: 14, lineHeight: 20 }}>
        This is how you&apos;ll appear to referees on the platform.
      </Text>

      <DLabel>FIRST NAME</DLabel>
      <DInput value={form.firstName} onChangeText={set("firstName")} placeholder="Jordan" autoFocus autoCapitalize="words" />

      <DLabel style={{ marginTop: 16 }}>LAST NAME</DLabel>
      <DInput value={form.lastName} onChangeText={set("lastName")} placeholder="Taylor" autoCapitalize="words" />

      {form.firstName.trim() && form.lastName.trim() ? (
        <View className="mt-5 border border-signal/30 bg-signal/5 px-3.5 py-2.5 flex-row items-center gap-2">
          <Text className="text-signal font-mono text-base">▸</Text>
          <Text className="text-ink-80 font-mono text-xs" style={{ letterSpacing: 0.5 }}>
            REFS WILL SEE:{" "}
            <Text className="text-ink font-mono-bold">
              {form.firstName.trim()} {form.lastName.trim()[0].toUpperCase()}.
            </Text>
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function OrgStep({
  form,
  set,
  onSelectType,
}: {
  form: FormData;
  set: (k: keyof FormData) => (v: string) => void;
  onSelectType: (t: string) => void;
}) {
  return (
    <View>
      <Text
        className="text-ink font-display"
        style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1.5 }}
      >
        {"YOUR\n"}
        <Text className="text-signal">ORGANIZATION</Text>
      </Text>
      <Text className="text-ink-80 mt-3 mb-7" style={{ fontSize: 14, lineHeight: 20 }}>
        Tell us about your event or organization. This is shown on all of your game postings.
      </Text>

      <DLabel>ORGANIZATION NAME</DLabel>
      <DInput
        value={form.orgName}
        onChangeText={set("orgName")}
        placeholder="Austin Hoops Classic"
        autoFocus
        autoCapitalize="words"
      />

      <DLabel style={{ marginTop: 20 }}>ORGANIZATION TYPE</DLabel>
      <View className="gap-1.5 mt-1">
        {ORG_TYPES.map((t) => {
          const selected = form.orgType === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => onSelectType(t.id)}
              className={`border-[1.5px] px-4 py-3.5 flex-row items-center justify-between active:opacity-70 ${
                selected ? "border-signal bg-signal/10" : "border-ink bg-chalk"
              }`}
            >
              <Text
                className={`font-mono-bold text-sm ${selected ? "text-signal" : "text-ink"}`}
                style={{ letterSpacing: 1 }}
              >
                {t.label}
              </Text>
              {selected && <Text className="text-signal font-mono-bold text-base">✓</Text>}
            </Pressable>
          );
        })}
      </View>
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
        Your primary market helps referees find your tournaments.
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
        error={form.state.length === 2 && !stateValid ? "Enter a valid US state code" : undefined}
      />
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
