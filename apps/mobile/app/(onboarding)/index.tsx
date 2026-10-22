import { useState } from "react";
import { Text, View, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ScrollScreen } from "@/components/layout/ScrollScreen";
import { getSupabaseSetupError, supabase } from "@/lib/supabase";
import { saveFullProfile, CertEntry } from "@/lib/profile/queries";
import { LEAGUES_WORKED_MAX, cleanLeaguesWorked } from "@refee/core/profile/leagues";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";
import { REGION_CODE_ERROR, US_STATES } from "@refee/core/geo/regions";
import { dateOfBirthError, isAdult, usDateInput } from "@refee/core/identity/age";
import { UnderAgeNotice } from "@/components/onboarding/UnderAgeNotice";
import { HeadshotStep } from "@/components/onboarding/HeadshotStep";
import { uploadSignupHeadshot, type PickedHeadshot } from "@/lib/profile/avatar";
import { Button } from "@/components/ui/Button";
import { OptionRow } from "@/components/ui/Choice";
import { BackButton, IconButton, TextLink } from "@/components/ui/Controls";
import { AffixField, TextField } from "@/components/ui/TextField";

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

const STEP_LABELS = ["NAME", "LOCATION", "SPORT", "RATE", "CERTIFICATIONS", "LEVELS", "HEADSHOT"];
const LAST_STEP = STEP_LABELS.length - 1;

type StringFormKey = "firstName" | "lastName" | "city" | "state" | "homeZip" | "sportId" | "yearsExperience" | "leaguesWorked" | "minPay" | "travelRadius" | "dobDigits";
type StringSetter = (k: StringFormKey) => (v: string) => void;

