import { useEffect, useState } from "react";
import {
  Text,
  TextInput,
  View,
  Pressable,
  ActivityIndicator,
  Switch,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ScrollScreen } from "@/components/layout/ScrollScreen";
import { supabase } from "@/lib/supabase";
import {
  createGame,
  updateGame,
  fetchGameForEdit,
  fetchMyHirerId,
  fetchTournamentById,
  type TournamentRow,
} from "@/lib/director/queries";
import { CalendarRangePicker } from "@/components/ui/CalendarRangePicker";
import { DropdownSelect } from "@/components/ui/DropdownSelect";
import {
  RULESETS,
  LEVELS,
  QUARTER_MINUTES,
  HALF_MINUTES,
  AGE_REQUIRED_LEVELS,
} from "@/lib/basketball/options";

// 15-minute increments, 6:00 AM – 11:45 PM
const TIME_OPTIONS = Array.from({ length: 72 }, (_, i) => {
  const totalMin = 6 * 60 + i * 15;
  const h24 = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? "AM" : "PM";
  const value = `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return { value, label: `${h12}:${String(m).padStart(2, "0")} ${ampm}` };
});

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const PAPER = "#E5E1D6";

function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function CreateGame() {
  const { tournamentId, editId, copyFromId } = useLocalSearchParams<{
    tournamentId: string;
    editId?: string;
    copyFromId?: string;
  }>();
  const isEdit = !!editId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [prefilling, setPrefilling] = useState(!!editId || !!copyFromId);
  const [error, setError] = useState<string | null>(null);

  // Standalone = a single game with no parent tournament
  const isStandalone = !tournamentId && !editId && !copyFromId;
  const [tournament, setTournament] = useState<TournamentRow | null>(null);

  const [form, setForm] = useState({
    homeTeam: "",
    awayTeam: "",
    level: "",
    crewSize: 2 as 2 | 3,
    payPerGame: "",
    gameDate: "",
    gameTime: "",
    gameFormat: "" as "" | "quarters" | "halves",
    periodMinutes: "",
    venueName: "",
    venueCity: "",
    venueState: "",
    uniformRequirements: "",
    hirerNote: "",
    autoAccept: false,
    ageGroup: "",
    ruleset: "",
    rulesetModifications: "",
  });

  // For a new game under a tournament: inherit the tournament's defaults
  // (ruleset, format, uniform) as editable prefills, and constrain the date.
  useEffect(() => {
    if (!tournamentId || editId) return;
    (async () => {
      const { tournament: t } = await fetchTournamentById(tournamentId);
      if (!t) return;
      setTournament(t);
      if (!copyFromId) {
        setForm((f) => ({
          ...f,
          ruleset: f.ruleset || t.ruleset || "",
          rulesetModifications: f.rulesetModifications || t.ruleset_modifications || "",
          gameFormat: (f.gameFormat || t.game_format || "") as "" | "quarters" | "halves",
          periodMinutes: f.periodMinutes || (t.period_minutes ? String(t.period_minutes) : ""),
          uniformRequirements: f.uniformRequirements || t.uniform_requirements || "",
        }));
      }
    })();
  }, [tournamentId, editId, copyFromId]);

  // Prefill from an existing game (edit keeps everything; copy keeps
  // everything except date/time so the director slots the new game fast)
  useEffect(() => {
    const sourceId = editId ?? copyFromId;
    if (!sourceId) return;
    (async () => {
      const { game } = await fetchGameForEdit(sourceId);
      if (game) {
        const d = new Date(game.starts_at);
        const pad = (n: number) => String(n).padStart(2, "0");
        setForm((f) => ({
          ...f,
          homeTeam: game.home_team ?? "",
          awayTeam: game.away_team ?? "",
          level: game.level ?? "",
          crewSize: (game.crew_size === 3 ? 3 : 2) as 2 | 3,
          payPerGame: String(game.pay_per_game ?? ""),
          gameDate: isEdit
            ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
            : "",
          gameTime: isEdit ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "",
          gameFormat: (game.game_format ?? "") as "" | "quarters" | "halves",
          periodMinutes: game.period_minutes ? String(game.period_minutes) : "",
          venueName: game.venue_name ?? "",
          venueCity: game.venue_city ?? "",
          venueState: game.venue_state ?? "",
          uniformRequirements: game.uniform_requirements ?? "",
          hirerNote: game.hirer_note ?? "",
          autoAccept: !!game.auto_accept,
          ageGroup: game.age_group ?? "",
          ruleset: game.ruleset ?? "",
          rulesetModifications: game.ruleset_modifications ?? "",
        }));
      }
      setPrefilling(false);
    })();
  }, [editId, copyFromId, isEdit]);

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const ageRequired = AGE_REQUIRED_LEVELS.includes(form.level);
  const stateValid = !form.venueState || US_STATES.includes(form.venueState.toUpperCase());
  const canSubmit =
    form.homeTeam.trim().length >= 1 &&
    form.awayTeam.trim().length >= 1 &&
    !!form.level &&
    (!ageRequired || form.ageGroup.trim().length >= 1) &&
    !!form.ruleset &&
    !!form.gameFormat &&
    !!form.periodMinutes &&
    parseInt(form.payPerGame, 10) >= 1 &&
    form.gameDate.length === 10 &&
    form.gameTime.length >= 4 &&
    form.venueName.trim().length >= 1 &&
    form.venueCity.trim().length >= 1 &&
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
      setError("Director profile not found.");
      setLoading(false);
      return;
    }

    const periodMin = form.periodMinutes ? parseInt(form.periodMinutes, 10) : undefined;
    const numPeriods = form.gameFormat === "quarters" ? 4 : form.gameFormat === "halves" ? 2 : 0;

    const gameArgs = {
      homeTeam: form.homeTeam.trim(),
      awayTeam: form.awayTeam.trim(),
      level: form.level,
      crewSize: form.crewSize,
      payPerGame: parseInt(form.payPerGame, 10),
      startsAt: `${form.gameDate}T${form.gameTime}:00`,
      durationMinutes: periodMin && numPeriods ? periodMin * numPeriods : undefined,
      gameFormat: form.gameFormat || undefined,
      periodMinutes: periodMin,
      venueName: form.venueName.trim(),
      venueCity: form.venueCity.trim(),
      venueState: form.venueState.trim().toUpperCase(),
      uniformRequirements: form.uniformRequirements.trim() || undefined,
      hirerNote: form.hirerNote.trim() || undefined,
      autoAccept: form.autoAccept,
      ageGroup: form.ageGroup.trim() || undefined,
      ruleset: form.ruleset,
      rulesetModifications: form.rulesetModifications.trim() || undefined,
    };

    if (isEdit && editId) {
      const { error: updateErr, refsNeedReconfirm } = await updateGame(
        editId,
        session.user.id,
        gameArgs
      );
      if (updateErr) {
        setError(updateErr.message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setLoading(false);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (refsNeedReconfirm) {
        Alert.alert(
          "Referees notified",
          "You changed the time, venue, or pay. Confirmed referees have been asked to re-accept this game."
        );
      }
      router.back();
      return;
    }

    const { gameId, error: createErr } = await createGame(hirerId, tournamentId ?? null, gameArgs);

    if (createErr || !gameId) {
      setError(createErr?.message ?? "Failed to create game.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoading(false);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(`/(director)/game/${gameId}` as any);
  };

  return (
    <ScrollScreen
      keyboard
      header={
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-ink-20">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70"
          >
            <Text className="text-ink font-mono-bold text-base">✕</Text>
          </Pressable>
          <Text className="text-ink font-mono-bold text-[11px] uppercase" style={{ letterSpacing: 2 }}>
            {isEdit ? "EDIT GAME" : "ADD GAME"}
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
            <Text className="text-foul font-mono text-[10px] uppercase mb-3" style={{ letterSpacing: 1 }}>
              {error}
            </Text>
          )}
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit || loading}
            className={`py-4 ${canSubmit && !loading ? "bg-ink" : "bg-ink-20"} active:opacity-80`}
          >
            <View className="flex-row justify-center items-center gap-2">
              {loading ? (
                <ActivityIndicator color="#E5E1D6" />
              ) : (
                <Text
                  className={`font-mono-bold ${canSubmit ? "text-paper" : "text-ink-40"}`}
                  style={{ fontSize: 12, letterSpacing: 2.5 }}
                >
                  {isEdit ? "SAVE CHANGES →" : "POST GAME →"}
                </Text>
              )}
            </View>
          </Pressable>
        </View>
      }
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24 }}
    >
      {prefilling && (
        <View className="py-10 items-center">
          <ActivityIndicator color="#1F4FCC" />
        </View>
      )}

      <Text
        className="text-ink font-display mb-6"
        style={{ fontSize: 34, lineHeight: 32, letterSpacing: -1.5 }}
      >
        {isEdit ? "EDIT\n" : "NEW\n"}
        <Text className="text-signal">GAME</Text>
      </Text>

      {/* Section: Game details */}
      <Sect>MATCHUP</Sect>

      <FLabel>HOME TEAM *</FLabel>
      <FInput
        value={form.homeTeam}
        onChangeText={set("homeTeam")}
        placeholder="e.g. Eastside Eagles"
        autoFocus
        autoCapitalize="words"
      />

      <FLabel style={{ marginTop: 16 }}>AWAY TEAM *</FLabel>
      <FInput
        value={form.awayTeam}
        onChangeText={set("awayTeam")}
        placeholder="e.g. Westlake Warriors"
        autoCapitalize="words"
      />

      {/* Level picker */}
      <FLabel style={{ marginTop: 16 }}>LEVEL OF PLAY *</FLabel>
      <View className="gap-1.5">
        {LEVELS.map((l) => {
          const selected = form.level === l.id;
          return (
            <Pressable
              key={l.id}
              onPress={() => { Haptics.selectionAsync(); setForm((f) => ({ ...f, level: l.id })); }}
              className={`border-[1.5px] px-4 py-3 flex-row items-center justify-between active:opacity-70 ${
                selected ? "border-signal bg-signal/10" : "border-ink-20 bg-chalk"
              }`}
            >
              <Text
                className={`font-mono text-[11px] ${selected ? "text-signal font-mono-bold" : "text-ink"}`}
                style={{ letterSpacing: 1 }}
              >
                {l.label}
              </Text>
              {selected && <Text className="text-signal font-mono-bold">✓</Text>}
            </Pressable>
          );
        })}
      </View>

      <FLabel style={{ marginTop: 16 }}>{`AGE GROUP ${ageRequired ? "*" : "(OPTIONAL)"}`}</FLabel>
      <FInput
        value={form.ageGroup}
        onChangeText={set("ageGroup")}
        placeholder={ageRequired ? "e.g. U14, U16 — required for this level" : "e.g. U14, U16, Adult"}
        error={ageRequired && form.ageGroup.trim().length === 0 ? "Age group is required for youth & high school" : undefined}
      />

      <FLabel style={{ marginTop: 16 }}>RULESET *</FLabel>
      <View className="flex-row flex-wrap gap-1.5">
        {RULESETS.map((r) => {
          const selected = form.ruleset === r.id;
          return (
            <Pressable
              key={r.id}
              onPress={() => { Haptics.selectionAsync(); setForm((f) => ({ ...f, ruleset: r.id })); }}
              className={`border-[1.5px] px-4 py-3 active:opacity-70 ${
                selected ? "border-signal bg-signal/10" : "border-ink-20 bg-chalk"
              }`}
            >
              <Text
                className={`font-mono text-[11px] ${selected ? "text-signal font-mono-bold" : "text-ink"}`}
                style={{ letterSpacing: 1 }}
              >
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!!form.ruleset && (
        <>
          <FLabel style={{ marginTop: 16 }}>RULE MODIFICATIONS (OPTIONAL)</FLabel>
          <FInput
            value={form.rulesetModifications}
            onChangeText={set("rulesetModifications")}
            placeholder="e.g. Running clock after 20-pt lead, no press U12..."
            multiline
            numberOfLines={2}
            style={{ height: 64, textAlignVertical: "top", paddingTop: 12 }}
            autoCapitalize="sentences"
          />
        </>
      )}

      {/* Section: Crew & Pay */}
      <Sect style={{ marginTop: 28 }}>CREW & PAY</Sect>

      <FLabel>REFEREES NEEDED *</FLabel>
      <View className="flex-row gap-2">
        {([2, 3] as const).map((n) => {
          const selected = form.crewSize === n;
          return (
            <Pressable
              key={n}
              onPress={() => { Haptics.selectionAsync(); setForm((f) => ({ ...f, crewSize: n })); }}
              className={`flex-1 py-4 border-[1.5px] items-center active:opacity-70 ${
                selected ? "border-signal bg-signal/10" : "border-ink bg-chalk"
              }`}
            >
              <Text
                className={`font-display ${selected ? "text-signal" : "text-ink"}`}
                style={{ fontSize: 28, letterSpacing: -1 }}
              >
                {n}
              </Text>
              <Text
                className={`font-mono-bold text-[9px] uppercase ${
                  selected ? "text-signal/70" : "text-ink-40"
                }`}
                style={{ letterSpacing: 2 }}
              >
                REFS
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FLabel style={{ marginTop: 16 }}>PAY PER GAME ($) *</FLabel>
      <View className="flex-row border-[1.5px] border-ink">
        <View className="bg-ink px-4 justify-center">
          <Text className="text-paper font-mono-bold text-base">$</Text>
        </View>
        <TextInput
          value={form.payPerGame}
          onChangeText={(v) => set("payPerGame")(v.replace(/\D/g, "").slice(0, 4))}
          placeholder="50"
          placeholderTextColor="rgba(8,17,28,0.36)"
          keyboardType="number-pad"
          className="flex-1 bg-chalk px-4 py-3.5 text-ink font-mono"
          style={{ fontSize: 14 }}
        />
        <View className="bg-ink px-3 justify-center">
          <Text className="text-paper font-mono text-[10px]" style={{ letterSpacing: 1 }}>
            PER REF
          </Text>
        </View>
      </View>

      {/* Section: Date & Time */}
      <Sect style={{ marginTop: 28 }}>DATE & TIME</Sect>

      <FLabel>GAME DATE *</FLabel>
      {tournament && (
        <Text className="font-mono text-[9px] text-ink-40 uppercase mb-1.5" style={{ letterSpacing: 1 }}>
          MUST FALL WITHIN THE TOURNAMENT ({tournament.starts_on} → {tournament.ends_on})
        </Text>
      )}
      <CalendarRangePicker
        startDate={form.gameDate || null}
        endDate={form.gameDate || null}
        onChange={(start) => setForm((f) => ({ ...f, gameDate: start }))}
        minDate={tournament ? parseYMD(tournament.starts_on) : undefined}
        maxDate={tournament ? parseYMD(tournament.ends_on) : undefined}
      />

      <FLabel style={{ marginTop: 16 }}>TIP-OFF TIME *</FLabel>
      <DropdownSelect
        value={form.gameTime || null}
        options={TIME_OPTIONS}
        placeholder="SELECT TIME"
        onSelect={(v) => setForm((f) => ({ ...f, gameTime: v }))}
      />

      {/* Section: Game format */}
      <Sect style={{ marginTop: 28 }}>GAME FORMAT</Sect>

      <FLabel>PERIODS (OPTIONAL)</FLabel>
      <View className="flex-row gap-2">
        {([
          { id: "quarters", num: "4", label: "QUARTERS" },
          { id: "halves", num: "2", label: "HALVES" },
        ] as const).map((opt) => {
          const selected = form.gameFormat === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => {
                Haptics.selectionAsync();
                setForm((f) => ({
                  ...f,
                  gameFormat: selected ? "" : opt.id,
                  periodMinutes: "",
                }));
              }}
              className={`flex-1 py-4 border-[1.5px] items-center active:opacity-70 ${
                selected ? "border-signal bg-signal/10" : "border-ink bg-chalk"
              }`}
            >
              <Text
                className={`font-display ${selected ? "text-signal" : "text-ink"}`}
                style={{ fontSize: 28, letterSpacing: -1 }}
              >
                {opt.num}
              </Text>
              <Text
                className={`font-mono-bold text-[9px] uppercase ${
                  selected ? "text-signal/70" : "text-ink-40"
                }`}
                style={{ letterSpacing: 2 }}
              >
                {opt.label}
              </Text>
            </Pressable>
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
          {form.periodMinutes !== "" && (
            <Text className="font-mono text-[9px] text-ink-40 mt-1.5 uppercase" style={{ letterSpacing: 1 }}>
              GAME CLOCK TOTAL:{" "}
              {parseInt(form.periodMinutes, 10) * (form.gameFormat === "quarters" ? 4 : 2)} MIN
            </Text>
          )}
        </>
      )}

      {/* Section: Location */}
      <Sect style={{ marginTop: 28 }}>LOCATION</Sect>

      <FLabel>VENUE NAME *</FLabel>
      <FInput value={form.venueName} onChangeText={set("venueName")} placeholder="Austin Rec Center – Court A" autoCapitalize="words" />

      <FLabel style={{ marginTop: 16 }}>CITY *</FLabel>
      <FInput value={form.venueCity} onChangeText={set("venueCity")} placeholder="Austin" autoCapitalize="words" />

      <FLabel style={{ marginTop: 16 }}>STATE *</FLabel>
      <FInput
        value={form.venueState}
        onChangeText={(v) => set("venueState")(v.toUpperCase().slice(0, 2))}
        placeholder="TX"
        autoCapitalize="characters"
        maxLength={2}
        error={form.venueState.length === 2 && !stateValid ? "Invalid state" : undefined}
      />

      {/* Section: Requirements */}
      <Sect style={{ marginTop: 28 }}>REQUIREMENTS & NOTES</Sect>

      {/* Uniform: inherited from the tournament; only shown for standalone games */}
      {tournament ? (
        <View className="border border-ink-20 bg-chalk px-3 py-2.5 mb-1">
          <Text className="font-mono-bold text-[9px] text-ink-40 uppercase mb-0.5" style={{ letterSpacing: 1.5 }}>
            UNIFORM (FROM TOURNAMENT)
          </Text>
          <Text className="font-mono text-[11px] text-ink">
            {form.uniformRequirements || "—"}
          </Text>
        </View>
      ) : (
        <>
          <FLabel>REQUIRED UNIFORM *</FLabel>
          <FInput
            value={form.uniformRequirements}
            onChangeText={set("uniformRequirements")}
            placeholder="e.g. Black and white stripes, black pants"
            autoCapitalize="sentences"
          />
        </>
      )}

      <FLabel style={{ marginTop: 16 }}>GAME NOTES (OPTIONAL)</FLabel>
      <FInput
        value={form.hirerNote}
        onChangeText={set("hirerNote")}
        placeholder="Parking info, check-in instructions, special rules..."
        multiline
        numberOfLines={3}
        style={{ height: 80, textAlignVertical: "top", paddingTop: 12 }}
        autoCapitalize="sentences"
      />

      {/* Auto-accept toggle */}
      <Sect style={{ marginTop: 28 }}>ACCEPTANCE SETTINGS</Sect>

      <View
        className={`border border-ink flex-row items-center justify-between px-4 py-4 ${
          form.autoAccept ? "bg-hivis" : "bg-chalk"
        }`}
      >
        <View className="flex-1 pr-4">
          <Text className="font-mono-bold text-[11px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>
            {form.autoAccept ? "● AUTO-ACCEPT ON" : "○ MANUAL APPROVAL"}
          </Text>
          <Text className="font-mono text-[9px] text-ink-60 mt-0.5" style={{ letterSpacing: 1 }}>
            {form.autoAccept
              ? "Referees are instantly accepted when they apply."
              : "You review and approve each referee application."}
          </Text>
        </View>
        <Switch
          value={form.autoAccept}
          onValueChange={(v) => { Haptics.selectionAsync(); setForm((f) => ({ ...f, autoAccept: v })); }}
          trackColor={{ false: "rgba(8,17,28,0.15)", true: "#08111C" }}
          thumbColor={form.autoAccept ? "#C9F031" : PAPER}
        />
      </View>
    </ScrollScreen>
  );
}

function Sect({ children, style }: { children: string; style?: object }) {
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

function FInput({
  error,
  style,
  ...props
}: React.ComponentProps<typeof TextInput> & { error?: string }) {
  return (
    <>
      <TextInput
        placeholderTextColor="rgba(8,17,28,0.36)"
        className={`border-[1.5px] bg-chalk px-4 py-3.5 text-ink font-mono ${
          error ? "border-foul" : "border-ink"
        }`}
        style={[{ fontSize: 14 }, style]}
        {...props}
      />
      {error && (
        <Text className="text-foul font-mono text-[9px] mt-1 uppercase" style={{ letterSpacing: 1 }}>
          {error}
        </Text>
      )}
    </>
  );
}
