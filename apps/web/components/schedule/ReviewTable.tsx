"use client";

// The editable table of games read from an uploaded schedule. Shared by New
// tournament and a tournament's import page.
import { LEVELS, TEAM_LEVELS } from "@/lib/basketball/options";
import type { ReviewRowState } from "@/lib/schedule/rows";
import { checkRows } from "@/lib/schedule/review";

const cell =
  "w-full min-w-0 border border-ink-20 bg-paper px-2 py-1.5 font-mono text-[11px] text-ink focus:border-ink focus:outline-none";

const levelOptions = LEVELS.map((l) => ({ id: l.id, label: l.label }));

export function ReviewTable({
  rows,
  onChange,
  defaultLevel,
  range,
  courts,
  listId,
}: {
  rows: ReviewRowState[];
  onChange: (rows: ReviewRowState[]) => void;
  /** Level for rows the file didn't give one. */
  defaultLevel: string;
  /** Tournament dates; rows outside them are flagged. */
  range: { starts_on: string; ends_on: string } | null;
  courts: string[];
  listId: string;
}) {
  const update = (key: string, patch: Partial<ReviewRowState>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  if (rows.length === 0) {
    return (
      <p className="border border-dashed border-ink-20 px-4 py-6 text-center font-mono text-[10px] uppercase text-ink-60">
        No games found. Add rows by hand, or try a clearer photo.
      </p>
    );
  }

  const validRange = range && /^\d{4}-\d{2}-\d{2}/.test(range.starts_on) && /^\d{4}-\d{2}-\d{2}/.test(range.ends_on) ? range : null;

  return (
    <div className="overflow-x-auto border border-ink bg-chalk">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead>
          <tr className="border-b border-ink">
            {["", "Home", "Away", "Date", "Tip-off", "Court", "Level", "Team level / age", ""].map((h, i) => (
              <th key={i} className="px-2 py-2 font-mono-bold text-[8px] uppercase text-ink-60" style={{ letterSpacing: 1.4 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {checkRows(rows, defaultLevel, validRange).map(({ row, effective, errors }) => (
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
                <input
                  className={cell}
                  aria-label="Home team"
                  value={row.homeTeam}
                  onChange={(e) => update(row.key, { homeTeam: e.target.value })}
                />
              </td>
              <td className="px-1 py-2">
                <input
                  className={cell}
                  aria-label="Away team"
                  value={row.awayTeam}
                  onChange={(e) => update(row.key, { awayTeam: e.target.value })}
                />
              </td>
              <td className="px-1 py-2">
                <input
                  type="date"
                  className={cell}
                  aria-label="Date"
                  value={row.date}
                  min={validRange?.starts_on.slice(0, 10)}
                  max={validRange?.ends_on.slice(0, 10)}
                  onChange={(e) => update(row.key, { date: e.target.value })}
                />
              </td>
              <td className="px-1 py-2">
                <input
                  type="time"
                  step={300}
                  className={cell}
                  aria-label="Tip-off"
                  value={row.time}
                  onChange={(e) => update(row.key, { time: e.target.value })}
                />
              </td>
              <td className="px-1 py-2">
                <input
                  className={cell}
                  aria-label="Court"
                  value={row.court}
                  list={listId}
                  placeholder="—"
                  onChange={(e) => update(row.key, { court: e.target.value })}
                />
              </td>
              <td className="px-1 py-2">
                <select
                  className={cell}
                  aria-label="Level"
                  value={row.level}
                  onChange={(e) => update(row.key, { level: e.target.value })}
                >
                  <option value="">Default ({LEVELS.find((l) => l.id === defaultLevel)?.label ?? "—"})</option>
                  {levelOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-1 py-2">
                {effective.level === "high_school" ? (
                  <select
                    className={cell}
                    aria-label="Team level"
                    value={row.teamLevel}
                    onChange={(e) => update(row.key, { teamLevel: e.target.value })}
                  >
                    <option value="">—</option>
                    {TEAM_LEVELS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                ) : effective.level === "youth_rec" ? (
                  <input
                    className={cell}
                    aria-label="Age group"
                    value={row.ageGroup}
                    placeholder="U14"
                    onChange={(e) => update(row.key, { ageGroup: e.target.value })}
                  />
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
          ))}
        </tbody>
      </table>
      <datalist id={listId}>
        {courts.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  );
}
