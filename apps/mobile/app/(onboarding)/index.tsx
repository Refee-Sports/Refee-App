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
import { saveFullProfile, CertEntry } from "@/lib/profile/queries";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";
import { REGION_CODE_ERROR, US_STATES } from "@refee/core/geo/regions";
import { dateOfBirthError, isAdult, usDateInput } from "@refee/core/identity/age";


const SPORTS = [{ id: "basketball", label: "BASKETBALL" }];

const CERT_BODIES = [
  { id: "iaabo", label: "IAABO", full: "Intl. Association of Approved Basketball Officials" },
  { id: "nfhs",  label: "NFHS",  full: "National Federation of State High School Associations" },
  { id: "ncaa",  label: "NCAA",  full: "NCAA College Officials Program" },
  { id: "fiba",  label: "FIBA",  full: "International Basketball Federation" },
];

const LEVELS = [
  { id: "youth_rec",   label: "Youth League / Rec",  tier: "AMATEUR" },
  { id: "high_school", label: "High School",          tier: "AMATEUR" },
  { id: "juco",        label: "JUCO",                 tier: "COLLEGE" },
  { id: "naia",        label: "NAIA",                 tier: "COLLEGE" },
  { id: "ncaa_mens",   label: "NCAA Men's",           tier: "COLLEGE" },
  { id: "ncaa_womens", label: "NCAA Women's",         tier: "COLLEGE" },
  { id: "pro_am",      label: "Pro-Am",               tier: "PRO" },
];

const STEP_LABELS = ["NAME", "LOCATION", "SPORT", "RATE", "CERTIFICATIONS", "LEVELS"];
const STEP_NUMBERS = ["03", "04", "05", "06", "07", "08"];

type StringFormKey = "firstName" | "lastName" | "city" | "state" | "sportId" | "yearsExperience" | "minPay" | "travelRadius" | "dobDigits";
type StringSetter = (k: StringFormKey) => (v: string) => void;

