"use client";

// Add games to an existing tournament from a photo, PDF or CSV. The file is
// read into an editable table; nothing is posted until the director (or the
// tournament's accepted assignor) reviews it and presses Create.
import "@/lib/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/AppButton";
import { AffixField, BigChoice, Label, SectionLabel, SelectField, TextArea } from "@/components/ui/Field";
import { ReviewTable } from "@/components/schedule/ReviewTable";
import { fetchTournamentById, type TournamentRow } from "@/lib/director/queries";
import { HALF_MINUTES, LEVELS, QUARTER_MINUTES } from "@/lib/basketball/options";
import {
  extractSchedule,
  importScheduleGames,
  readUpload,
  type ExtractedSchedule,
} from "@refee/core/schedule/ai-import";
import { buildScheduleTemplate, parseTemplateCsv, TEMPLATE_FILE_NAME } from "@refee/core/schedule/template";
import { formatDateOnly, zoneName } from "@refee/core/time";
import { checkRows } from "@/lib/schedule/review";
import {
  emptyRow,
  rowsFromSchedule,
  soleLevel,
  takeCarriedSchedule,
  takePendingImport,
  type ReviewRowState,
} from "@/lib/schedule/rows";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf,.csv,text/csv,.txt";
const LIMITS = { image: 5 * 1024 * 1024, pdf: 10 * 1024 * 1024, text: 1024 * 1024 };

