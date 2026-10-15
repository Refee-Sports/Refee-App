"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Spinner } from "@/components/ui/AppButton";
import { Icon } from "@/components/ui/Icon";
import { useFocusEffect } from "@/hooks/useFocusEffect";
import { supabase } from "@/lib/supabase";
import {
  earningsCsv,
  earningsCsvFilename,
  earningsYears,
  fetchEarningsLedger,
  ledgerTotals,
  payoutLabel,
  type LedgerRow,
} from "@/lib/referee/queries";
import { downloadTextFile } from "@/lib/files/download";
import { formatGameDate } from "@refee/core/time";

const PAYOUT_COLOR: Record<LedgerRow["payout"], string> = {
  paid: "text-ink",
  processing: "text-signal",
  pending: "text-ink-60",
  failed: "text-foul",
};

/** Every game a referee worked, what it paid, and where that money is. */
export default function EarningsPage() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportYear, setExportYear] = useState<number | "all">("all");

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }
    const result = await fetchEarningsLedger(session.user.id);
    setRows(result.rows);
    setError(result.error?.message ?? null);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const totals = ledgerTotals(rows);
  const years = earningsYears(rows);

  const exportCsv = () => {
    const opts = exportYear === "all" ? {} : { year: exportYear };
    downloadTextFile(earningsCsvFilename(opts), earningsCsv(rows, opts));
  };

  return (
    <div className="app-canvas bg-paper pb-10">
      <div className="flex items-center gap-3 px-5 pb-3 pt-4 sm:px-0 lg:pt-6">
        <Link
          href="/app/profile"
          aria-label="Back to profile"
          className="flex h-9 w-9 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="chevron-left" size={18} />
        </Link>
        <h1 className="font-display uppercase text-ink" style={{ fontSize: 28, letterSpacing: -1 }}>
          Earnings<span className="text-signal">.</span>
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-signal"><Spinner /></div>
      ) : (
        <div className="px-5 sm:px-0 lg:max-w-2xl">
          <div className="flex border border-ink bg-chalk">
            <Total label="Paid out" value={`$${totals.paid.toLocaleString()}`} />
            <div className="w-px bg-ink" />
            <Total label="Still owed" value={`$${totals.owed.toLocaleString()}`} />
            <div className="w-px bg-ink" />
            <Total label="Games" value={String(totals.games)} />
          </div>
          <p className="mt-2 text-[12px] leading-[18px] text-ink-60">
            Paid means sent to your Stripe account. Stripe moves it to your bank on its own schedule, usually within 2 business days.
          </p>
          {error ? (
            <p className="mt-3 border border-foul bg-foul/10 p-3 text-[13px] text-foul" role="alert">{error}</p>
          ) : null}

          {rows.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <label htmlFor="export-year" className="font-mono-bold text-[9px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
                Export
              </label>
              <select
                id="export-year"
                value={exportYear}
                onChange={(e) => setExportYear(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="border border-ink bg-chalk px-2 py-1.5 font-mono text-[11px] text-ink"
              >
                <option value="all">All time</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={exportCsv}
                className="border border-ink bg-ink px-3 py-1.5 font-mono-bold text-[10px] uppercase text-paper hover:opacity-80"
                style={{ letterSpacing: 1.5 }}
              >
                Download CSV
              </button>
            </div>
          ) : null}

          {rows.length === 0 ? (
            <p className="mt-8 text-center text-[14px] text-ink-60">Games you work show up here once they finish.</p>
          ) : (
            <ul className="mt-4 grid gap-1.5">
              {rows.map((row) => (
                <li key={row.assignmentId}>
                  <Link
                    href={`/app/job/${row.jobId}`}
                    className="block border border-ink bg-chalk px-4 py-3 hover:bg-paper"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono-bold text-[11px] uppercase text-ink" style={{ letterSpacing: 0.5 }}>
                          {row.title}
                        </span>
                        <span className="mt-0.5 block font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
                          {formatGameDate(row.startsAt, row.timeZone, { month: "short", day: "numeric", year: "numeric" })} · {row.orgName}
                          {row.kind === "late_cancel" ? " · Late-cancel fee" : ""}
                        </span>
                      </span>
                      <span className="font-display text-ink" style={{ fontSize: 16, letterSpacing: -0.5 }}>
                        ${row.amount.toLocaleString()}
                      </span>
                    </span>
                    <span className={`mt-2 block font-mono-bold text-[9px] uppercase ${PAYOUT_COLOR[row.payout]}`} style={{ letterSpacing: 1 }}>
                      {payoutLabel(row)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 px-3 py-3">
      <p className="mb-1 font-mono-bold text-[8px] uppercase text-ink-60" style={{ letterSpacing: 2 }}>{label}</p>
      <p className="font-display text-ink" style={{ fontSize: 18, letterSpacing: -0.5 }}>{value}</p>
    </div>
  );
}
