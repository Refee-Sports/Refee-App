"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  AffixField,
  BigChoice,
  Chip,
  ChipRow,
  DateField,
  Label,
  SectionLabel,
  SelectField,
  TextArea,
  TextField,
} from "@/components/ui/Field";
import { Spinner } from "@/components/ui/AppButton";
import { Icon } from "@/components/ui/Icon";
import { supabase } from "@/lib/supabase";
import {
  createGame,
  fetchGameForEdit,
  fetchMyHirerId,
  fetchTournamentById,
  updateGame,
  type TournamentRow,
} from "@/lib/director/queries";
import {
  AGE_REQUIRED_LEVELS,
  HALF_MINUTES,
  LEVELS,
  QUARTER_MINUTES,
  RULESETS,
} from "@/lib/basketball/options";

// 15-minute increments, 6:00 AM – 11:45 PM
const TIME_OPTIONS = Array.from({ length: 72 }, (_, i) => {
  const totalMin = 6 * 60 + i * 15;
  const h24 = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? "AM" : "PM";
  return {
    id: `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    label: `${h12}:${String(m).padStart(2, "0")} ${ampm}`,
  };
});

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export default function CreateGamePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <CreateGameInner />
    </Suspense>
  );
}

/** Port of refee-mobile/refee/app/(director)/game/create.tsx. */
function CreateGameInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tournamentId = params.get("tournamentId");
  const editId = params.get("editId");
  const copyFromId = params.get("copyFromId");
  const isEdit = !!editId;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconfirmNote, setReconfirmNote] = useState<string | null>(null);
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

  // New game under a tournament: inherit the tournament's defaults (ruleset,
  // format, uniform) as editable prefills, and constrain the date.
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

  // Prefill from an existing game: edit keeps everything; copy keeps everything
  // except date/time so the director can slot the new game fast.
  useEffect(() => {
    const sourceId = editId ?? copyFromId;
    if (!sourceId) return;
    (async () => {
      const { game } = await fetchGameForEdit(sourceId);
      if (!game) return;
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
    setLoading(true);
    setError(null);
    setReconfirmNote(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    const hirerId = await fetchMyHirerId(session.user.id);
    if (!hirerId) {
      setError("Director profile not found.");
      setLoading(false);
      return;
    }

    const periodMin = form.periodMinutes ? parseInt(form.periodMinutes, 10) : undefined;
    const numPeriods =
      form.gameFormat === "quarters" ? 4 : form.gameFormat === "halves" ? 2 : 0;

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
        setLoading(false);
        return;
      }
      if (refsNeedReconfirm) {
        // Same warning the app raises: material changes reset confirmations.
        window.alert(
          "Referees notified\n\nYou changed the time, venue, or pay. Confirmed referees have been asked to re-accept this game."
        );
      }
      router.push(`/director/game/${editId}`);
      return;
    }

    const { gameId, error: createErr } = await createGame(
      hirerId,
      tournamentId ?? null,
      gameArgs
    );
    if (createErr || !gameId) {
      setError(createErr?.message ?? "Failed to create game.");
      setLoading(false);
      return;
    }
    router.replace(`/director/game/${gameId}`);
  };

  const minuteOptions = (form.gameFormat === "quarters" ? QUARTER_MINUTES : HALF_MINUTES).map(
    (m) => ({ id: m, label: `${m} MINUTES` })
  );

  return (
    <div className="app-canvas app-canvas--form bg-paper">
      <div className="flex items-center justify-between border-b border-ink-20 px-5 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="x" size={16} />
        </button>
        <span
          className="font-mono-bold text-[11px] uppercase text-ink"
          style={{ letterSpacing: 2 }}
        >
          {isEdit ? "Edit game" : "Add game"}
        </span>
        <span className="h-9 w-9" />
      </div>

      <div className="flex-1 px-5 py-6">
        <SectionLabel>Matchup</SectionLabel>
        <Label>Home team *</Label>
        <TextField
          value={form.homeTeam}
          onChange={(e) => set("homeTeam")(e.target.value)}
          placeholder="e.g. Eastside Eagles"
        />
        <Label className="mt-4">Away team *</Label>
        <TextField
          value={form.awayTeam}
          onChange={(e) => set("awayTeam")(e.target.value)}
          placeholder="e.g. Westlake Warriors"
        />
        <Label className="mt-4">Level of play *</Label>
        <ChipRow>
          {LEVELS.map((l) => (
            <Chip
              key={l.id}
              label={l.label}
              selected={form.level === l.id}
              onClick={() => set("level")(l.id)}
            />
          ))}
        </ChipRow>
        <Label className="mt-4">{`Age group ${ageRequired ? "*" : "(optional)"}`}</Label>
        <TextField
          value={form.ageGroup}
          onChange={(e) => set("ageGroup")(e.target.value)}
          placeholder={
            ageRequired ? "e.g. U14, U16 — required for this level" : "e.g. U14, U16, Adult"
          }
        />
        <Label className="mt-4">Ruleset *</Label>
        <ChipRow>
          {RULESETS.map((r) => (
            <Chip
              key={r.id}
              label={r.label}
              selected={form.ruleset === r.id}
              onClick={() => set("ruleset")(r.id)}
            />
          ))}
        </ChipRow>
        {!!form.ruleset && (
          <>
            <Label className="mt-4">Rule modifications (optional)</Label>
            <TextArea
              value={form.rulesetModifications}
              onChange={(e) => set("rulesetModifications")(e.target.value)}
              placeholder="e.g. Running clock after 20-pt lead, no press U12..."
              rows={2}
            />
          </>
        )}

        <SectionLabel className="mt-7">Crew &amp; pay</SectionLabel>
        <Label>Referees needed *</Label>
        <div className="flex gap-2">
          {([2, 3] as const).map((n) => (
            <BigChoice
              key={n}
              num={String(n)}
              label="Refs"
              selected={form.crewSize === n}
              onClick={() => setForm((f) => ({ ...f, crewSize: n }))}
            />
          ))}
        </div>
        <Label className="mt-4">Pay per game ($) *</Label>
        <AffixField
          prefix="$"
          value={form.payPerGame}
          onChange={(e) => set("payPerGame")(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="50"
          inputMode="numeric"
        />

        <SectionLabel className="mt-7">Referee acceptance</SectionLabel>
        <div className="flex border border-ink" role="radiogroup" aria-label="Referee acceptance">
          {(
            [
              [true, "Auto-accept", "Refs are confirmed the moment they apply."],
              [false, "Manual approval", "Each application waits in Approvals for your yes or no."],
            ] as const
          ).map(([value, label, hint], idx) => {
            const selected = form.autoAccept === value;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setForm((f) => ({ ...f, autoAccept: value }))}
                className={`flex-1 px-4 py-3.5 text-left ${idx === 0 ? "border-r border-ink" : ""} ${
                  selected ? "bg-ink text-paper" : "bg-chalk text-ink hover:bg-paper"
                }`}
              >
                <span
                  className="block font-mono-bold text-[11px] uppercase"
                  style={{ letterSpacing: 1.5 }}
                >
                  {selected ? "● " : "○ "}
                  {label}
                </span>
                <span
                  className={`mt-1 block font-mono text-[9px] leading-4 ${
                    selected ? "text-paper/70" : "text-ink-60"
                  }`}
                  style={{ letterSpacing: 0.3 }}
                >
                  {hint}
                </span>
              </button>
            );
          })}
        </div>

        <SectionLabel className="mt-7">Date &amp; time</SectionLabel>
        <Label>Game date *</Label>
        {tournament && (
          <p
            className="mb-1.5 font-mono text-[9px] uppercase text-ink-40"
            style={{ letterSpacing: 1 }}
          >
            Must fall within the tournament ({tournament.starts_on} → {tournament.ends_on})
          </p>
        )}
        <DateField
          value={form.gameDate}
          onChange={set("gameDate")}
          min={tournament?.starts_on}
          max={tournament?.ends_on}
        />
        <Label className="mt-4">Tip-off time *</Label>
        <SelectField
          value={form.gameTime}
          onChange={set("gameTime")}
          options={TIME_OPTIONS}
          placeholder="SELECT TIME"
        />

        <SectionLabel className="mt-7">Game format</SectionLabel>
        <Label>Periods</Label>
        <div className="flex gap-2">
          {(
            [
              { id: "quarters", num: "4", label: "Quarters" },
              { id: "halves", num: "2", label: "Halves" },
            ] as const
          ).map((opt) => (
            <BigChoice
              key={opt.id}
              num={opt.num}
              label={opt.label}
              selected={form.gameFormat === opt.id}
              onClick={() => setForm((f) => ({ ...f, gameFormat: opt.id, periodMinutes: "" }))}
            />
          ))}
        </div>
        {form.gameFormat !== "" && (
          <>
            <Label className="mt-4">
              {form.gameFormat === "quarters" ? "Minutes per quarter *" : "Minutes per half *"}
            </Label>
            <SelectField
              value={form.periodMinutes}
              onChange={set("periodMinutes")}
              options={minuteOptions}
              placeholder="SELECT MINUTES"
            />
            {form.periodMinutes !== "" && (
              <p
                className="mt-1.5 font-mono text-[9px] uppercase text-ink-40"
                style={{ letterSpacing: 1 }}
              >
                Game clock total:{" "}
                {parseInt(form.periodMinutes, 10) * (form.gameFormat === "quarters" ? 4 : 2)} MIN
              </p>
            )}
          </>
        )}

        <SectionLabel className="mt-7">Location</SectionLabel>
        <Label>Venue name *</Label>
        <TextField
          value={form.venueName}
          onChange={(e) => set("venueName")(e.target.value)}
          placeholder="Austin Rec Center – Court A"
        />
        <Label className="mt-4">City *</Label>
        <TextField
          value={form.venueCity}
          onChange={(e) => set("venueCity")(e.target.value)}
          placeholder="Austin"
        />
        <Label className="mt-4">State *</Label>
        <TextField
          value={form.venueState}
          onChange={(e) => set("venueState")(e.target.value.toUpperCase().slice(0, 2))}
          placeholder="TX"
          maxLength={2}
          error={form.venueState.length === 2 && !stateValid ? "Invalid state code" : undefined}
        />

        <SectionLabel className="mt-7">Requirements &amp; notes</SectionLabel>
        {/* Uniform is inherited from the tournament; only editable standalone. */}
        {tournament ? (
          <div className="mb-1 border border-ink-20 bg-chalk px-3 py-2.5">
            <span
              className="mb-0.5 block font-mono-bold text-[9px] uppercase text-ink-40"
              style={{ letterSpacing: 1.5 }}
            >
              Uniform (from tournament)
            </span>
            <span className="font-mono text-[11px] text-ink">
              {form.uniformRequirements || "—"}
            </span>
          </div>
        ) : (
          <>
            <Label>Required uniform *</Label>
            <TextField
              value={form.uniformRequirements}
              onChange={(e) => set("uniformRequirements")(e.target.value)}
              placeholder="e.g. Black and white stripes, black pants"
            />
          </>
        )}
        <Label className="mt-4">Game notes (optional)</Label>
        <TextArea
          value={form.hirerNote}
          onChange={(e) => set("hirerNote")(e.target.value)}
          placeholder="Parking info, check-in instructions, special rules..."
          rows={3}
        />

      </div>

      <div className="action-bar sticky bottom-0">
        {error && (
          <p
            className="mb-3 font-mono text-[10px] uppercase text-foul"
            style={{ letterSpacing: 1 }}
          >
            {error}
          </p>
        )}
        {reconfirmNote && (
          <p
            className="mb-3 font-mono text-[10px] uppercase text-whistle"
            style={{ letterSpacing: 1 }}
          >
            {reconfirmNote}
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || loading}
          className={`flex w-full items-center justify-center gap-2 py-4 ${
            canSubmit && !loading
              ? "bg-ink text-paper hover:opacity-80"
              : "cursor-not-allowed bg-ink-20 text-ink-40"
          }`}
        >
          {loading ? (
            <Spinner />
          ) : (
            <span className="font-mono-bold" style={{ fontSize: 12, letterSpacing: 2.5 }}>
              {isEdit ? "SAVE CHANGES" : "CREATE GAME"}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
