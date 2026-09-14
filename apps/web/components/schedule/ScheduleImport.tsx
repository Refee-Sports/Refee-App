"use client";

// Import a tournament's games from a photo, PDF or CSV. AI reads the file into
// an editable table; nothing is posted until the director (or the tournament's
// accepted assignor) reviews it and presses Create.
import "@/lib/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/AppButton";
import { AffixField, BigChoice, Label, SectionLabel, SelectField, TextArea } from "@/components/ui/Field";
import { fetchTournamentById, type TournamentRow } from "@/lib/director/queries";
import { HALF_MINUTES, LEVELS, QUARTER_MINUTES, TEAM_LEVELS } from "@/lib/basketball/options";
import {
  extractSchedule,
  importScheduleGames,
  readUpload,
  type ExtractedSchedule,
} from "@refee/core/schedule/ai-import";
import { buildScheduleTemplate, parseTemplateCsv, TEMPLATE_FILE_NAME } from "@refee/core/schedule/template";
import { formatDateOnly, zoneName } from "@refee/core/time";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf,.csv,text/csv,.txt";
const LIMITS = { image: 5 * 1024 * 1024, pdf: 10 * 1024 * 1024, text: 1024 * 1024 };

type Row = {
  key: string;
  include: boolean;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  court: string;
  level: string;
  teamLevel: string;
  ageGroup: string;
  notes: string | null;
  confidence: "high" | "medium" | "low";
};

let seq = 0;
const nextKey = () => `row-${++seq}`;

function emptyRow(date: string): Row {
  return {
    key: nextKey(),
    include: true,
    homeTeam: "",
    awayTeam: "",
    date,
    time: "",
    court: "",
    level: "",
    teamLevel: "",
    ageGroup: "",
    notes: null,
    confidence: "high",
  };
}

function rowErrors(row: Row, t: TournamentRow | null): string[] {
  const errors: string[] = [];
  const home = row.homeTeam.trim();
  const away = row.awayTeam.trim();
  if (!home || !away) errors.push("Both teams needed");
  else if (home.toLowerCase() === away.toLowerCase()) errors.push("Teams must differ");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) errors.push("Date needed");
  else if (t && (row.date < t.starts_on.slice(0, 10) || row.date > t.ends_on.slice(0, 10))) {
    errors.push("Outside the tournament dates");
  }
  if (!/^\d{2}:\d{2}$/.test(row.time)) errors.push("Tip-off time needed");
  if (!row.level) errors.push("Level needed");
  if (row.level === "youth_rec" && !row.ageGroup.trim()) errors.push("Age group needed");
  return errors;
}