type FormData = {
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  sportId: string;
  yearsExperience: string;
  minPay: string;
  travelRadius: string;
  certs: CertEntry[];
  levels: string[];
  /** Date of birth as typed on the keypad: MMDDYYYY digits. */
  dobDigits: string;
};

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setProfileComplete = useOnboardingStore((s) => s.setProfileComplete);
  const setPrimaryRole = useOnboardingStore((s) => s.setPrimaryRole);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    city: "",
    state: "",
    sportId: "basketball",
    yearsExperience: "",
    minPay: "35",
    travelRadius: "25",
    certs: [],
    levels: [],
    dobDigits: "",
  });

  const set: StringSetter = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const toggleCert = (bodyId: string) =>
    setForm((f) => {
      const exists = f.certs.find((c) => c.bodyId === bodyId);
      return {
        ...f,
        certs: exists
          ? f.certs.filter((c) => c.bodyId !== bodyId)
          : [...f.certs, { bodyId, licenseNumber: "" }],
      };
    });

  const setCertLicense = (bodyId: string, licenseNumber: string) =>
    setForm((f) => ({
      ...f,
      certs: f.certs.map((c) => (c.bodyId === bodyId ? { ...c, licenseNumber } : c)),
    }));

  const toggleLevel = (levelId: string) =>
    setForm((f) => ({
      ...f,
      levels: f.levels.includes(levelId)
        ? f.levels.filter((l) => l !== levelId)
        : [...f.levels, levelId],
    }));

  // ── Validation per step ──────────────────────────────────────────────────
  const canAdvance = [
    form.firstName.trim().length >= 1 &&
      form.lastName.trim().length >= 1 &&
      isAdult(usDateInput(form.dobDigits).iso),
    form.city.trim().length >= 1 && US_STATES.includes(form.state.toUpperCase()),
    !!form.sportId,
    parseInt(form.minPay, 10) >= 1 && parseInt(form.travelRadius, 10) >= 1,
    true, // certs are optional
    form.levels.length >= 1,
  ];

  const handleNext = () => {
    Haptics.selectionAsync();
    setError(null);
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    Haptics.selectionAsync();
    setError(null);
    setStep((s) => s - 1);
  };

  const handleExit = () => {
    Haptics.selectionAsync();
    Alert.alert(
      "Leave setup?",
      "You can finish your profile next time you sign in.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
          },
        },
      ]
    );
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!user || userError) {
        // Stale/invalid session — sign out so AuthGate redirects to sign-in.
        await supabase.auth.signOut();
        return;
      }

      const lastName = form.lastName.trim();
      const lastInitial = lastName.length > 0 ? lastName[0].toUpperCase() : "?";

      const { error: saveError } = await saveFullProfile(user.id, {
        firstName: form.firstName.trim(),
        lastInitial,
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
        sportId: form.sportId,
        yearsExperience: parseInt(form.yearsExperience || "0", 10),
        minPayPerGame: parseInt(form.minPay, 10),
        travelRadiusMiles: parseInt(form.travelRadius, 10),
        certs: form.certs,
        levelIds: form.levels,
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
      // Set role BEFORE profileComplete so the root layout keeps the navigator
      // mounted (splashReady requires primaryRole once profileComplete is true),
      // then let the AuthGate route into the app.
      setPrimaryRole("referee");
      setProfileComplete(true);
      // Then go and prove who they are — a referee can't take a game until
      // that's done. Skipping lands them in the app, not a dead end.
      router.replace("/verify" as any);
    } catch (err: any) {
      setError(err?.message ?? "An unexpected error occurred. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoading(false);
    }
  };

  // ── Step content ─────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 0: return <NameStep form={form} set={set} />;
      case 1: return <LocationStep form={form} set={set} />;
      case 2: return <SportStep form={form} set={set} />;
      case 3: return <RateStep form={form} set={set} />;
      case 4: return <CertStep certs={form.certs} onToggle={toggleCert} onSetLicense={setCertLicense} />;
      case 5: return <LevelStep selectedLevels={form.levels} onToggle={toggleLevel} />;
    }
  };

  const isLastStep = step === 5;

  return (
    <ScrollScreen
      keyboard
      header={
        <>
          <View className="flex-row items-center justify-between px-5 py-3">
            <Pressable
              onPress={step === 0 ? handleExit : handleBack}
              className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70"
            >
              <Text className="text-ink font-mono-bold text-base">←</Text>
            </Pressable>
            <Text
              className="text-ink-60 font-mono-bold text-[9px] uppercase"
              style={{ letterSpacing: 2 }}
            >
              <Text className="text-ink">{STEP_NUMBERS[step]}</Text> / 08
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
              style={{ width: `${((step + 1) / 6) * 100}%` }}
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
                    {isLastStep ? "FINISH SETUP" : "NEXT"}
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
          {step === 0 ? (
            <Pressable onPress={handleExit} className="mt-3 py-2 active:opacity-70">
              <Text
                className="text-signal text-center font-mono-bold text-[11px] uppercase underline"
                style={{ letterSpacing: 1.5 }}
              >
                Use a different account
              </Text>
            </Pressable>
          ) : null}
        </View>
      }
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20 }}
    >
      <Text
        className="text-signal font-mono-bold text-[10px] uppercase mb-3"
        style={{ letterSpacing: 2 }}
      >
        {STEP_LABELS[step]} · STEP {step + 3}
      </Text>

      {renderStep()}
    </ScrollScreen>
  );
}

// ── Step sub-components ────────────────────────────────────────────────────