export function ScheduleImport({
  tournamentId,
  backHref,
  canEditTournament,
}: {
  tournamentId: string;
  backHref: string;
  /** Directors can fix missing tournament details; assignors ask the director. */
  canEditTournament: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tournament, setTournament] = useState<TournamentRow | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [rows, setRows] = useState<ReviewRowState[]>([]);
  const [read, setRead] = useState(false);
  const [defaults, setDefaults] = useState({
    level: "high_school",
    crewSize: 2 as 2 | 3,
    payPerGame: "",
    gameFormat: "" as "" | "quarters" | "halves",
    periodMinutes: "",
    arrivalNotes: "",
  });

  useEffect(() => {
    void fetchTournamentById(tournamentId).then(({ tournament: t }) => {
      setTournament(t);
      if (!t) return;
      // Start from the tournament's own format and pay, as the single-game form does.
      setDefaults((d) => ({
        ...d,
        gameFormat: d.gameFormat || (t.game_format === "quarters" || t.game_format === "halves" ? t.game_format : ""),
        periodMinutes: d.periodMinutes || (t.period_minutes ? String(t.period_minutes) : ""),
        payPerGame: d.payPerGame || (t.pay_per_game ? String(t.pay_per_game) : ""),
      }));
    });
    // Games reviewed while creating this tournament that didn't post: pick up where they left off.
    const pending = takePendingImport(tournamentId);
    if (pending) {
      setRows(pending.rows);
      setDefaults((d) => ({ ...d, level: pending.level || d.level, crewSize: pending.crewSize }));
      setError(`The tournament was created, but its games weren't posted: ${pending.error} Check them and create them here.`);
      setRead(true);
      return;
    }
    // A multi-game file read on the single-game form, already read: no re-upload.
    const carried = takeCarriedSchedule();
    if (carried) apply(carried);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  const singleDay =
    tournament && tournament.starts_on === tournament.ends_on ? tournament.starts_on.slice(0, 10) : "";

  // Imported games take the tournament's address, ruleset and uniform, so the
  // tournament has to be complete first (the backend refuses otherwise).
  const missingDetails = tournament
    ? [
        !tournament.venue_address?.trim() && "street address",
        !/^\d{5}$/.test(tournament.venue_zip ?? "") && "ZIP code",
        !tournament.ruleset && "ruleset",
        !tournament.uniform_requirements?.trim() && "uniform",
      ].filter((d): d is string => typeof d === "string")
    : [];

  const downloadTemplate = () => {
    const csv = buildScheduleTemplate({ date: tournament?.starts_on.slice(0, 10), courts: tournament?.courts });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = TEMPLATE_FILE_NAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const choose = (f: File | null | undefined) => {
    setError(null);
    if (!f) return;
    const kind = f.type === "application/pdf" ? "pdf" : f.type.startsWith("image/") ? "image" : "text";
    if (f.size > LIMITS[kind]) {
      setError(
        kind === "image"
          ? "Photos must be 5 MB or smaller."
          : kind === "pdf"
            ? "PDFs must be 10 MB or smaller."
            : "CSV files must be 1 MB or smaller."
      );
      return;
    }
    setFile(f);
  };

  const apply = (s: ExtractedSchedule) => {
    setRows(rowsFromSchedule(s, singleDay));
    setProblems(s.problems);
    const level = soleLevel(s);
    setDefaults((d) => ({
      ...d,
      level: level ?? d.level,
      arrivalNotes: d.arrivalNotes || (!tournament?.arrival_notes ? s.event_notes ?? "" : ""),
    }));
    setRead(true);
  };

  const readFile = async () => {
    if (!file) return;
    setReading(true);
    setError(null);
    setProblems([]);
    const upload = await readUpload(file);
    // A sheet in our template's shape is read right here: instant, and no AI.
    const isText = upload.mimeType.startsWith("text/") || /\.(csv|tsv|txt)$/i.test(file.name);
    const local = isText ? parseTemplateCsv(upload.data, { year: tournament?.starts_on.slice(0, 4) }) : null;
    if (local) {
      setReading(false);
      apply(local);
      return;
    }
    const { schedule, error: err } = await extractSchedule(upload, { tournamentId, mode: "tournament" });
    setReading(false);
    if (err || !schedule) {
      setError(err?.message ?? "Couldn't read that file.");
      return;
    }
    apply(schedule);
  };

  const checked = checkRows(rows, defaults.level, tournament);
  const ready = checked.filter((c) => c.row.include && c.errors.length === 0);
  const skipped = checked.filter((c) => c.row.include && c.errors.length > 0).length;
  const pay = parseInt(defaults.payPerGame, 10);
  const periodMinutes = parseInt(defaults.periodMinutes, 10);
  const periods = defaults.gameFormat === "quarters" ? 4 : defaults.gameFormat === "halves" ? 2 : 0;
  // Game clock total, stored the same way the single-game form stores it.
  const duration = periods && periodMinutes ? periods * periodMinutes : 0;
  const canPost = ready.length > 0 && pay >= 1 && duration >= 15 && missingDetails.length === 0 && !posting;
  const minuteOptions = (defaults.gameFormat === "quarters" ? QUARTER_MINUTES : HALF_MINUTES).map((m) => ({
    id: m,
    label: `${m} MINUTES`,
  }));

  const post = async () => {
    if (!canPost) return;
    setPosting(true);
    setError(null);
    const { count, error: err } = await importScheduleGames(
      tournamentId,
      ready.map(({ effective: r }) => ({
        homeTeam: r.homeTeam.trim(),
        awayTeam: r.awayTeam.trim(),
        startsLocal: `${r.date}T${r.time}`,
        level: r.level,
        teamLevel: r.level === "high_school" ? r.teamLevel || null : null,
        ageGroup: r.level === "youth_rec" ? r.ageGroup.trim() || null : null,
        crewSize: defaults.crewSize,
        payPerGame: pay,
        durationMinutes: duration,
        gameFormat: defaults.gameFormat || null,
        periodMinutes: periodMinutes || null,
        court: r.court.trim() || null,
        arrivalNotes: defaults.arrivalNotes.trim() || null,
      }))
    );
    setPosting(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.replace(`${backHref}?imported=${count}`);
  };

  const levelOptions = LEVELS.map((l) => ({ id: l.id, label: l.label }));

  return (
    <div className="app-canvas bg-paper pb-6">
      <div className="flex items-center gap-3 px-5 py-3 sm:px-0 lg:pt-5">
        <Link
          href={backHref}
          aria-label="Back"
          className="flex h-9 w-9 shrink-0 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="chevron-left" size={18} />
        </Link>
        <span
          className="min-w-0 flex-1 truncate font-mono-bold text-[10px] uppercase text-ink-60"
          style={{ letterSpacing: 2 }}
        >
          {tournament?.name.toUpperCase() ?? "Tournament"}
        </span>
      </div>

      <div className="px-5 pb-4 sm:px-0">
        <h1 className="font-display uppercase text-ink" style={{ fontSize: 30, lineHeight: "30px", letterSpacing: -1 }}>
          Import games<span className="text-signal">.</span>
        </h1>
        <p className="mt-2 max-w-xl font-mono text-[10px] uppercase leading-4 text-ink-60" style={{ letterSpacing: 1 }}>
          Upload a flyer, a screenshot, a PDF or a spreadsheet. The games are read into a table you check before
          anything is posted.
          {tournament
            ? ` ${
                singleDay
                  ? formatDateOnly(tournament.starts_on, { weekday: "short", month: "short", day: "numeric" })
                  : `${formatDateOnly(tournament.starts_on, { month: "short", day: "numeric" })}–${formatDateOnly(
                      tournament.ends_on,
                      { month: "short", day: "numeric" }
                    )}`
              } · times are ${zoneName(tournament.timezone)}.`
            : ""}
        </p>
      </div>

      {missingDetails.length > 0 ? (
        <div role="alert" className="mx-5 mb-5 border border-foul bg-foul/10 px-4 py-3.5 sm:mx-0">
          <p className="font-mono-bold text-[10px] uppercase text-foul" style={{ letterSpacing: 1.5 }}>
            Finish the tournament before importing
          </p>
          <p className="mt-1 text-[13px] leading-5 text-ink">
            Imported games use the tournament&apos;s details, and referees need them to find and work the game.
            Missing: {missingDetails.join(", ")}.
          </p>
          {canEditTournament ? (
            <Link
              href={`/director/tournament/create?editId=${tournamentId}`}
              className="mt-3 inline-flex h-9 items-center bg-ink px-3 font-mono-bold text-[9px] uppercase text-paper hover:opacity-80"
              style={{ letterSpacing: 1.5 }}
            >
              Edit tournament
            </Link>
          ) : (
            <p className="mt-2 font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
              Ask the tournament director to add them.
            </p>
          )}
        </div>
      ) : null}

      {/* 1 · Upload */}
      <div className="px-5 sm:px-0">
        <SectionLabel>1 · Upload</SectionLabel>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border border-ink bg-chalk px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block font-mono-bold text-[10px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
              Working from a spreadsheet?
            </span>
            <span className="mt-0.5 block font-mono text-[9px] uppercase leading-4 text-ink-60" style={{ letterSpacing: 1 }}>
              Fill in the Refee CSV template and it&apos;s read instantly, no AI needed. Excel and Google Sheets both save
              CSV.
            </span>
          </span>
          <button
            type="button"
            onClick={downloadTemplate}
            className="flex h-9 shrink-0 items-center border border-ink bg-paper px-3 font-mono-bold text-[9px] uppercase text-ink hover:bg-ink hover:text-paper"
            style={{ letterSpacing: 1.5 }}
          >
            Download CSV template
          </button>
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            choose(e.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col items-center gap-3 border-2 border-dashed px-5 py-8 text-center ${
            dragging ? "border-signal bg-signal/10" : "border-ink-20 bg-chalk"
          }`}
        >
          <Icon name="upload" size={22} />
          <p className="font-mono-bold text-[10px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
            {file ? file.name : "Drop a photo, PDF or CSV here"}
          </p>
          <p className="font-mono text-[9px] uppercase text-ink-40" style={{ letterSpacing: 1 }}>
            JPG · PNG · WebP up to 5 MB · PDF up to 10 MB · CSV
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="border border-ink bg-paper px-4 py-2.5 font-mono-bold text-[9px] uppercase text-ink hover:bg-ink hover:text-paper"
              style={{ letterSpacing: 1.5 }}
            >
              {file ? "Choose another file" : "Choose file"}
            </button>
            <button
              type="button"
              onClick={() => void readFile()}
              disabled={!file || reading || missingDetails.length > 0}
              className="flex items-center gap-2 bg-ink px-4 py-2.5 font-mono-bold text-[9px] uppercase text-paper hover:opacity-80 disabled:bg-ink-20 disabled:text-ink-40"
              style={{ letterSpacing: 1.5 }}
            >
              {reading ? <Spinner /> : null}
              {reading ? "Reading your schedule…" : "Read schedule"}
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <p className="font-mono text-[8px] uppercase text-ink-40" style={{ letterSpacing: 1 }}>
            The file is read to fill this table and isn&apos;t kept.
          </p>
        </div>
        {error ? (
          <p
            role="alert"
            className="mt-3 border border-foul bg-foul/10 px-3 py-2 font-mono text-[10px] uppercase text-foul"
            style={{ letterSpacing: 1 }}
          >
            {error}
          </p>
        ) : null}
        {problems.length > 0 ? (
          <div className="mt-3 border-l-[3px] border-whistle bg-whistle/10 px-3 py-2">
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
      </div>

      {/* 2 · Review */}
      {read ? (
        <div className="mt-7 px-5 sm:px-0">
          <div className="mb-2 flex items-center justify-between">
            <SectionLabel>{`2 · Review · ${rows.length} game${rows.length !== 1 ? "s" : ""}`}</SectionLabel>
            <button
              type="button"
              onClick={() => setRows((rs) => [...rs, emptyRow(singleDay)])}
              className="flex items-center gap-1 font-mono-bold text-[9px] uppercase text-signal hover:underline"
              style={{ letterSpacing: 1.5 }}
            >
              <Icon name="plus" size={11} /> Add row
            </button>
          </div>
          <ReviewTable
            rows={rows}
            onChange={setRows}
            defaultLevel={defaults.level}
            range={tournament}
            courts={tournament?.courts ?? []}
            listId={`courts-${tournamentId}`}
          />

          {/* 3 · Defaults */}
          <div className="mt-7 grid gap-x-8 gap-y-2 lg:grid-cols-2">
            <div>
              <SectionLabel>3 · For every game</SectionLabel>
              <Label>Level (when a row doesn&apos;t say)</Label>
              <SelectField
                value={defaults.level}
                onChange={(v) => setDefaults((d) => ({ ...d, level: v }))}
                options={levelOptions}
                placeholder="SELECT LEVEL"
              />
              <Label className="mt-4">Referees per game</Label>
              <div className="flex gap-2">
                {([2, 3] as const).map((n) => (
                  <BigChoice
                    key={n}
                    num={String(n)}
                    label="Refs"
                    selected={defaults.crewSize === n}
                    onClick={() => setDefaults((d) => ({ ...d, crewSize: n }))}
                  />
                ))}
              </div>
              <Label className="mt-4">Game format *</Label>
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
                    selected={defaults.gameFormat === opt.id}
                    onClick={() => setDefaults((d) => ({ ...d, gameFormat: opt.id, periodMinutes: "" }))}
                  />
                ))}
              </div>
              {defaults.gameFormat ? (
                <>
                  <Label className="mt-4">
                    {defaults.gameFormat === "quarters" ? "Minutes per quarter *" : "Minutes per half *"}
                  </Label>
                  <SelectField
                    value={defaults.periodMinutes}
                    onChange={(v) => setDefaults((d) => ({ ...d, periodMinutes: v }))}
                    options={minuteOptions}
                    placeholder="SELECT MINUTES"
                  />
                  {duration ? (
                    <p className="mt-1.5 font-mono text-[9px] uppercase text-ink-40" style={{ letterSpacing: 1 }}>
                      Game clock total: {duration} MIN
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
            <div className="lg:pt-8">
              <Label>Pay per game ($) *</Label>
              <AffixField
                prefix="$"
                value={defaults.payPerGame}
                onChange={(e) => setDefaults((d) => ({ ...d, payPerGame: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                placeholder="75"
                inputMode="numeric"
              />
              <Label className="mt-4">Arrival notes (optional)</Label>
              <TextArea
                value={defaults.arrivalNotes}
                onChange={(e) => setDefaults((d) => ({ ...d, arrivalNotes: e.target.value.slice(0, 280) }))}
                placeholder={tournament?.arrival_notes ? `Blank keeps the tournament's: ${tournament.arrival_notes}` : "e.g. Doors 1:00 PM. Check in at the scorer's table."}
                rows={2}
              />
            </div>
          </div>
        </div>
      ) : null}

      {read ? (
        <div className="action-bar sticky bottom-0 mt-6">
          <p className="mb-3 font-mono text-[10px] uppercase leading-4 text-ink-60" style={{ letterSpacing: 0.8 }}>
            {ready.length} ready{skipped ? ` · ${skipped} need fixing (they'll be skipped)` : ""} · venue, address and map pin come
            from the tournament
          </p>
          <button
            type="button"
            onClick={() => void post()}
            disabled={!canPost}
            className={`flex w-full items-center justify-center gap-2 py-4 ${
              canPost ? "bg-ink text-paper hover:opacity-80" : "cursor-not-allowed bg-ink-20 text-ink-40"
            }`}
          >
            {posting ? (
              <Spinner />
            ) : (
              <span className="font-mono-bold" style={{ fontSize: 12, letterSpacing: 2.5 }}>
                {!(pay >= 1)
                  ? "SET PAY PER GAME TO CONTINUE"
                  : !duration
                    ? "PICK THE GAME FORMAT TO CONTINUE"
                    : `CREATE ${ready.length} GAME${ready.length !== 1 ? "S" : ""}`}
              </span>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
