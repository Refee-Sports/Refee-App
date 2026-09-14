"use client";

import "@/lib/core";
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
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ReviewTable } from "@/components/schedule/ReviewTable";
import { supabase } from "@/lib/supabase";
import {
  createTournament,
  fetchMyHirerId,
  fetchTournamentById,
  updateTournament,
} from "@/lib/director/queries";
import { HALF_MINUTES, LEVELS, QUARTER_MINUTES, RULESETS } from "@/lib/basketball/options";
import { REGION_CODE_ERROR, US_STATES } from "@refee/core/geo/regions";
import {
  extractSchedule,
  importScheduleGames,
  readUpload,
  type ExtractedSchedule,
} from "@refee/core/schedule/ai-import";
import { parseTemplateCsv } from "@refee/core/schedule/template";
import { tournamentDraftFromSchedule } from "@refee/core/schedule/prefill";
import { checkRows } from "@/lib/schedule/review";
import {
  emptyRow,
  rowsFromSchedule,
  savePendingImport,
  soleLevel,
  takeCarriedSchedule,
  type ReviewRowState,
} from "@/lib/schedule/rows";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf,.csv,text/csv,.txt";
const LIMITS = { image: 5 * 1024 * 1024, pdf: 10 * 1024 * 1024, text: 1024 * 1024 };

export default function CreateTournamentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <CreateTournamentInner />
    </Suspense>
  );
}