function NameStep({ form, set }: { form: FormData; set: StringSetter }) {
  return (
    <View>
      <Text
        className="text-ink font-display"
        style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1.5 }}
      >
        WHAT&apos;S YOUR{"\n"}
        <Text className="text-signal">NAME?</Text>
      </Text>
      <Text className="text-ink-80 mt-3 mb-7" style={{ fontSize: 14, lineHeight: 20 }}>
        We show your first name and last initial to organizers — never your full last name.
      </Text>

      <Label>FIRST NAME</Label>
      <StyledInput
        value={form.firstName}
        onChangeText={set("firstName")}
        placeholder="Jordan"
        autoFocus
        autoCapitalize="words"
      />

      <Label style={{ marginTop: 16 }}>LAST NAME</Label>
      <StyledInput
        value={form.lastName}
        onChangeText={set("lastName")}
        placeholder="Taylor"
        autoCapitalize="words"
      />

      <Label style={{ marginTop: 16 }}>DATE OF BIRTH</Label>
      <StyledInput
        value={usDateInput(form.dobDigits).display}
        onChangeText={set("dobDigits")}
        placeholder="MM/DD/YYYY"
        keyboardType="number-pad"
        maxLength={10}
        error={dateOfBirthError(usDateInput(form.dobDigits).iso) ?? undefined}
        hint="Refee is 18+. We check this against your ID."
      />

      {form.firstName.trim() && form.lastName.trim() ? (
        <View className="mt-5 border border-signal/30 bg-signal/5 px-3.5 py-2.5 flex-row items-center gap-2">
          <Text className="text-signal font-mono text-base">▸</Text>
          <Text className="text-ink-80 font-mono text-xs" style={{ letterSpacing: 0.5 }}>
            YOU&apos;LL APPEAR AS:{" "}
            <Text className="text-ink font-mono-bold">
              {form.firstName.trim()} {form.lastName.trim()[0].toUpperCase()}.
            </Text>
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function LocationStep({ form, set }: { form: FormData; set: StringSetter }) {
  const stateVal = form.state.toUpperCase();
  const stateValid = US_STATES.includes(stateVal);

  return (
    <View>
      <Text
        className="text-ink font-display"
        style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1.5 }}
      >
        WHERE DO{"\n"}
        <Text className="text-signal">YOU REF?</Text>
      </Text>
      <Text className="text-ink-80 mt-3 mb-7" style={{ fontSize: 14, lineHeight: 20 }}>
        Your city and state help organizers find officials in their area.
      </Text>

      <Label>CITY</Label>
      <StyledInput
        value={form.city}
        onChangeText={set("city")}
        placeholder="Austin"
        autoFocus
        autoCapitalize="words"
      />

      <Label style={{ marginTop: 16 }}>STATE (2-LETTER CODE)</Label>
      <StyledInput
        value={form.state}
        onChangeText={(v) => set("state")(v.toUpperCase().slice(0, 2))}
        placeholder="TX"
        autoCapitalize="characters"
        maxLength={2}
        error={form.state.length === 2 && !stateValid ? REGION_CODE_ERROR : undefined}
      />
    </View>
  );
}

