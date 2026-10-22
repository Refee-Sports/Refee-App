import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ScrollScreen } from "@/components/layout/ScrollScreen";
import { supabase } from "@/lib/supabase";
import {
  createTournament,
  updateTournament,
  fetchTournamentById,
  fetchMyHirerId,
} from "@/lib/director/queries";
import { CalendarRangePicker } from "@/components/ui/CalendarRangePicker";
import { DropdownSelect } from "@/components/ui/DropdownSelect";
import { RULESETS, QUARTER_MINUTES, HALF_MINUTES } from "@/lib/basketball/options";
import { REGION_CODE_ERROR, US_STATES } from "@refee/core/geo/regions";
import { Button } from "@/components/ui/Button";
import { BigChoice, OptionRow } from "@/components/ui/Choice";
import { IconButton } from "@/components/ui/Controls";
import { TextField } from "@/components/ui/TextField";
import { Feather } from "@expo/vector-icons";


const US_TIMEZONES = [
  // Empty = the database takes the zone from the venue (map pin or state).
  { value: "", label: "AUTO (FROM VENUE)" },
  { value: "America/Puerto_Rico", label: "ATLANTIC (PUERTO RICO)" },
  { value: "America/New_York", label: "EASTERN" },
  { value: "America/Chicago", label: "CENTRAL" },
  { value: "America/Denver", label: "MOUNTAIN" },
  { value: "America/Phoenix", label: "ARIZONA" },
  { value: "America/Los_Angeles", label: "PACIFIC" },
  { value: "America/Anchorage", label: "ALASKA" },
  { value: "Pacific/Honolulu", label: "HAWAII" },
];

