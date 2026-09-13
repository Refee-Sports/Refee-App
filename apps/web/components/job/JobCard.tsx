"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { SEED_JOB_IDS } from "@/lib/jobs/mock-data";
import type { JobListRow } from "@/lib/jobs/types";

function CardTopStripe({ variant }: { variant?: "hot" | "featured" }) {
  if (!variant) return null;
  const height = variant === "hot" ? 4 : 3;
  const [a, b] =
    variant === "hot" ? ["#08111C", "#C9F031"] : ["#1F4FCC", "#E5E1D6"];
  return (
    <div
      className="w-full"
      style={{
        height,
        backgroundImage: `repeating-linear-gradient(90deg, ${a} 0, ${a} 7px, ${b} 7px, ${b} 14px)`,
      }}
    />
  );
}

/** A job row in the feed — port of the card in the app's jobs tab. */
export function JobCard({ job }: { job: JobListRow }) {
  const cells: [string, string][] = [
    ["DATE", job.date],
    ["TIME", job.time],
    ["CREW", job.crew],
    ["DIST", job.dist],
  ];

  return (
    <Link
      href={`/app/job/${job.id}`}
      className="block overflow-hidden border border-ink bg-chalk hover:opacity-90"
    >
      <CardTopStripe variant={job.variant === "default" ? undefined : job.variant} />

      <div className="flex items-center justify-between px-3.5 pt-3">
        {job.variant === "hot" && job.tagLeft ? (
          <span className="flex items-center gap-1 bg-hi-vis px-1.5 py-0.5">
            <span className="h-1 w-1 bg-ink" />
            <span
              className="font-mono-bold text-[9px] uppercase text-ink"
              style={{ letterSpacing: 1.2 }}
            >
              {job.tagLeft}
            </span>
          </span>
        ) : (
          <span
            className={`font-mono-bold text-[9px] uppercase ${
              job.variant === "featured" ? "text-signal" : "text-ink-60"
            }`}
            style={{ letterSpacing: 1.4 }}
          >
            {job.tagLeft}
          </span>
        )}
        <span
          className="font-mono text-[9px] uppercase text-ink-40"
          style={{ letterSpacing: 1.2 }}
        >
          {job.jobId}
        </span>
      </div>

      <div className="flex items-end justify-between gap-3 px-3.5 pb-3 pt-2">
        <div className="min-w-0 flex-1">
          <span
            className="block font-display uppercase text-ink"
            style={{ fontSize: 18, lineHeight: "20px", letterSpacing: -0.5 }}
          >
            {job.title}
          </span>
          <span
            className={`mt-1 block font-mono-bold text-[9px] uppercase ${
              job.orgVerified ? "text-signal" : "text-ink-60"
            }`}
            style={{ letterSpacing: 1.2 }}
          >
            {job.org}
            {job.orgVerified ? " ✓" : ""}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="flex items-baseline">
            <span className="font-display text-lg text-signal">$</span>
            <span
              className="font-display text-ink"
              style={{ fontSize: 28, lineHeight: "28px", letterSpacing: -1 }}
            >
              {job.pay}
            </span>
          </span>
          <span
            className="mt-0.5 font-mono-bold text-[8px] uppercase text-ink-60"
            style={{ letterSpacing: 1.5 }}
          >
            {job.payUnit}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap border-t border-ink">
        {cells.map(([label, value], idx) => {
          const splitTime = label === "TIME" && job.id === SEED_JOB_IDS.hot;
          return (
            <div
              key={label}
              className={`w-1/2 border-ink px-3.5 py-2 ${idx < 2 ? "border-b" : ""} ${
                idx % 2 === 0 ? "border-r" : ""
              }`}
            >
              <span
                className="mb-0.5 block font-mono-bold text-[8px] uppercase text-ink-60"
                style={{ letterSpacing: 1.6 }}
              >
                {label}
              </span>
              <span
                className="block font-mono-bold text-[11px] uppercase text-ink"
                style={{ letterSpacing: 0.8 }}
              >
                {splitTime ? (
                  <>
                    {value.split("·")[0]?.trim()} ·{" "}
                    <span className="text-signal">{value.split("·")[1]?.trim() ?? ""}</span>
                  </>
                ) : (
                  value
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-ink bg-paper px-3.5 py-2.5">
        <span className="flex flex-wrap gap-1.5">
          {job.tags.map((t) => (
            <Badge key={t} label={t} variant="neutral" />
          ))}
        </span>
        <span
          className={`shrink-0 font-mono-bold text-[9px] uppercase ${
            job.footerCtaTone === "signal"
              ? "text-signal"
              : job.footerCtaTone === "muted"
                ? "text-ink-60"
                : "text-ink"
          }`}
          style={{ letterSpacing: 1.4 }}
        >
          {job.footerCta}
        </span>
      </div>
    </Link>
  );
}
