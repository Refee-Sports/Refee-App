import { useEffect, useState } from "react";
import {
  Text,
  TextInput,
  View,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ScrollScreen } from "@/components/layout/ScrollScreen";
import { supabase } from "@/lib/supabase";
import {
  fetchMyProfile,
  fetchMyRefSports,
  fetchMyAvailability,
  fetchMyCertifications,
  fetchMyLevels,
  updateFullProfile,
  CertEntry,
} from "@/lib/profile/queries";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

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

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const RADIUS_PRESETS = [10, 25, 50, 100];

function snapRadius(miles: number): string {
  const nearest = RADIUS_PRESETS.reduce((best, r) =>
    Math.abs(r - miles) < Math.abs(best - miles) ? r : best
  );
  return String(nearest);
}

type FormData = {
  firstName: string;
  lastInitial: string;
  city: string;
  state: string;
  sportId: string;
  yearsExperience: string;
  minPay: string;
  travelRadius: string;
  availableDays: number;
  certs: CertEntry[];
  levels: string[];
};

export default function EditProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bumpProfileVersion = useOnboardingStore((s) => s.bumpProfileVersion);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastInitial: "",
    city: "",
    state: "",
    sportId: "basketball",
    yearsExperience: "",
    minPay: "35",
    travelRadius: "25",
    availableDays: 0,
    certs: [],
    levels: [],
  });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      const [profileRes, sportsRes, availRes, certsRes, levelsRes] = await Promise.all([
        fetchMyProfile(uid),
        fetchMyRefSports(uid),
        fetchMyAvailability(uid),
        fetchMyCertifications(uid),
        fetchMyLevels(uid),
      ]);

      const p = profileRes.data as any;
      const sport = (sportsRes.data ?? [])[0] as any;
      const av = availRes.data as any;
      const rawCerts = (certsRes.data ?? []) as any[];
      const rawLevels = (levelsRes.data ?? []) as any[];

      setForm({
        firstName: p?.first_name ?? "",
        lastInitial: p?.last_initial ?? "",
        city: p?.city ?? "",
        state: p?.state ?? "",
        sportId: sport?.sport_id ?? "basketball",
        yearsExperience: sport?.years_experience ? String(sport.years_experience) : "",
        minPay: av?.min_pay_per_game ? String(av.min_pay_per_game) : "35",
        travelRadius: snapRadius(av?.travel_radius_miles ?? 25),
        availableDays: av?.available_days ?? 0,
        certs: rawCerts.map((c) => ({ bodyId: c.org_name, licenseNumber: c.license_number ?? "" })),
        levels: rawLevels.map((l) => l.level_id),
      });
      setLoading(false);
    })();
  }, []);

  const set = (key: keyof Omit<FormData, "certs" | "levels">) =>
    (val: string) => setForm((f) => ({ ...f, [key]: val }));

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

  const toggleDay = (dayIndex: number) => {
    Haptics.selectionAsync();
    setForm((f) => ({ ...f, availableDays: f.availableDays ^ (1 << dayIndex) }));
  };

  const toggleLevel = (levelId: string) =>
    setForm((f) => ({
      ...f,
      levels: f.levels.includes(levelId)
        ? f.levels.filter((l) => l !== levelId)
        : [...f.levels, levelId],
    }));

  const stateValid = US_STATES.includes(form.state.toUpperCase());
  const canSave =
    form.firstName.trim().length >= 1 &&
    form.lastInitial.trim().length >= 1 &&
    form.city.trim().length >= 1 &&
    stateValid &&
    !!form.sportId &&
    parseInt(form.minPay, 10) >= 1 &&
    parseInt(form.travelRadius, 10) >= 1 &&
    form.levels.length >= 1;

  const handleSave = async () => {
    if (!canSave) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Session expired. Please sign in again.");
      setSaving(false);
      return;
    }

    const lastInitial = form.lastInitial.trim()[0].toUpperCase();
    const { error: saveError } = await updateFullProfile(session.user.id, {
      firstName: form.firstName.trim(),
      lastInitial,
      city: form.city.trim(),
      state: form.state.trim().toUpperCase(),
      sportId: form.sportId,
      yearsExperience: parseInt(form.yearsExperience || "0", 10),
      minPayPerGame: parseInt(form.minPay, 10),
      travelRadiusMiles: parseInt(form.travelRadius, 10),
      availableDays: form.availableDays,
      certs: form.certs,
      levelIds: form.levels,
    });

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    bumpProfileVersion();
    router.back();
  };

  if (loading) {
    return (
      <View className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator color="#1F4FCC" />
      </View>
    );
  }

  return (
    <ScrollScreen
      keyboard
      header={
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-ink-20">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70"
          >
            <Text className="text-ink font-mono-bold text-base">←</Text>
          </Pressable>
          <Text
            className="text-ink font-display"
            style={{ fontSize: 16, letterSpacing: -0.5 }}
          >
            EDIT PROFILE
          </Text>
          <View className="w-9" />
        </View>
      }
      footer={
        <View
          className="border-t-[1.5px] border-ink bg-paper px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Pressable
            onPress={handleSave}
            disabled={!canSave || saving}
            className={`py-4 ${canSave && !saving ? "bg-ink" : "bg-ink-20"} active:opacity-80`}
          >
            <View className="flex-row justify-center items-center gap-2">
              {saving ? (
                <ActivityIndicator color="#E5E1D6" />
              ) : (
                <>
                  <Text
                    className={`font-mono-bold ${canSave ? "text-paper" : "text-ink-40"}`}
                    style={{ fontSize: 12, letterSpacing: 2.5 }}
                  >
                    SAVE CHANGES
                  </Text>
                  <Text className={`font-mono-bold text-base ${canSave ? "text-paper" : "text-ink-40"}`}>
                    →
                  </Text>
                </>
              )}
            </View>
          </Pressable>
        </View>
      }
    >
        {/* ── Identity ──────────────────────────────────────────────── */}
        <FormSection label="IDENTITY">
          <FieldLabel>FIRST NAME</FieldLabel>
          <FieldInput
            value={form.firstName}
            onChangeText={set("firstName")}
            placeholder="Jordan"
            autoCapitalize="words"
          />
          <FieldLabel top>LAST INITIAL</FieldLabel>
          <FieldInput
            value={form.lastInitial}
            onChangeText={(v) => set("lastInitial")(v.replace(/[^a-zA-Z]/g, "").slice(0, 1).toUpperCase())}
            placeholder="T"
            autoCapitalize="characters"
            maxLength={1}
            hint="Only your initial is stored and shown to organizers"
          />
        </FormSection>

        {/* ── Location ──────────────────────────────────────────────── */}
        <FormSection label="LOCATION">
          <FieldLabel>CITY</FieldLabel>
          <FieldInput
            value={form.city}
            onChangeText={set("city")}
            placeholder="Austin"
            autoCapitalize="words"
          />
          <FieldLabel top>STATE</FieldLabel>
          <FieldInput
            value={form.state}
            onChangeText={(v) => set("state")(v.toUpperCase().slice(0, 2))}
            placeholder="TX"
            autoCapitalize="characters"
            maxLength={2}
            error={form.state.length === 2 && !stateValid ? "Enter a valid 2-letter state code" : undefined}
          />
        </FormSection>

        {/* ── Sport ─────────────────────────────────────────────────── */}
        <FormSection label="SPORT">
          <FieldLabel>YEARS OF EXPERIENCE</FieldLabel>
          <FieldInput
            value={form.yearsExperience}
            onChangeText={(v) => set("yearsExperience")(v.replace(/\D/g, "").slice(0, 2))}
            placeholder="5"
            keyboardType="number-pad"
            hint="How many years you've been officiating basketball"
          />
        </FormSection>

        {/* ── Pay floor ─────────────────────────────────────────────── */}
        <FormSection label="PAY FLOOR">
          <FieldLabel>MIN PAY PER GAME ($)</FieldLabel>
          <View className="flex-row border-[1.5px] border-ink">
            <View className="bg-ink px-4 justify-center">
              <Text className="text-paper font-mono-bold text-base" style={{ letterSpacing: 0.5 }}>$</Text>
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
          <Text className="text-ink-60 font-mono text-[9px] mt-1.5 uppercase" style={{ letterSpacing: 1.2 }}>
            JOBS BELOW THIS RATE WON'T APPEAR IN YOUR FEED
          </Text>

          <FieldLabel top>TRAVEL RADIUS</FieldLabel>
          <View className="flex-row gap-1.5">
            {["10", "25", "50", "100"].map((r) => {
              const selected = form.travelRadius === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => {
                    Haptics.selectionAsync();
                    set("travelRadius")(r);
                  }}
                  className={`flex-1 py-3.5 items-center border-[1.5px] active:opacity-70 ${
                    selected ? "border-signal bg-signal/10" : "border-ink bg-chalk"
                  }`}
                >
                  <Text
                    className={`font-display ${selected ? "text-signal" : "text-ink"}`}
                    style={{ fontSize: 18, letterSpacing: -0.5 }}
                  >
                    {r}
                  </Text>
                  <Text
                    className={`font-mono-bold text-[8px] uppercase ${
                      selected ? "text-signal/70" : "text-ink-40"
                    }`}
                    style={{ letterSpacing: 1.5 }}
                  >
                    MILES
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FormSection>

        {/* ── Days available ────────────────────────────────────────── */}
        <FormSection label="DAYS AVAILABLE">
          <Text className="text-ink-60 font-mono text-xs mb-4" style={{ lineHeight: 16 }}>
            Tap the days you're open to work. Directors see this on your profile.
          </Text>
          <View className="flex-row gap-1">
            {DAYS.map((day, i) => {
              const active = !!(form.availableDays & (1 << i));
              return (
                <Pressable
                  key={day}
                  onPress={() => toggleDay(i)}
                  className={`flex-1 py-3 items-center border-[1.5px] active:opacity-70 ${
                    active ? "bg-signal border-signal" : "bg-chalk border-ink-20"
                  }`}
                >
                  <Text
                    className={`font-mono-bold text-[9px] ${active ? "text-paper" : "text-ink-40"}`}
                    style={{ letterSpacing: 0.5 }}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View className="flex-row gap-1.5 mt-2">
            <QuickDays label="WEEKDAYS" mask={0b0111110} current={form.availableDays} onSet={(m) => setForm((f) => ({ ...f, availableDays: m }))} />
            <QuickDays label="WEEKENDS" mask={0b1000001} current={form.availableDays} onSet={(m) => setForm((f) => ({ ...f, availableDays: m }))} />
            <QuickDays label="ALL DAYS" mask={0b1111111} current={form.availableDays} onSet={(m) => setForm((f) => ({ ...f, availableDays: m }))} />
          </View>
        </FormSection>

        {/* ── Certifications ────────────────────────────────────────── */}
        <FormSection label="CERTIFICATIONS">
          <Text className="text-ink-60 font-mono text-xs mb-4" style={{ lineHeight: 16 }}>
            Select any certifications you hold. Leave blank if none.
          </Text>
          <View className="gap-2">
            {CERT_BODIES.map((body) => {
              const entry = form.certs.find((c) => c.bodyId === body.id);
              const selected = !!entry;
              return (
                <View key={body.id}>
                  <Pressable
                    onPress={() => toggleCert(body.id)}
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
                        onChangeText={(v) => setCertLicense(body.id, v)}
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
        </FormSection>

        {/* ── Levels ────────────────────────────────────────────────── */}
        <FormSection label="LEVELS WORKED">
          <Text className="text-ink-60 font-mono text-xs mb-4" style={{ lineHeight: 16 }}>
            Select all levels you've officiated. At least one required.
          </Text>
          {(["AMATEUR", "COLLEGE", "PRO"] as const).map((tier) => (
            <View key={tier} className="mb-5">
              <Text
                className="text-ink-40 font-mono-bold text-[9px] uppercase mb-2"
                style={{ letterSpacing: 2.5 }}
              >
                ── {tier}
              </Text>
              <View className="gap-1.5">
                {LEVELS.filter((l) => l.tier === tier).map((level) => {
                  const selected = form.levels.includes(level.id);
                  return (
                    <Pressable
                      key={level.id}
                      onPress={() => toggleLevel(level.id)}
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
          ))}
        </FormSection>

        {error && (
          <Text className="text-foul font-mono text-xs mx-5 mb-4 uppercase">{error}</Text>
        )}
    </ScrollScreen>
  );
}

function QuickDays({
  label,
  mask,
  current,
  onSet,
}: {
  label: string;
  mask: number;
  current: number;
  onSet: (mask: number) => void;
}) {
  const active = current === mask;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onSet(active ? 0 : mask);
      }}
      className={`flex-1 py-2 items-center border ${
        active ? "bg-ink border-ink" : "bg-paper border-ink-20"
      } active:opacity-70`}
    >
      <Text
        className={`font-mono-bold text-[8px] uppercase ${active ? "text-hi-vis" : "text-ink-60"}`}
        style={{ letterSpacing: 1 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Shared primitives ──────────────────────────────────────────────────────

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mx-5 mt-7">
      <Text
        className="text-ink-40 font-mono-bold text-[9px] uppercase mb-4 pb-2 border-b border-ink-20"
        style={{ letterSpacing: 2.5 }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function FieldLabel({ children, top }: { children: string; top?: boolean }) {
  return (
    <Text
      className={`text-ink-60 font-mono-bold text-[9px] uppercase mb-2 ${top ? "mt-4" : ""}`}
      style={{ letterSpacing: 2 }}
    >
      {children}
    </Text>
  );
}

function FieldInput({
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