export default function CreateTournament() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = !!editId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    startsOn: "",
    endsOn: "",
    venueName: "",
    venueAddress: "",
    venueZip: "",
    venueCity: "",
    venueState: "",
    timezone: "",
    ruleset: "",
    rulesetModifications: "",
    gameFormat: "" as "" | "quarters" | "halves",
    periodMinutes: "",
    uniformRequirements: "",
  });

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { tournament: t } = await fetchTournamentById(editId);
      if (t) {
        setForm({
          name: t.name,
          description: t.description ?? "",
          startsOn: t.starts_on,
          endsOn: t.ends_on,
          venueName: t.venue_name ?? "",
          venueAddress: t.venue_address ?? "",
          venueZip: t.venue_zip ?? "",
          venueCity: t.venue_city,
          venueState: t.venue_state,
          timezone: t.timezone ?? "",
          ruleset: t.ruleset ?? "",
          rulesetModifications: t.ruleset_modifications ?? "",
          gameFormat: (t.game_format ?? "") as "" | "quarters" | "halves",
          periodMinutes: t.period_minutes ? String(t.period_minutes) : "",
          uniformRequirements: t.uniform_requirements ?? "",
        });
      }
    })();
  }, [editId]);

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const stateValid = !form.venueState || US_STATES.includes(form.venueState.toUpperCase());
  const canSubmit =
    form.name.trim().length >= 2 &&
    form.startsOn.trim().length >= 1 &&
    form.endsOn.trim().length >= 1 &&
    form.venueName.trim().length >= 1 &&
    form.venueAddress.trim().length >= 3 &&
    /^\d{5}$/.test(form.venueZip) &&
    form.venueCity.trim().length >= 1 &&
    !!form.ruleset &&
    !!form.gameFormat &&
    !!form.periodMinutes &&
    form.uniformRequirements.trim().length >= 1 &&
    US_STATES.includes(form.venueState.toUpperCase());

  const handleSubmit = async () => {
    if (!canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const hirerId = await fetchMyHirerId(session.user.id);
    if (!hirerId) {
      setError("Director profile not found. Please try again.");
      setLoading(false);
      return;
    }

    const args = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      startsOn: form.startsOn.trim(),
      endsOn: form.endsOn.trim(),
      venueName: form.venueName.trim(),
      venueAddress: form.venueAddress.trim(),
      venueZip: form.venueZip.trim(),
      venueCity: form.venueCity.trim(),
      venueState: form.venueState.trim().toUpperCase(),
      timezone: form.timezone || undefined,
      ruleset: form.ruleset,
      rulesetModifications: form.rulesetModifications.trim() || undefined,
      gameFormat: (form.gameFormat || undefined) as "quarters" | "halves" | undefined,
      periodMinutes: form.periodMinutes ? parseInt(form.periodMinutes, 10) : undefined,
      uniformRequirements: form.uniformRequirements.trim() || undefined,
    };

    if (isEdit && editId) {
      const { error: updateErr } = await updateTournament(editId, args);
      if (updateErr) {
        setError(updateErr.message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setLoading(false);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
      return;
    }

    const { tournamentId, error: createErr } = await createTournament(hirerId, args);

    if (createErr || !tournamentId) {
      setError(createErr?.message ?? "Failed to create tournament.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoading(false);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(`/(director)/tournament/${tournamentId}` as any);
  };

  return (
    <ScrollScreen
      keyboard
      header={
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-ink-20">
          <IconButton
            accessibilityLabel="Close"
            onPress={() => router.back()}
            icon={(color) => <Feather name="x" size={16} color={color} />}
          />
          <Text
            className="text-ink font-mono-bold text-[11px] uppercase"
            style={{ letterSpacing: 2 }}
          >
            {isEdit ? "EDIT TOURNAMENT" : "NEW TOURNAMENT"}
          </Text>
          <View className="w-9" />
        </View>
      }
      footer={
        <View
          className="border-t-[1.5px] border-ink bg-paper px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          {error && (
            <Text className="text-foul-ink font-mono text-[10px] uppercase mb-3" style={{ letterSpacing: 1 }}>
              {error}
            </Text>
          )}
          <Button
            label={isEdit ? "Save changes" : "Create tournament"}
            showArrow
            fullWidth
            loading={loading}
            loadingLabel={isEdit ? "Saving" : "Creating"}
            disabled={!canSubmit}
            onPress={handleSubmit}
          />
        </View>
      }
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24 }}
    >
      <Text
        className="text-ink font-display mb-6"
        style={{ fontSize: 34, lineHeight: 32, letterSpacing: -1.5 }}
      >
        {"CREATE\n"}
        <Text className="text-signal">TOURNAMENT</Text>
      </Text>

      {/* Section: Details */}
      <SectionLabel>TOURNAMENT DETAILS</SectionLabel>

      <FLabel>TOURNAMENT NAME *</FLabel>
      <FInput
        value={form.name}
        onChangeText={set("name")}
        placeholder="e.g. Austin Hoops Classic 2026"
        autoFocus
        autoCapitalize="words"
      />

      <FLabel style={{ marginTop: 16 }}>DESCRIPTION (OPTIONAL)</FLabel>
      <FInput
        value={form.description}
        onChangeText={set("description")}
        placeholder="Tell referees what to expect..."
        multiline
        numberOfLines={3}
        style={{ height: 80, textAlignVertical: "top", paddingTop: 12 }}
      />

      {/* Section: Dates */}
      <SectionLabel style={{ marginTop: 28 }}>DATES *</SectionLabel>

      <CalendarRangePicker
        startDate={form.startsOn || null}
        endDate={form.endsOn || null}
        onChange={(start, end) => setForm((f) => ({ ...f, startsOn: start, endsOn: end }))}
      />

      {/* Section: Ruleset */}
      <SectionLabel style={{ marginTop: 28 }}>RULESET *</SectionLabel>
      <View className="flex-row flex-wrap gap-1.5">
        {RULESETS.map((r) => {
          const selected = form.ruleset === r.id;
          return (
            <OptionRow key={r.id} label={r.label} selected={selected} dim onPress={() => setForm((f) => ({ ...f, ruleset: r.id }))} />
          );
        })}
      </View>

      {!!form.ruleset && (
        <>
          <FLabel style={{ marginTop: 16 }}>RULE MODIFICATIONS (OPTIONAL)</FLabel>
          <FInput
            value={form.rulesetModifications}
            onChangeText={set("rulesetModifications")}
            placeholder="e.g. Running clock after 20-pt lead..."
            multiline
            numberOfLines={2}
            style={{ height: 64, textAlignVertical: "top", paddingTop: 12 }}
            autoCapitalize="sentences"
          />
        </>
      )}

      {/* Section: Game format (default for every game in the tournament) */}
      <SectionLabel style={{ marginTop: 28 }}>GAME FORMAT *</SectionLabel>
      <FLabel>PERIODS — APPLIES TO EVERY GAME</FLabel>
      <View className="flex-row gap-2">
        {([
          { id: "quarters", num: "4", label: "QUARTERS" },
          { id: "halves", num: "2", label: "HALVES" },
        ] as const).map((opt) => {
          const selected = form.gameFormat === opt.id;
          return (
            <BigChoice
              key={opt.id}
              num={opt.num}
              label={opt.label}
              selected={selected}
              onPress={() => setForm((f) => ({ ...f, gameFormat: opt.id, periodMinutes: "" }))}
            />
          );
        })}
      </View>

      {form.gameFormat !== "" && (
        <>
          <FLabel style={{ marginTop: 16 }}>
            {form.gameFormat === "quarters" ? "MINUTES PER QUARTER *" : "MINUTES PER HALF *"}
          </FLabel>
          <DropdownSelect
            value={form.periodMinutes || null}
            options={(form.gameFormat === "quarters" ? QUARTER_MINUTES : HALF_MINUTES).map((m) => ({
              value: m,
              label: `${m} MINUTES`,
            }))}
            placeholder="SELECT MINUTES"
            onSelect={(v) => setForm((f) => ({ ...f, periodMinutes: v }))}
          />
        </>
      )}

      {/* Section: Uniform (default for every game) */}
      <SectionLabel style={{ marginTop: 28 }}>UNIFORM *</SectionLabel>
      <FLabel>REQUIRED UNIFORM — APPLIES TO EVERY GAME</FLabel>
      <FInput
        value={form.uniformRequirements}
        onChangeText={set("uniformRequirements")}
        placeholder="e.g. Black and white stripes, black pants"
        autoCapitalize="sentences"
      />

      {/* Section: Venue */}
      <SectionLabel style={{ marginTop: 28 }}>VENUE</SectionLabel>

      <FLabel>VENUE NAME *</FLabel>
      <FInput
        value={form.venueName}
        onChangeText={set("venueName")}
        placeholder="e.g. Austin Recreation Center"
        autoCapitalize="words"
      />

      <FLabel style={{ marginTop: 16 }}>STREET ADDRESS *</FLabel>
      <FInput
        value={form.venueAddress}
        onChangeText={set("venueAddress")}
        placeholder="1301 Shoal Creek Blvd"
        autoCapitalize="words"
        textContentType="streetAddressLine1"
      />

      <FLabel style={{ marginTop: 16 }}>CITY *</FLabel>
      <FInput
        value={form.venueCity}
        onChangeText={set("venueCity")}
        placeholder="Austin"
        autoCapitalize="words"
      />

      <FLabel style={{ marginTop: 16 }}>STATE * (2-LETTER CODE)</FLabel>
      <FInput
        value={form.venueState}
        onChangeText={(v) => set("venueState")(v.toUpperCase().slice(0, 2))}
        placeholder="TX"
        autoCapitalize="characters"
        maxLength={2}
        error={form.venueState.length === 2 && !stateValid ? REGION_CODE_ERROR : undefined}
      />

      <FLabel style={{ marginTop: 16 }}>ZIP *</FLabel>
      <FInput
        value={form.venueZip}
        onChangeText={(v) => set("venueZip")(v.replace(/\D/g, "").slice(0, 5))}
        placeholder="78701"
        keyboardType="number-pad"
        maxLength={5}
        textContentType="postalCode"
        error={form.venueZip.length > 0 && form.venueZip.length !== 5 ? "5-digit ZIP" : undefined}
      />

      <FLabel style={{ marginTop: 16 }}>TOURNAMENT TIMEZONE *</FLabel>
      <DropdownSelect
        value={form.timezone}
        options={US_TIMEZONES}
        placeholder="SELECT TIMEZONE"
        onSelect={(value) => setForm((current) => ({ ...current, timezone: value }))}
      />
    </ScrollScreen>
  );
}

function SectionLabel({ children, style }: { children: string; style?: object }) {
  return (
    <Text
      className="font-mono-bold text-[9px] text-ink uppercase border-b border-ink-20 pb-2 mb-4"
      style={[{ letterSpacing: 2.5 }, style]}
    >
      ── {children}
    </Text>
  );
}

function FLabel({ children, style }: { children: string; style?: object }) {
  return (
    <Text
      className="text-ink-60 font-mono-bold text-[9px] uppercase mb-2"
      style={[{ letterSpacing: 2 }, style]}
    >
      {children}
    </Text>
  );
}

const FInput = TextField;