function SportStep({ form, set }: { form: FormData; set: StringSetter }) {
  return (
    <View>
      <Text
        className="text-ink font-display"
        style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1.5 }}
      >
        WHAT DO{"\n"}
        <Text className="text-signal">YOU REF?</Text>
      </Text>
      <Text className="text-ink-80 mt-3 mb-7" style={{ fontSize: 14, lineHeight: 20 }}>
        Select your sport. More sports will be added in future updates.
      </Text>

      <Label>SPORT</Label>
      <View className="gap-2 mt-1">
        {SPORTS.map((s) => {
          const selected = form.sportId === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => set("sportId")(s.id)}
              className={`border-[1.5px] px-4 py-4 flex-row items-center justify-between active:opacity-70
                ${selected ? "border-signal bg-signal/10" : "border-ink bg-chalk"}`}
            >
              <Text
                className={`font-mono-bold text-sm ${selected ? "text-signal" : "text-ink"}`}
                style={{ letterSpacing: 1 }}
              >
                {s.label}
              </Text>
              {selected && (
                <Text className="text-signal font-mono-bold text-base">✓</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <Label style={{ marginTop: 20 }}>YEARS OF EXPERIENCE</Label>
      <StyledInput
        value={form.yearsExperience}
        onChangeText={(v) => set("yearsExperience")(v.replace(/\D/g, "").slice(0, 2))}
        placeholder="5"
        keyboardType="number-pad"
        hint="How many years have you been officiating this sport?"
      />
    </View>
  );
}

function RateStep({ form, set }: { form: FormData; set: StringSetter }) {
  return (
    <View>
      <Text
        className="text-ink font-display"
        style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1.5 }}
      >
        SET YOUR{"\n"}
        <Text className="text-signal">FLOOR.</Text>
      </Text>
      <Text className="text-ink-80 mt-3 mb-7" style={{ fontSize: 14, lineHeight: 20 }}>
        Your minimum rate keeps low-ball offers off your feed. You can update this anytime.
      </Text>

      <Label>MIN PAY PER GAME ($)</Label>
      <View className="flex-row border-[1.5px] border-ink">
        <View className="bg-ink px-4 justify-center">
          <Text className="text-paper font-mono-bold text-base" style={{ letterSpacing: 0.5 }}>
            $
          </Text>
        </View>
        <TextInput
          value={form.minPay}
          onChangeText={(v) => set("minPay")(v.replace(/\D/g, "").slice(0, 4))}
          placeholder="35"
          placeholderTextColor="rgba(8,17,28,0.36)"
          keyboardType="number-pad"
          className="flex-1 bg-chalk px-4 py-3.5 text-ink font-mono"
          style={{ fontSize: 14 }}
        />
      </View>
      <Text
        className="text-ink-60 font-mono text-[9px] mt-1.5 uppercase"
        style={{ letterSpacing: 1.2 }}
      >
        JOBS BELOW THIS RATE WON&apos;T APPEAR IN YOUR FEED
      </Text>

      <Label style={{ marginTop: 20 }}>TRAVEL RADIUS (MILES)</Label>
      <View className="flex-row border-[1.5px] border-ink">
        <TextInput
          value={form.travelRadius}
          onChangeText={(v) => set("travelRadius")(v.replace(/\D/g, "").slice(0, 3))}
          placeholder="25"
          placeholderTextColor="rgba(8,17,28,0.36)"
          keyboardType="number-pad"
          className="flex-1 bg-chalk px-4 py-3.5 text-ink font-mono"
          style={{ fontSize: 14 }}
        />
        <View className="bg-ink px-4 justify-center">
          <Text className="text-paper font-mono-bold text-sm" style={{ letterSpacing: 0.5 }}>
            MI
          </Text>
        </View>
      </View>
      <Text
        className="text-ink-60 font-mono text-[9px] mt-1.5 uppercase"
        style={{ letterSpacing: 1.2 }}
      >
        HOW FAR YOU&apos;RE WILLING TO TRAVEL FROM YOUR CITY
      </Text>
    </View>
  );
}

