"use client";

import Link from "next/link";
import { useState } from "react";
import type { DirectorDashboard as Dashboard, Spend } from "@refee/core/director/dashboard";
import { formatGameDate, formatGameTimeWithZone } from "@refee/core/time";

/** Crew coverage (next 7 days flagged) and spend, this month or per tournament. */
export function DirectorDashboard({ data }: { data: Dashboard }) {
  const [spendView, setSpendView] = useState<"month" | "tournaments">("month");
  const { coverage, spend } = data;

  return (
    <div className="mx-5 mb-4 grid gap-4 sm:mx-0 lg:grid-cols-2">
      <section aria-label="Crew coverage">
        <h2 className="mb-2.5 font-mono-bold text-[10px] uppercase text-ink" style={{ letterSpacing: 2 }}>Crew coverage</h2>
        <div className="border border-ink bg-chalk">
          <div className="flex border-b border-ink-20">
            <Stat label="Upcoming" value={String(coverage.upcoming)} bordered />
            <Stat label="Fully staffed" value={String(coverage.staffed)} bordered />
            <Stat label="Open spots" value={String(coverage.openSlots)} />
          </div>
          {coverage.short.length === 0 ? (
            <p className="px-4 py-3 font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
              {coverage.upcoming ? "Every upcoming game has its full crew" : "No upcoming games"}
            </p>
          ) : (
            coverage.short.slice(0, 5).map((g) => (
              <Link
                key={g.gameId}
                href={`/director/game/${g.gameId}`}
                className="flex items-center justify-between border-b border-ink-10 px-4 py-2.5 hover:opacity-70"
              >
                <span className="min-w-0 flex-1 pr-2">
                  <span className="block truncate font-mono-bold text-[11px] uppercase text-ink" style={{ letterSpacing: 0.5 }}>
                    {g.title}
                  </span>
                  <span className="mt-0.5 block font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
                    {formatGameDate(g.startsAt, g.timeZone, { weekday: "short", month: "short", day: "numeric" })} ·{" "}
                    {formatGameTimeWithZone(g.startsAt, g.timeZone)}
                  </span>
                </span>
                <span
                  className={`font-mono-bold text-[10px] uppercase ${g.urgent ? "text-foul" : "text-ink"}`}
                  style={{ letterSpacing: 1 }}
                  title={g.urgent ? "Within the next 7 days" : undefined}
                >
                  {g.urgent ? "! " : ""}
                  {g.confirmed}/{g.crew} refs
                </span>
              </Link>
            ))
          )}
          {coverage.short.length > 5 ? (
            <p className="px-4 py-2 font-mono text-[8px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
              +{coverage.short.length - 5} more games need referees
            </p>
          ) : null}
        </div>
      </section>

      <section aria-label="Spend">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="font-mono-bold text-[10px] uppercase text-ink" style={{ letterSpacing: 2 }}>Spend</h2>
          <div className="flex border border-ink" role="group" aria-label="Spend period">
            {(["month", "tournaments"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSpendView(v)}
                aria-pressed={spendView === v}
                className={`px-2.5 py-1 font-mono-bold text-[9px] uppercase ${spendView === v ? "bg-ink text-paper" : "bg-chalk text-ink"}`}
                style={{ letterSpacing: 1 }}
              >
                {v === "month" ? "This month" : "By tournament"}
              </button>
            ))}
          </div>
        </div>
        {spendView === "month" ? (
          <SpendCard spend={spend.month} />
        ) : spend.tournaments.length === 0 ? (
          <p className="font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
            No tournament games in the last 4 months
          </p>
        ) : (
          <div className="grid gap-2">
            {spend.tournaments.slice(0, 5).map((t) => (
              <SpendCard key={t.tournamentId} spend={t} title={t.name} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SpendCard({ spend, title }: { spend: Spend; title?: string }) {
  return (
    <div className="border border-ink-20 bg-chalk">
      {title ? (
        <p className="truncate px-4 pt-2.5 font-mono-bold text-[10px] uppercase text-ink" style={{ letterSpacing: 1 }}>
          {title}
        </p>
      ) : null}
      <div className="flex">
        <Stat label="Charged" value={`$${spend.charged.toLocaleString()}`} bordered />
        <Stat label="Still to pay" value={`$${spend.pending.toLocaleString()}`} bordered />
        <Stat label="Refee fee" value={`$${spend.fee.toLocaleString()}`} />
      </div>
      <p className="px-4 pb-2.5 font-mono text-[8px] uppercase text-ink-40" style={{ letterSpacing: 1 }}>
        Total ${spend.total.toLocaleString()} · the fee is included in both amounts
      </p>
    </div>
  );
}

function Stat({ label, value, bordered }: { label: string; value: string; bordered?: boolean }) {
  return (
    <div className={`flex-1 px-3 py-3 ${bordered ? "border-r border-ink-20" : ""}`}>
      <p className="mb-1 font-mono-bold text-[8px] uppercase text-ink-60" style={{ letterSpacing: 1.5 }}>{label}</p>
      <p className="font-display text-ink" style={{ fontSize: 18, letterSpacing: -0.5 }}>{value}</p>
    </div>
  );
}