/** Port of refee-mobile/refee/app/(director)/tournament/create.tsx, plus start-from-a-file. */
function CreateTournamentInner() {
  const router = useRouter();
  const editId = useSearchParams().get("editId");
  const isEdit = !!editId;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    startsOn: "",
    endsOn: "",
    venueName: "",
    venueCity: "",
    venueState: "",
    venueAddress: "",
    venueZip: "",
    courts: "",
    arrivalNotes: "",
    ruleset: "",
    rulesetModifications: "",
    gameFormat: "" as "" | "quarters" | "halves",
    periodMinutes: "",
    uniformRequirements: "",
    payPerGame: "",
  });

  // Start from a file: one read fills the tournament and lists its games.
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [readNote, setReadNote] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [gamesElsewhere, setGamesElsewhere] = useState(0);
  const [rows, setRows] = useState<ReviewRowState[]>([]);
  const [defaultLevel, setDefaultLevel] = useState("high_school");
  const [crewSize, setCrewSize] = useState<2 | 3>(2);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { tournament: t } = await fetchTournamentById(editId);
      if (!t) return;
      setForm({
        name: t.name,
        description: t.description ?? "",
        startsOn: t.starts_on,
        endsOn: t.ends_on,
        venueName: t.venue_name ?? "",
        venueCity: t.venue_city,
        venueState: t.venue_state,
        venueAddress: t.venue_address ?? "",
        venueZip: t.venue_zip ?? "",
        courts: (t.courts ?? []).join("\n"),
        arrivalNotes: t.arrival_notes ?? "",
        ruleset: t.ruleset ?? "",
        rulesetModifications: t.ruleset_modifications ?? "",
        gameFormat: (t.game_format ?? "") as "" | "quarters" | "halves",
        periodMinutes: t.period_minutes ? String(t.period_minutes) : "",
        uniformRequirements: t.uniform_requirements ?? "",
        payPerGame: t.pay_per_game ? String(t.pay_per_game) : "",
      });
    })();
  }, [editId]);

  const applySchedule = (s: ExtractedSchedule, source: string) => {
    const d = tournamentDraftFromSchedule(s);
    // Fill what's still blank; anything the director already typed stays.
    setForm((f) => ({
      ...f,
      name: f.name || d.name,
      startsOn: f.startsOn || d.startsOn,
      endsOn: f.endsOn || d.endsOn,
      venueName: f.venueName || d.venueName,
      venueAddress: f.venueAddress || d.venueAddress,
      venueCity: f.venueCity || d.venueCity,
      venueState: f.venueState || d.venueState,
      venueZip: f.venueZip || (/^\d{5}$/.test(d.venueZip) ? d.venueZip : ""),
      courts: f.courts || d.courts.join("\n"),
      arrivalNotes: f.arrivalNotes || d.arrivalNotes.slice(0, 280),
    }));
    setRows(rowsFromSchedule(s, d.startsOn && d.startsOn === d.endsOn ? d.startsOn : ""));
    setDefaultLevel((lvl) => soleLevel(s) ?? lvl);
    setProblems(s.problems);
    setGamesElsewhere(d.gamesElsewhere);
    const n = s.games.length;
    setReadNote(
      `Filled from ${source}${n ? `, with ${n} game${n !== 1 ? "s" : ""}` : ""}. Check the details, add what the file couldn't say, and review the games below.`
    );
  };

  // A multi-game file read on the single-game form arrives here already read.
  useEffect(() => {
    if (isEdit) return;
    const carried = takeCarriedSchedule();
    if (carried) applySchedule(carried, "your file");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  const readFile = async (file: File | null | undefined) => {
    if (!file) return;
    setReadError(null);
    setReadNote(null);
    const kind = file.type === "application/pdf" ? "pdf" : file.type.startsWith("image/") ? "image" : "text";
    if (file.size > LIMITS[kind]) {
      setReadError(
        kind === "image"
          ? "Photos must be 5 MB or smaller."
          : kind === "pdf"
            ? "PDFs must be 10 MB or smaller."
            : "CSV files must be 1 MB or smaller."
      );
      return;
    }
    setReading(true);
    const upload = await readUpload(file);
    // A sheet in the Refee template is read right here: instant, and no AI.
    const isText = upload.mimeType.startsWith("text/") || /\.(csv|tsv|txt)$/i.test(file.name);
    const local = isText ? parseTemplateCsv(upload.data) : null;
    if (local) {
      setReading(false);
      applySchedule(local, file.name);
      return;
    }
    const { schedule, error: err } = await extractSchedule(upload, { mode: "tournament" });
    setReading(false);
    if (err || !schedule) {
      setReadError(err?.message ?? "Couldn't read that file.");
      return;
    }
    applySchedule(schedule, file.name);
  };

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const hasGames = !isEdit && rows.length > 0;
  const range = /^\d{4}-\d{2}-\d{2}$/.test(form.startsOn) && /^\d{4}-\d{2}-\d{2}$/.test(form.endsOn)
    ? { starts_on: form.startsOn, ends_on: form.endsOn }
    : null;
  const checked = checkRows(rows, defaultLevel, range);
  const ready = hasGames ? checked.filter((c) => c.row.include && c.errors.length === 0) : [];
  const skipped = hasGames ? checked.filter((c) => c.row.include && c.errors.length > 0).length : 0;
  const pay = parseInt(form.payPerGame, 10);
  const periodMin = parseInt(form.periodMinutes, 10);
  const periods = form.gameFormat === "quarters" ? 4 : form.gameFormat === "halves" ? 2 : 0;

  const stateValid = !form.venueState || US_STATES.includes(form.venueState.toUpperCase());
  const detailsComplete =
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
  // Games need their pay; a tournament created on its own doesn't.
  const payNeeded = ready.length > 0 && !(pay >= 1);
  const canSubmit = detailsComplete && !payNeeded;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

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
      venueCity: form.venueCity.trim(),
      venueState: form.venueState.trim().toUpperCase(),
      venueAddress: form.venueAddress.trim(),
      venueZip: form.venueZip.trim(),
      courts: form.courts
        .split("\n")
        .map((c) => c.trim())
        .filter(Boolean),
      arrivalNotes: form.arrivalNotes.trim(),
      ruleset: form.ruleset,
      rulesetModifications: form.rulesetModifications.trim() || undefined,
      gameFormat: (form.gameFormat || undefined) as "quarters" | "halves" | undefined,
      periodMinutes: periodMin || undefined,
      uniformRequirements: form.uniformRequirements.trim() || undefined,
      payPerGame: pay >= 1 ? pay : null,
    };

    if (isEdit && editId) {
      const { error: updateErr } = await updateTournament(editId, args);
      setLoading(false);
      if (updateErr) {
        setError(updateErr.message);
        return;
      }
      router.push(`/director/tournament/${editId}`);
      return;
    }

    const { tournamentId, error: createErr } = await createTournament(hirerId, args);
    if (createErr || !tournamentId) {
      setLoading(false);
      setError(createErr?.message ?? "Could not create tournament.");
      return;
    }
    if (ready.length === 0) {
      router.push(`/director/tournament/${tournamentId}`);
      return;
    }

    // The games inherit the tournament's venue, address, map pin and arrival notes.
    const { count, error: importErr } = await importScheduleGames(
      tournamentId,
      ready.map(({ effective: r }) => ({
        homeTeam: r.homeTeam.trim(),
        awayTeam: r.awayTeam.trim(),
        startsLocal: `${r.date}T${r.time}`,
        level: r.level,
        teamLevel: r.level === "high_school" ? r.teamLevel || null : null,
        ageGroup: r.level === "youth_rec" ? r.ageGroup.trim() || null : null,
        crewSize,
        payPerGame: pay,
        durationMinutes: periods * periodMin,
        gameFormat: form.gameFormat || null,
        periodMinutes: periodMin,
        court: r.court.trim() || null,
      }))
    );
    if (importErr) {
      // The tournament exists; its import page picks up the reviewed games.
      savePendingImport(tournamentId, { rows, level: defaultLevel, crewSize, error: importErr.message });
      router.push(`/director/tournament/${tournamentId}/import`);
      return;
    }
    router.push(`/director/tournament/${tournamentId}?imported=${count}`);
  };

  const minuteOptions = (form.gameFormat === "quarters" ? QUARTER_MINUTES : HALF_MINUTES).map(
    (m) => ({ id: m, label: `${m} MINUTES` })
  );
  const levelOptions = LEVELS.map((l) => ({ id: l.id, label: l.label }));

  const submitLabel = isEdit
    ? "SAVE CHANGES"
    : payNeeded
      ? "SET PAY PER GAME TO ADD THE GAMES"
      : ready.length > 0
        ? `CREATE TOURNAMENT + ${ready.length} GAME${ready.length !== 1 ? "S" : ""}`
        : "CREATE TOURNAMENT";

  return (
    <div className="app-canvas app-canvas--form bg-paper">
      <ScreenHeader
        title={isEdit ? "Edit tournament" : "New tournament"}
        backHref="/director/tournaments"
      />

      <div className="flex-1 px-5 pb-6">
        <h1
          className="mb-6 font-display text-ink"
          style={{ fontSize: 32, letterSpacing: -1.2, lineHeight: "32px" }}
        >
          {isEdit ? "EDIT TOURNAMENT" : "NEW TOURNAMENT"}
        </h1>

        {!isEdit ? (
          <div className="mb-7 border border-dashed border-ink px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="min-w-0 flex-1">
                <span className="block font-mono-bold text-[10px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
                  Start from a flyer, schedule or CSV
                </span>
                <span className="mt-0.5 block font-mono text-[9px] uppercase leading-4 text-ink-60" style={{ letterSpacing: 1 }}>
                  Fills in the tournament and lists its games. Or skip this and fill it in yourself.
                </span>
              </span>
              <label
                className={`flex h-9 cursor-pointer items-center gap-1.5 bg-ink px-3 text-paper hover:opacity-80 ${
                  reading ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {reading ? <Spinner /> : <Icon name="upload" size={12} />}
                <span className="font-mono-bold text-[9px] uppercase" style={{ letterSpacing: 1.5 }}>
                  {reading ? "Reading…" : rows.length > 0 ? "Choose another file" : "Choose file"}
                </span>
                <input
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  onChange={(e) => {
                    void readFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {readNote ? (
              <p className="mt-2 font-mono text-[9px] uppercase leading-4 text-court" style={{ letterSpacing: 1 }}>
                {readNote}
              </p>
            ) : null}
            {readError ? (
              <p role="alert" className="mt-2 font-mono text-[9px] uppercase leading-4 text-foul" style={{ letterSpacing: 1 }}>
                {readError}
              </p>
            ) : null}
            {problems.length > 0 ? (
              <div className="mt-2 border-l-[3px] border-whistle bg-whistle/10 px-3 py-2">
                <span className="mb-1 block font-mono-bold text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1.5 }}>
                  Check these
                </span>
                {problems.map((p) => (
                  <p key={p} className="text-[12px] leading-5 text-ink">
                    {p}
                  </p>
                ))}
              </div>
            ) : null}
            <p className="mt-2 font-mono text-[8px] uppercase text-ink-40" style={{ letterSpacing: 1 }}>
              JPG · PNG · WebP · PDF · CSV · The file is read to fill this page and isn&apos;t kept.
            </p>
          </div>
        ) : null}

        <SectionLabel>Tournament details</SectionLabel>
        <Label>Tournament name *</Label>
        <TextField
          value={form.name}
          onChange={(e) => set("name")(e.target.value)}
          placeholder="e.g. Austin Hoops Classic 2026"
        />
        <Label className="mt-4">Description (optional)</Label>
        <TextArea
          value={form.description}
          onChange={(e) => set("description")(e.target.value)}
          placeholder="Tell referees what to expect..."
          rows={3}
        />

        <SectionLabel className="mt-7">Dates *</SectionLabel>
        <Label>Starts on</Label>
        <DateField value={form.startsOn} onChange={set("startsOn")} />
        <Label className="mt-4">Ends on</Label>
        <DateField value={form.endsOn} onChange={set("endsOn")} min={form.startsOn || undefined} />

        <SectionLabel className="mt-7">Ruleset *</SectionLabel>
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
              placeholder="e.g. Running clock after 20-pt lead..."
              rows={2}
            />
          </>
        )}

        <SectionLabel className="mt-7">Game format *</SectionLabel>
        <Label>Periods — applies to every game</Label>
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
          </>
        )}

        <SectionLabel className="mt-7">Pay</SectionLabel>
        <Label>{`Pay per game ($)${hasGames ? " *" : " (optional)"}`}</Label>
        <AffixField
          prefix="$"
          value={form.payPerGame}
          onChange={(e) => set("payPerGame")(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="75"
          inputMode="numeric"
        />
        <p className="mt-1.5 font-mono text-[9px] uppercase text-ink-40" style={{ letterSpacing: 1 }}>
          Per referee · every game in the tournament starts with it
        </p>

        <SectionLabel className="mt-7">Uniform *</SectionLabel>
        <Label>Required uniform — applies to every game</Label>
        <TextField
          value={form.uniformRequirements}
          onChange={(e) => set("uniformRequirements")(e.target.value)}
          placeholder="e.g. Black and white stripes, black pants"
        />

        <SectionLabel className="mt-7">Venue</SectionLabel>
        <p
          className="mb-3 font-mono text-[9px] uppercase text-ink-40"
          style={{ letterSpacing: 1 }}
        >
          Entered once — every game in the tournament starts with it.
        </p>
        <Label>Venue name *</Label>
        <TextField
          value={form.venueName}
          onChange={(e) => set("venueName")(e.target.value)}
          placeholder="e.g. Adelphi University"
        />
        <Label className="mt-4">Street address *</Label>
        <TextField
          value={form.venueAddress}
          onChange={(e) => set("venueAddress")(e.target.value)}
          placeholder="e.g. 1 South Ave"
        />
        <Label className="mt-4">City *</Label>
        <TextField
          value={form.venueCity}
          onChange={(e) => set("venueCity")(e.target.value)}
          placeholder="Austin"
        />
        <Label className="mt-4">State * (2-letter code)</Label>
        <TextField
          value={form.venueState}
          onChange={(e) => set("venueState")(e.target.value.toUpperCase().slice(0, 2))}
          placeholder="TX"
          maxLength={2}
          error={form.venueState.length === 2 && !stateValid ? REGION_CODE_ERROR : undefined}
        />
        <Label className="mt-4">ZIP *</Label>
        <TextField
          value={form.venueZip}
          onChange={(e) => set("venueZip")(e.target.value.replace(/\D/g, "").slice(0, 5))}
          placeholder="11530"
          maxLength={5}
          error={form.venueZip !== "" && form.venueZip.length !== 5 ? "5-digit ZIP" : undefined}
        />

        <Label className="mt-4">Courts or gyms (optional, one per line)</Label>
        <TextArea
          value={form.courts}
          onChange={(e) => set("courts")(e.target.value)}
          placeholder={"Main floor\nAux gym · Court 2"}
          rows={3}
        />
        <Label className="mt-4">Arrival notes (optional)</Label>
        <TextArea
          value={form.arrivalNotes}
          onChange={(e) => set("arrivalNotes")(e.target.value.slice(0, 280))}
          placeholder="e.g. Doors 1:00 PM. Park in Lot 1 and check in at the scorer's table."
          rows={2}
        />
        <p
          className="mt-1.5 font-mono text-[9px] uppercase text-ink-40"
          style={{ letterSpacing: 1 }}
        >
          {form.arrivalNotes.length}/280 · shown to every crew above the map
        </p>

        {hasGames ? (
          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between gap-3">
              <SectionLabel>{`Games from your file (${rows.length})`}</SectionLabel>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRows((rs) => [...rs, emptyRow(range && range.starts_on === range.ends_on ? range.starts_on : "")])}
                  className="flex items-center gap-1 font-mono-bold text-[9px] uppercase text-signal hover:underline"
                  style={{ letterSpacing: 1.5 }}
                >
                  <Icon name="plus" size={11} /> Add row
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRows([]);
                    setProblems([]);
                    setReadNote(null);
                  }}
                  className="font-mono-bold text-[9px] uppercase text-ink-60 hover:text-foul"
                  style={{ letterSpacing: 1.5 }}
                >
                  Don&apos;t add games
                </button>
              </div>
            </div>
            {gamesElsewhere > 0 ? (
              <p className="mb-2 font-mono text-[9px] uppercase leading-4 text-ink-60" style={{ letterSpacing: 1 }}>
                {gamesElsewhere} game{gamesElsewhere !== 1 ? "s" : ""} in the file list another venue. They&apos;ll be
                posted at this tournament&apos;s venue; change them after creating if needed.
              </p>
            ) : null}
            <ReviewTable
              rows={rows}
              onChange={setRows}
              defaultLevel={defaultLevel}
              range={range}
              courts={form.courts.split("\n").map((c) => c.trim()).filter(Boolean)}
              listId="new-tournament-courts"
            />
            <div className="mt-4 grid gap-x-8 gap-y-2 lg:grid-cols-2">
              <div>
                <Label>Level (when a game doesn&apos;t say)</Label>
                <SelectField
                  value={defaultLevel}
                  onChange={setDefaultLevel}
                  options={levelOptions}
                  placeholder="SELECT LEVEL"
                />
              </div>
              <div>
                <Label>Referees per game</Label>
                <div className="flex gap-2">
                  {([2, 3] as const).map((n) => (
                    <BigChoice
                      key={n}
                      num={String(n)}
                      label="Refs"
                      selected={crewSize === n}
                      onClick={() => setCrewSize(n)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
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
        {hasGames ? (
          <p className="mb-3 font-mono text-[10px] uppercase leading-4 text-ink-60" style={{ letterSpacing: 0.8 }}>
            {ready.length} game{ready.length !== 1 ? "s" : ""} ready
            {skipped ? ` · ${skipped} need fixing (they'll be skipped)` : ""}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSubmit()}
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
            <>
              <span className="font-mono-bold" style={{ fontSize: 12, letterSpacing: 2.5 }}>
                {submitLabel}
              </span>
              <span className="font-mono-bold text-base">→</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