function CertStep({
  certs,
  onToggle,
  onSetLicense,
}: {
  certs: CertEntry[];
  onToggle: (bodyId: string) => void;
  onSetLicense: (bodyId: string, license: string) => void;
}) {
  return (
    <View>
      <Text
        className="text-ink font-display"
        style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1.5 }}
      >
        ANY{"\n"}
        <Text className="text-signal">CERTS?</Text>
      </Text>
      <Text className="text-ink-80 mt-3 mb-7" style={{ fontSize: 14, lineHeight: 20 }}>
        Select any officiating certifications you hold. You can add more later. Skip if none.
      </Text>

      <Label>CERTIFICATION BODY</Label>
      <View className="gap-2 mt-1">
        {CERT_BODIES.map((body) => {
          const entry = certs.find((c) => c.bodyId === body.id);
          const selected = !!entry;
          return (
            <View key={body.id}>
              <Pressable
                onPress={() => onToggle(body.id)}
                className={`border-[1.5px] px-4 py-3.5 flex-row items-center justify-between active:opacity-70
                  ${selected ? "border-signal bg-signal/10" : "border-ink bg-chalk"}`}
              >
                <View className="flex-1 pr-3">
                  <Text
                    className={`font-mono-bold text-sm ${selected ? "text-signal" : "text-ink"}`}
                    style={{ letterSpacing: 1 }}
                  >
                    {body.label}
                  </Text>
                  <Text
                    className={`font-mono text-[9px] mt-0.5 ${selected ? "text-signal/70" : "text-ink-60"}`}
                    style={{ letterSpacing: 0.5 }}
                    numberOfLines={1}
                  >
                    {body.full}
                  </Text>
                </View>
                {selected && <Text className="text-signal font-mono-bold text-base">✓</Text>}
              </Pressable>

              {selected && (
                <View className="border-x-[1.5px] border-b-[1.5px] border-signal bg-chalk px-4 py-2.5">
                  <Text
                    className="text-ink-60 font-mono-bold text-[9px] uppercase mb-1.5"
                    style={{ letterSpacing: 1.5 }}
                  >
                    LICENSE # (OPTIONAL)
                  </Text>
                  <TextInput
                    value={entry.licenseNumber}
                    onChangeText={(v) => onSetLicense(body.id, v)}
                    placeholder="e.g. 123456"
                    placeholderTextColor="rgba(8,17,28,0.36)"
                    autoCapitalize="characters"
                    className="text-ink font-mono border border-ink-20 bg-paper px-3 py-2"
                    style={{ fontSize: 13 }}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View className="mt-5 border border-dashed border-ink-40 px-3.5 py-3 flex-row gap-2.5">
        <Text className="text-ink-60 font-mono text-base">▸</Text>
        <Text className="text-ink-60 font-mono text-[10px] flex-1" style={{ lineHeight: 15 }}>
          NO CERT YET? NO PROBLEM. HIT NEXT TO SKIP — YOU CAN ADD CERTIFICATIONS FROM YOUR PROFILE LATER.
        </Text>
      </View>
    </View>
  );
}

function LevelStep({
  selectedLevels,
  onToggle,
}: {
  selectedLevels: string[];
  onToggle: (levelId: string) => void;
}) {
  const tiers = ["AMATEUR", "COLLEGE", "PRO"] as const;

  return (
    <View>
      <Text
        className="text-ink font-display"
        style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1.5 }}
      >
        WHAT LEVELS{"\n"}
        <Text className="text-signal">DO YOU WORK?</Text>
      </Text>
      <Text className="text-ink-80 mt-3 mb-7" style={{ fontSize: 14, lineHeight: 20 }}>
        Select all that apply. This helps organizers match you to the right games.
      </Text>

      {tiers.map((tier) => {
        const tierLevels = LEVELS.filter((l) => l.tier === tier);
        return (
          <View key={tier} className="mb-5">
            <Text
              className="text-ink-40 font-mono-bold text-[9px] uppercase mb-2"
              style={{ letterSpacing: 2.5 }}
            >
              ── {tier}
            </Text>
            <View className="gap-1.5">
              {tierLevels.map((level) => {
                const selected = selectedLevels.includes(level.id);
                return (
                  <Pressable
                    key={level.id}
                    onPress={() => onToggle(level.id)}
                    className={`border-[1.5px] px-4 py-3.5 flex-row items-center justify-between active:opacity-70
                      ${selected ? "border-signal bg-signal/10" : "border-ink-20 bg-chalk"}`}
                  >
                    <Text
                      className={`font-mono text-sm ${selected ? "text-signal font-mono-bold" : "text-ink"}`}
                      style={{ letterSpacing: 0.5 }}
                    >
                      {level.label}
                    </Text>
                    {selected && <Text className="text-signal font-mono-bold text-base">✓</Text>}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Shared primitives ──────────────────────────────────────────────────────

function Label({ children, style }: { children: string; style?: object }) {
  return (
    <Text
      className="text-ink-60 font-mono-bold text-[9px] uppercase mb-2"
      style={[{ letterSpacing: 2 }, style]}
    >
      {children}
    </Text>
  );
}

function StyledInput({
  error,
  hint,
  ...props
}: React.ComponentProps<typeof TextInput> & { error?: string; hint?: string }) {
  return (
    <>
      <TextInput
        placeholderTextColor="rgba(8,17,28,0.36)"
        className={`border-[1.5px] bg-chalk px-4 py-3.5 text-ink font-mono ${error ? "border-foul" : "border-ink"}`}
        style={{ fontSize: 14 }}
        {...props}
      />
      {error ? (
        <Text className="text-foul font-mono text-[9px] mt-1 uppercase" style={{ letterSpacing: 1 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-ink-60 font-mono text-[9px] mt-1 uppercase" style={{ letterSpacing: 1 }}>
          {hint}
        </Text>
      ) : null}
    </>
  );
}