type FormData = {
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  homeZip: string;
  sportId: string;
  yearsExperience: string;
  leaguesWorked: string;
  minPay: string;
  travelRadius: string;
  certs: CertEntry[];
  levels: string[];
  /** Date of birth as typed on the keypad: MMDDYYYY digits. */
  dobDigits: string;
  /** Required headshot, chosen on the last step and uploaded on submit. */
  photo: PickedHeadshot | null;
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
    homeZip: "",
    sportId: "basketball",
    yearsExperience: "",
    leaguesWorked: "",
    minPay: "35",
    travelRadius: "25",
    certs: [],
    levels: [],
    dobDigits: "",
    photo: null,
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
    form.city.trim().length >= 1 && US_STATES.includes(form.state.toUpperCase()) &&
      (form.homeZip === "" || /^[0-9]{5}$/.test(form.homeZip)),
    !!form.sportId,
    parseInt(form.minPay, 10) >= 1 && parseInt(form.travelRadius, 10) >= 1,
    true, // certs are optional
    form.levels.length >= 1,
    form.photo !== null, // headshot is required — finishing is blocked without it
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

      if (!form.photo) {
        setError("Add a headshot to finish signing up.");
        setLoading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      const { avatarUrl, error: photoError } = await uploadSignupHeadshot(user.id, form.photo);
      if (photoError || !avatarUrl) {
        setError(photoError?.message ?? "Couldn't upload your photo. Please try again.");
        setLoading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      const lastName = form.lastName.trim();
      const lastInitial = lastName.length > 0 ? lastName[0].toUpperCase() : "?";

      const { error: saveError } = await saveFullProfile(user.id, {
        avatarUrl,
        firstName: form.firstName.trim(),
        lastInitial,
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
        homeZip: form.homeZip,
        sportId: form.sportId,
        yearsExperience: parseInt(form.yearsExperience || "0", 10),
        leaguesWorked: cleanLeaguesWorked(form.leaguesWorked),
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
      case 6: return <HeadshotStep photo={form.photo} onChange={(photo) => setForm((f) => ({ ...f, photo }))} />;
    }
  };

  const isLastStep = step === LAST_STEP;

  return (
    <ScrollScreen
      keyboard
      header={
        <>
          <View className="flex-row items-center justify-between px-5 py-3">
            <BackButton onPress={step === 0 ? handleExit : handleBack} />
            <Text
              className="text-ink-60 font-mono-bold text-[9px] uppercase"
              style={{ letterSpacing: 2 }}
            >
              <Text className="text-ink">{String(step + 1).padStart(2, "0")}</Text>
              {` / ${String(STEP_LABELS.length).padStart(2, "0")} · REFEREE`}
            </Text>
            <IconButton
              accessibilityLabel="Exit setup"
              onPress={handleExit}
              icon={(color) => <Feather name="x" size={16} color={color} />}
            />
          </View>
          <View className="h-0.5 bg-ink-20 mx-5">
            <View
              className="h-full bg-signal"
              style={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }}
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
              className="text-foul-ink font-mono text-[10px] uppercase mb-3"
              style={{ letterSpacing: 1 }}
            >
              {error}
            </Text>
          )}
          <Button
            label={isLastStep ? "Finish setup" : "Next"}
            showArrow
            fullWidth
            loading={loading}
            loadingLabel={isLastStep ? "Finishing setup" : "Saving"}
            disabled={!canAdvance[step]}
            onPress={isLastStep ? handleSubmit : handleNext}
          />
          {step === 0 ? (
            <View className="mt-1">
              <TextLink label="Use a different account" tone="signal" size={11} onPress={handleExit} />
            </View>
          ) : null}
        </View>
      }
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20 }}
    >
      <Text
        className="text-signal font-mono-bold text-[10px] uppercase mb-3"
        style={{ letterSpacing: 2 }}
      >
        {STEP_LABELS[step]} · STEP {step + 1} OF {STEP_LABELS.length}
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
      <UnderAgeNotice dateOfBirth={usDateInput(form.dobDigits).iso} />

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

      <Label style={{ marginTop: 16 }}>HOME ZIP (OPTIONAL)</Label>
      <StyledInput
        value={form.homeZip}
        onChangeText={(v) => set("homeZip")(v.replace(/\D/g, "").slice(0, 5))}
        placeholder="78701"
        keyboardType="number-pad"
        maxLength={5}
      />
      <Text className="text-ink-60 mt-2" style={{ fontSize: 12, lineHeight: 17 }}>
        Private. Measures your travel radius from near home instead of the middle of your city.
      </Text>
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
            <OptionRow
              key={s.id}
              label={s.label}
              selected={selected}
              onPress={() => set("sportId")(s.id)}
            />
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

      <Label style={{ marginTop: 20 }}>LEAGUES WORKED (OPTIONAL)</Label>
      <StyledInput
        value={form.leaguesWorked}
        onChangeText={(v) => set("leaguesWorked")(v.slice(0, LEAGUES_WORKED_MAX))}
        placeholder="AAU, YMCA, city rec, HS JV"
        hint="Leagues or organizations you've officiated for. Directors see this."
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

      <AffixField
        label="Min pay per game ($)"
        prefix="$"
        value={form.minPay}
        onChangeText={(v) => set("minPay")(v.replace(/\D/g, "").slice(0, 4))}
        placeholder="35"
        keyboardType="number-pad"
        hint="Jobs below this rate won't appear in your feed"
      />

      <View style={{ marginTop: 20 }}>
        <AffixField
          label="Travel radius (miles)"
          suffix="MI"
          value={form.travelRadius}
          onChangeText={(v) => set("travelRadius")(v.replace(/\D/g, "").slice(0, 3))}
          placeholder="25"
          keyboardType="number-pad"
          hint="How far you're willing to travel from your city"
        />
      </View>
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
              <OptionRow
                label={body.label}
                sublabel={body.full}
                selected={selected}
                onPress={() => onToggle(body.id)}
              />

              {selected && (
                <View className="mt-2 ml-4">
                  <TextField
                    label="License # (optional)"
                    value={entry.licenseNumber}
                    onChangeText={(v) => onSetLicense(body.id, v)}
                    placeholder="e.g. 123456"
                    autoCapitalize="characters"
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
                  <OptionRow
                    key={level.id}
                    label={level.label}
                    selected={selected}
                    dim
                    onPress={() => onToggle(level.id)}
                  />
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

const StyledInput = TextField;
