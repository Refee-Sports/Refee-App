"use client";

import Link from "next/link";
import { useState } from "react";
import { countdownLabel, type RefereeDashboardData } from "@refee/core/referee/dashboard";
import { showRate } from "@refee/core/referee/reliability";
import { LEVELS } from "@refee/core/basketball/options";
import { formatGameDate, formatGameTimeWithZone } from "@refee/core/time";

const LEVEL_LABEL = new Map(LEVELS.map((l) => [l.id, l.label]));

/** The referee's next confirmed game: countdown, venue, crew, arrival notes. */
export function NextGamePanel({ data }: { data: RefereeDashboardData }) {
  const next = data.nextGame;
  if (!next) return null;
  return (
    <>
      <SectionHeader>{`Next game · ${countdownLabel(next.startsAt)}`}</SectionHeader>
      <Link href={`/app/job/${next.jobId}`} className="mx-5 block border border-ink bg-chalk px-4 py-3.5 hover:opacity-80 sm:mx-0">
        {next.needsReconfirm ? (
          <span className="mb-1.5 block font-mono-bold text-[9px] uppercase text-foul" style={{ letterSpacing: 1.5 }}>
            ! The organizer changed this game · re-confirm
          </span>
        ) : null}
        <span className="block font-display text-ink" style={{ fontSize: 20, lineHeight: "22px", letterSpacing: -0.5 }}>
          {next.title.toUpperCase()}
        </span>
        <span className="mt-1.5 block font-mono-bold text-[10px] uppercase text-ink" style={{ letterSpacing: 1 }}>
          {formatGameDate(next.startsAt, next.timeZone, { weekday: "short", month: "short", day: "numeric" })} ·{" "}
          {formatGameTimeWithZone(next.startsAt, next.timeZone)}
        </span>
        <span className="mt-1 block text-[13px] leading-[18px] text-ink-80">
          {[next.venueName, next.venueAddress, next.venueCity && `${next.venueCity}, ${next.venueState}`].filter(Boolean).join(" · ")}
        </span>
        <span className="mt-1.5 block text-[12px] leading-[17px] text-ink-60">
          {data.crew.length ? `Crew: ${data.crew.join(", ")}` : "No other referees confirmed yet"}
        </span>
        {next.arrivalNotes ? (
          <span className="mt-1 block text-[12px] leading-[17px] text-ink-60">Arrival: {next.arrivalNotes}</span>
        ) : null}
      </Link>
    </>
  );
}

/** Open games, money and games by level, and their record. */
export function StatsPanels({ data }: { data: RefereeDashboardData }) {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const rate = showRate(data.reliability);
  const money = data.money[period];
  const levels = data.gamesByLevel[period];
  const trend =
    data.rating && data.rating.previous != null
      ? data.rating.recent > data.rating.previous
        ? "▲"
        : data.rating.recent < data.rating.previous
          ? "▼"
          : "="
      : "";

  return (
    <>
      <Link
        href="/app/jobs"
        className="mx-5 mt-4 flex items-center justify-between border border-ink bg-hi-vis px-4 py-3 hover:opacity-80 sm:mx-0"
      >
        <span className="min-w-0 flex-1 pr-2">
          <span className="block font-mono-bold text-[11px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
            {data.openGames} open game{data.openGames !== 1 ? "s" : ""} match you
          </span>
          <span className="mt-0.5 block font-mono text-[9px] uppercase text-ink-80" style={{ letterSpacing: 1 }}>
            {data.newOpenGames > 0 ? `${data.newOpenGames} new since yesterday` : "Your radius, days and rate"}
          </span>
        </span>
        <span className="font-mono-bold text-sm text-ink">→</span>
      </Link>

      <div className="mx-5 mb-2.5 mt-6 flex items-center justify-between sm:mx-0">
        <h2 className="font-mono-bold text-[10px] uppercase text-ink" style={{ letterSpacing: 2 }}>Earnings</h2>
        <div className="flex border border-ink" role="group" aria-label="Period">
          {(["month", "year"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className={`px-2.5 py-1 font-mono-bold text-[9px] uppercase ${period === p ? "bg-ink text-paper" : "bg-chalk text-ink"}`}
              style={{ letterSpacing: 1 }}
            >
              {p === "month" ? "This month" : "This year"}
            </button>
          ))}
        </div>
      </div>
      <Link href="/app/earnings" className="mx-5 block border border-ink-20 bg-chalk hover:opacity-90 sm:mx-0">
        <span className="flex">
          <Stat label="Paid" value={`$${money.paid.toLocaleString()}`} bordered />
          <Stat label="Owed" value={`$${money.owed.toLocaleString()}`} />
        </span>
        <span className="block border-t border-ink-20 px-4 py-2.5">
          {levels.length === 0 ? (
            <span className="font-mono text-[9px] uppercase text-ink-40" style={{ letterSpacing: 1.5 }}>
              No games worked {period === "month" ? "this month" : "this year"} yet
            </span>
          ) : (
            levels.map((l) => (
              <span key={l.level} className="flex justify-between py-0.5 font-mono text-[9px] uppercase" style={{ letterSpacing: 1.5 }}>
                <span className="text-ink-60">{LEVEL_LABEL.get(l.level) ?? l.level}</span>
                <span className="font-mono-bold text-ink">
                  {l.games} game{l.games !== 1 ? "s" : ""}
                </span>
              </span>
            ))
          )}
        </span>
      </Link>

      <SectionHeader>Your record</SectionHeader>
      <div className="mx-5 flex border border-ink-20 bg-chalk sm:mx-0">
        <Stat
          label="Rating"
          value={data.rating ? `★ ${data.rating.recent.toFixed(1)}${trend ? ` ${trend}` : ""}` : "—"}
          note={data.rating ? `Last ${data.rating.recentCount}` : "No ratings yet"}
          bordered
        />
        <Stat label="Show rate" value={rate.rate != null ? `${rate.rate}%` : "New"} note="Last 12 months" bordered />
        <Stat
          label="Approved"
          value={data.approval.rate != null ? `${data.approval.rate}%` : "—"}
          note={data.approval.rate != null ? `${data.approval.approved} of ${data.approval.decided}` : "Too few yet"}
        />
      </div>
    </>
  );
}

function SectionHeader({ children }: { children: string }) {
  return (
    <h2 className="mx-5 mb-2.5 mt-6 font-mono-bold text-[10px] uppercase text-ink sm:mx-0" style={{ letterSpacing: 2 }}>
      {children}
    </h2>
  );
}

function Stat({ label, value, note, bordered }: { label: string; value: string; note?: string; bordered?: boolean }) {
  return (
    <span className={`block flex-1 px-4 py-3.5 ${bordered ? "border-r border-ink-20" : ""}`}>
      <span className="mb-1 block font-mono-bold text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1.5 }}>
        {label}
      </span>
      <span className="block font-display text-ink" style={{ fontSize: 22, letterSpacing: -0.5 }}>
        {value}
      </span>
      {note ? (
        <span className="mt-0.5 block font-mono text-[8px] uppercase text-ink-40" style={{ letterSpacing: 1 }}>
          {note}
        </span>
      ) : null}
    </span>
  );
}