const cell =
  "w-full min-w-0 border border-ink-20 bg-paper px-2 py-1.5 font-mono text-[11px] text-ink focus:border-ink focus:outline-none";

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
  const [rows, setRows] = useState<Row[]>([]);
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
      // Start from the tournament's own format, as the single-game form does.
      if (t?.game_format === "quarters" || t?.game_format === "halves") {
        const format = t.game_format;
        setDefaults((d) => ({
          ...d,
          gameFormat: d.gameFormat || format,
          periodMinutes: d.periodMinutes || (t.period_minutes ? String(t.period_minutes) : ""),
        }));
      }
    });
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
    setRows(
      s.games.map((g) => ({
        key: nextKey(),
        include: true,
        homeTeam: g.home_team,
        awayTeam: g.away_team,
        date: g.date || singleDay,
        time: g.time,
        court: g.court ?? "",
        level: g.level ?? "",
        teamLevel: g.team_level ?? "",
        ageGroup: g.age_group ?? "",
        notes: g.notes,
        confidence: g.confidence,
      }))
    );
    setProblems(s.problems);
    const levels = [...new Set(s.games.map((g) => g.level).filter(Boolean))] as string[];
    setDefaults((d) => ({
      ...d,
      level: levels.length === 1 ? levels[0] : d.level,
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

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const effective = (r: Row): Row => ({ ...r, level: r.level || defaults.level });
  const checked = rows.map((row) => ({ row, errors: rowErrors(effective(row), tournament) }));
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
      ready.map(({ row }) => {
        const r = effective(row);
        return {
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
        };
      })
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
          Upload a flyer, a screenshot, a PDF or a spreadsheet. AI reads the games into a table you check before
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
          {rows.length === 0 ? (
            <p className="border border-dashed border-ink-20 px-4 py-6 text-center font-mono text-[10px] uppercase text-ink-60">
              No games found. Add rows by hand, or try a clearer photo.
            </p>
          ) : (
            <div className="overflow-x-auto border border-ink bg-chalk">
              <table className="w-full min-w-[860px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-ink">
                    {["", "Home", "Away", "Date", "Tip-off", "Court", "Level", "Team level / age", ""].map((h, i) => (
                      <th
                        key={i}
                        className="px-2 py-2 font-mono-bold text-[8px] uppercase text-ink-60"
                        style={{ letterSpacing: 1.4 }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {checked.map(({ row, errors }) => {
                    const lvl = row.level || defaults.level;
                    return (
                      <tr key={row.key} className={`border-b border-ink-20 align-top ${row.include ? "" : "opacity-40"}`}>
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={row.include}
                            onChange={(e) => update(row.key, { include: e.target.checked })}
                            aria-label="Include this game"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <input className={cell} value={row.homeTeam} onChange={(e) => update(row.key, { homeTeam: e.target.value })} />
                        </td>
                        <td className="px-1 py-2">
                          <input className={cell} value={row.awayTeam} onChange={(e) => update(row.key, { awayTeam: e.target.value })} />
                        </td>
                        <td className="px-1 py-2">
                          <input
                            type="date"
                            className={cell}
                            value={row.date}
                            min={tournament?.starts_on.slice(0, 10)}
                            max={tournament?.ends_on.slice(0, 10)}
                            onChange={(e) => update(row.key, { date: e.target.value })}
                          />
                        </td>
                        <td className="px-1 py-2">
                          <input type="time" step={300} className={cell} value={row.time} onChange={(e) => update(row.key, { time: e.target.value })} />
                        </td>
                        <td className="px-1 py-2">
                          <input
                            className={cell}
                            value={row.court}
                            list={`courts-${tournamentId}`}
                            placeholder="—"
                            onChange={(e) => update(row.key, { court: e.target.value })}
                          />
                        </td>
                        <td className="px-1 py-2">
                          <select className={cell} value={row.level} onChange={(e) => update(row.key, { level: e.target.value })}>
                            <option value="">Default ({LEVELS.find((l) => l.id === defaults.level)?.label ?? "—"})</option>
                            {levelOptions.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1 py-2">
                          {lvl === "high_school" ? (
                            <select className={cell} value={row.teamLevel} onChange={(e) => update(row.key, { teamLevel: e.target.value })}>
                              <option value="">—</option>
                              {TEAM_LEVELS.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          ) : lvl === "youth_rec" ? (
                            <input className={cell} value={row.ageGroup} placeholder="U14" onChange={(e) => update(row.key, { ageGroup: e.target.value })} />
                          ) : (
                            <span className="font-mono text-[10px] text-ink-40">—</span>
                          )}
                        </td>
                        <td className="w-40 px-2 py-2">
                          {row.confidence !== "high" ? (
                            <span
                              className="mb-1 inline-block bg-whistle px-1.5 py-0.5 font-mono-bold text-[8px] uppercase text-ink"
                              style={{ letterSpacing: 1.2 }}
                            >
                              {row.confidence} confidence
                            </span>
                          ) : null}
                          {row.include && errors.length > 0 ? (
                            <span className="block font-mono text-[9px] uppercase text-foul" style={{ letterSpacing: 0.8 }}>
                              {errors.join(" · ")}
                            </span>
                          ) : row.include ? (
                            <span className="block font-mono-bold text-[9px] uppercase text-court">Ready</span>
                          ) : null}
                          {row.notes ? <span className="mt-1 block text-[11px] leading-4 text-ink-60">{row.notes}</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <datalist id={`courts-${tournamentId}`}>
                {(tournament?.courts ?? []).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          )}

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
