import { useEffect, useState } from "react";
import { Text, View, ActivityIndicator } from "react-native";
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
  fetchMyHomeZip,
  CertEntry,
} from "@/lib/profile/queries";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";
import { REGION_CODE_ERROR, US_STATES } from "@refee/core/geo/regions";
import { LEAGUES_WORKED_MAX, cleanLeaguesWorked } from "@refee/core/profile/leagues";
import { palette } from "@refee/design";
import { BackButton } from "@/components/ui/Controls";
import { Button } from "@/components/ui/Button";
import { BigChoice, Chip, OptionRow } from "@/components/ui/Choice";
import { AffixField, TextField } from "@/components/ui/TextField";


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
  homeZip: string;
  sportId: string;
  yearsExperience: string;
  leaguesWorked: string;
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
    homeZip: "",
    sportId: "basketball",
    yearsExperience: "",
    leaguesWorked: "",
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

      const [profileRes, sportsRes, availRes, certsRes, levelsRes, homeZip] = await Promise.all([
        fetchMyProfile(uid),
        fetchMyRefSports(uid),
        fetchMyAvailability(uid),
        fetchMyCertifications(uid),
        fetchMyLevels(uid),
        fetchMyHomeZip(uid),
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
        homeZip: homeZip ?? "",
        sportId: sport?.sport_id ?? "basketball",
        yearsExperience: sport?.years_experience ? String(sport.years_experience) : "",
        leaguesWorked: sport?.leagues_worked ?? "",
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
    (form.homeZip === "" || /^[0-9]{5}$/.test(form.homeZip)) &&
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
      homeZip: form.homeZip,
      sportId: form.sportId,
      yearsExperience: parseInt(form.yearsExperience || "0", 10),
      leaguesWorked: cleanLeaguesWorked(form.leaguesWorked),
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
        <ActivityIndicator color={palette.signal} />
      </View>
    );
  }

  return (
    <ScrollScreen
      keyboard
      header={
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-ink-20">
          <BackButton onPress={() => router.back()} />
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
          <Button
            label="Save changes"
            showArrow
            fullWidth
            loading={saving}
            loadingLabel="Saving"
            disabled={!canSave}
            onPress={handleSave}
          />
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
            editable={false}
            hint="From your legal last name. Once your ID is verified, you can change your name once every 60 days"
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
            error={form.state.length === 2 && !stateValid ? REGION_CODE_ERROR : undefined}
          />
          <FieldLabel top>HOME ZIP (OPTIONAL)</FieldLabel>
          <FieldInput
            value={form.homeZip}
            onChangeText={(v) => set("homeZip")(v.replace(/\D/g, "").slice(0, 5))}
            placeholder="78701"
            keyboardType="number-pad"
            maxLength={5}
            hint="Private. Measures your travel radius from near home instead of the middle of your city."
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
          <FieldLabel>LEAGUES WORKED</FieldLabel>
          <FieldInput
            value={form.leaguesWorked}
            onChangeText={(v) => set("leaguesWorked")(v.slice(0, LEAGUES_WORKED_MAX))}
            placeholder="AAU, YMCA, city rec, HS JV"
            hint="Leagues or organizations you've officiated for. Directors and assignors see this."
          />
        </FormSection>

        {/* ── Pay floor ─────────────────────────────────────────────── */}
        <FormSection label="PAY FLOOR">
          <AffixField
            label="Min pay per game ($)"
            prefix="$"
            value={form.minPay}
            onChangeText={(v) => set("minPay")(v.replace(/\D/g, "").slice(0, 4))}
            placeholder="35"
            keyboardType="number-pad"
            hint="Jobs below this rate won't appear in your feed"
          />

          <FieldLabel top>TRAVEL RADIUS</FieldLabel>
          <View className="flex-row gap-1.5">
            {["10", "25", "50", "100"].map((r) => {
              const selected = form.travelRadius === r;
              return (
                <BigChoice key={r} num={r} label="Miles" selected={selected} onPress={() => set("travelRadius")(r)} />
              );
            })}
          </View>
        </FormSection>

        {/* ── Days available ────────────────────────────────────────── */}
        <FormSection label="DAYS AVAILABLE">
          <Text className="text-ink-60 font-mono text-xs mb-4" style={{ lineHeight: 16 }}>
            Tap the days you&apos;re open to work. Directors see this on your profile.
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {DAYS.map((day, i) => {
              const active = !!(form.availableDays & (1 << i));
              return (
                <Chip key={day} label={day} selected={active} onPress={() => toggleDay(i)} />
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
                  <OptionRow
                    label={body.label}
                    sublabel={body.full}
                    selected={selected}
                    onPress={() => toggleCert(body.id)}
                  />

                  {selected && (
                    <View className="mt-2 ml-4">
                      <TextField
                        label="License # (optional)"
                        value={entry.licenseNumber}
                        onChangeText={(v) => setCertLicense(body.id, v)}
                        placeholder="e.g. 123456"
                        autoCapitalize="characters"
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
            Select all levels you&apos;ve officiated. At least one required.
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
                    <OptionRow
                      key={level.id}
                      label={level.label}
                      selected={selected}
                      dim
                      onPress={() => toggleLevel(level.id)}
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </FormSection>

        {error && (
          <Text className="text-foul-ink font-mono text-xs mx-5 mb-4 uppercase">{error}</Text>
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
    <Chip label={label} selected={active} onPress={() => onSet(active ? 0 : mask)} />
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

const FieldInput = TextField;
