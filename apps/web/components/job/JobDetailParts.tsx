"use client";

import { DataCard } from "./DataCard";
import { openVenueDirections } from "@/lib/jobs/open-directions";
import type { AssignmentStatus, CrewProfile } from "@/lib/jobs/queries";
import type { JobDetail } from "@/lib/jobs/types";

/** All of the app's components/job/* detail sections, ported to the web. */

export function JobDetailTelemetry({ job }: { job: JobDetail }) {
  const isLive = job.telemetryRight === "LIVE";
  return (
    <div className="flex items-center justify-between px-5 pb-3">
      {isLive ? (
        <span className="mr-2 flex shrink items-center gap-1.5 bg-hi-vis px-1.5 py-1">
          <span className="h-1 w-1 rounded-full bg-ink" />
          <span
            className="font-mono-bold text-[9px] uppercase text-ink"
            style={{ letterSpacing: 1.2 }}
          >
            {job.telemetryLeft}
          </span>
        </span>
      ) : (
        <span
          className="flex-1 pr-2 font-mono-bold text-[9px] uppercase text-ink-60"
          style={{ letterSpacing: 1.2 }}
        >
          {job.telemetryLeft}
        </span>
      )}
      <span
        className="font-mono-bold text-[9px] uppercase text-ink"
        style={{ letterSpacing: 1.6 }}
      >
        {job.telemetryRight}
      </span>
    </div>
  );
}

export function JobDetailHero({ job }: { job: JobDetail }) {
  const titleLines = job.title.includes("\n") ? job.title.split("\n") : [job.title];
  const cells: [string, string, boolean][] = [
    ["PER GAME", `$${job.payPerGame}`, false],
    ["GAMES", String(job.numGames), false],
    ["PAYOUT", `${job.payoutHours}H`, true],
  ];

  return (
    <div className="mb-3 overflow-hidden border-[1.5px] border-ink bg-chalk">
      <div className="flex items-center justify-between border-b border-ink bg-ink px-3.5 py-2.5">
        <span
          className="flex-1 pr-2 font-mono-bold text-[9px] uppercase text-paper"
          style={{ letterSpacing: 1.4 }}
        >
          {job.heroTag}
        </span>
        <span
          className="font-mono text-[9px] uppercase text-paper/60"
          style={{ letterSpacing: 1.2 }}
        >
          {job.jobCode}
        </span>
      </div>

      <div className="flex items-end justify-between gap-3 px-4 py-4">
        <div className="min-w-0 flex-1">
          {titleLines.map((line, i) => (
            <span
              key={i}
              className="block font-display uppercase text-ink"
              style={{ fontSize: 30, lineHeight: "30px", letterSpacing: -0.9 }}
            >
              {line}
            </span>
          ))}
          <span
            className="mt-2 block font-mono-bold text-[10px] uppercase text-ink-60"
            style={{ letterSpacing: 1.4 }}
          >
            {job.org}
            {job.orgVerified ? <span className="text-court"> ✓</span> : null}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="flex items-start">
            <span
              className="font-display text-ink-60"
              style={{ fontSize: 22, lineHeight: "28px", marginTop: 4 }}
            >
              $
            </span>
            <span
              className="font-display text-signal"
              style={{ fontSize: 56, lineHeight: "48px", letterSpacing: -2.8 }}
            >
              {job.payTotal}
            </span>
          </span>
          <span
            className="mt-1 font-mono-bold text-[9px] uppercase text-ink-60"
            style={{ letterSpacing: 1.8 }}
          >
            Total est.
          </span>
        </div>
      </div>

      <div className="flex border-t border-ink bg-paper">
        {cells.map(([label, value, court], i) => (
          <div key={label} className={`flex-1 border-ink px-3 py-2.5 ${i < 2 ? "border-r" : ""}`}>
            <span
              className="mb-0.5 block font-mono-bold text-[8px] uppercase text-ink-60"
              style={{ letterSpacing: 1.8 }}
            >
              {label}
            </span>
            <span
              className={`block font-display uppercase ${court ? "text-court" : "text-ink"}`}
              style={{ fontSize: 16, letterSpacing: -0.3 }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function JobDetailScheduleCard({ job }: { job: JobDetail }) {
  return (
    <DataCard tab="SCHEDULE">
      <div className="flex px-3.5 pb-4 pt-5">
        <div className="flex-1 border-r border-ink/20 pr-3">
          <SchedColumn
            label="When"
            primary={job.whenPrimary}
            secondary={job.whenSecondary}
            tertiary={job.whenTertiary}
          />
        </div>
        <div className="flex-1 pl-3">
          <SchedColumn
            label="Where"
            primary={job.wherePrimary}
            secondary={job.whereSecondary}
            tertiary={job.whereTertiary}
          />
        </div>
      </div>
    </DataCard>
  );
}

function SchedColumn({
  label,
  primary,
  secondary,
  tertiary,
}: {
  label: string;
  primary: string;
  secondary: string;
  tertiary: string;
}) {
  return (
    <>
      <span
        className="mb-1 block font-mono-bold text-[8px] uppercase text-ink-60"
        style={{ letterSpacing: 2 }}
      >
        {label}
      </span>
      <span
        className="block font-display uppercase text-ink"
        style={{ fontSize: 20, letterSpacing: -0.4, lineHeight: "22px" }}
      >
        {primary}
      </span>
      <span
        className="mt-1 block font-mono-bold text-[10px] uppercase text-ink-80"
        style={{ letterSpacing: 1.2 }}
      >
        {secondary}
      </span>
      <span
        className="mt-1 block font-mono text-[9px] uppercase text-ink-60"
        style={{ letterSpacing: 1.2 }}
      >
        {tertiary}
      </span>
    </>
  );
}

/** Stylised court-grid placeholder, same as the app's map card. */
function MapGrid() {
  const lines = 8;
  return (
    <div className="absolute inset-0 overflow-hidden">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={`h-${i}`}
          className="absolute left-0 right-0 border-t border-ink/10"
          style={{ top: `${(i / lines) * 100}%` }}
        />
      ))}
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={`v-${i}`}
          className="absolute bottom-0 top-0 border-l border-ink/10"
          style={{ left: `${(i / lines) * 100}%` }}
        />
      ))}
      <div
        className="absolute rounded-full border border-signal/30"
        style={{ width: 80, height: 80, top: "50%", left: "50%", marginLeft: -40, marginTop: -40 }}
      />
      <div
        className="absolute flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-signal"
        style={{ top: "50%", left: "50%", marginLeft: -12, marginTop: -12 }}
      >
        <span className="h-2 w-2 rounded-full bg-ink" />
      </div>
    </div>
  );
}

export function JobDetailMapCard({ job }: { job: JobDetail }) {
  return (
    <DataCard tab="LOCATION" className="overflow-hidden">
      <div className="relative mt-2 h-[140px] border-b border-ink bg-paper-2">
        <MapGrid />
      </div>
      <div className="flex items-center justify-between px-3.5 py-3">
        <div className="min-w-0 flex-1 pr-2">
          <span
            className="block font-mono-bold text-[10px] uppercase text-ink"
            style={{ letterSpacing: 1.2 }}
          >
            {job.venueName}
          </span>
          {job.venueAddress ? (
            <span
              className="mt-0.5 block font-mono text-[9px] uppercase text-ink-60"
              style={{ letterSpacing: 1 }}
            >
              {job.venueAddress}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => openVenueDirections(job.venueName, job.venueAddress)}
          className="shrink-0 font-mono-bold text-[9px] uppercase text-signal hover:underline"
          style={{ letterSpacing: 1.6 }}
        >
          Directions →
        </button>
      </div>
    </DataCard>
  );
}

function CrewRow({
  initials,
  name,
  role,
  status,
  locked,
  open,
}: {
  initials: string;
  name: string;
  role: string;
  status: string;
  locked?: boolean;
  open?: boolean;
}) {
  const isEmpty = initials === "?";
  return (
    <div className="flex items-center border-b border-ink/10 py-2.5 last:border-b-0">
      <span
        className={`mr-3 flex h-9 w-9 shrink-0 items-center justify-center border border-ink ${
          isEmpty ? "border-dashed border-ink/30 bg-transparent" : "bg-ink"
        }`}
      >
        <span
          className={`font-display text-sm uppercase ${isEmpty ? "text-ink-40" : "text-paper"}`}
        >
          {initials}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[13px] uppercase ${
            name.toLowerCase().includes("open")
              ? "font-body italic text-ink-40"
              : "font-body-bold text-ink"
          }`}
          style={{ letterSpacing: -0.1 }}
        >
          {name}
        </span>
        <span
          className="mt-0.5 block font-mono text-[9px] uppercase text-ink-60"
          style={{ letterSpacing: 1.4 }}
        >
          {role}
        </span>
      </span>
      <span
        className={`shrink-0 font-mono-bold text-[9px] uppercase ${
          open ? "bg-hi-vis px-1.5 py-0.5 text-ink" : locked ? "text-court" : "text-ink-60"
        }`}
        style={{ letterSpacing: 1.4 }}
      >
        {status}
      </span>
    </div>
  );
}

export function JobDetailCrew({
  job,
  crewMembers,
}: {
  job: JobDetail;
  assignmentStatus: AssignmentStatus;
  crewMembers: CrewProfile[];
}) {
  // Real crew only. RLS hides other refs until you're accepted onto the game,
  // so before accepting this shows open slots.
  const openSlots = Math.max(0, job.crewSize - crewMembers.length);
  return (
    <DataCard tab={`CREW · ${job.crewSize}-PERSON`}>
      <div className="px-3.5 pb-3 pt-5">
        {crewMembers.map((member) => (
          <CrewRow
            key={member.refId}
            initials={member.initials}
            name={member.isMe ? `${member.displayName} (YOU)` : member.displayName}
            role={member.role}
            status={member.status}
            locked={member.status.includes("LOCKED")}
          />
        ))}
        {Array.from({ length: openSlots }).map((_, i) => (
          <CrewRow key={`open-${i}`} initials="?" name="Open slot" role="OFFICIAL" status="OPEN" open />
        ))}
      </div>
    </DataCard>
  );
}

export function JobDetailGames({ job }: { job: JobDetail }) {
  return (
    <DataCard tab={`GAMES · ${job.numGames} SCHEDULED`}>
      <div className="px-3.5 pb-3 pt-5">
        {Array.from({ length: job.numGames }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-ink/10 py-2.5 last:border-b-0"
          >
            <span
              className="w-6 shrink-0 font-mono text-[9px] uppercase text-ink-60"
              style={{ letterSpacing: 1.4 }}
            >
              G{i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block font-display uppercase text-ink"
                style={{ fontSize: 16, letterSpacing: -0.3, lineHeight: "18px" }}
              >
                {i === 0 ? job.whenSecondary.replace(" CT", "") : `GAME ${i + 1}`}
              </span>
              <span
                className="mt-0.5 block font-mono text-[10px] uppercase text-ink-80"
                style={{ letterSpacing: 1 }}
              >
                {job.levelLabel} ·{" "}
                {i === 0 ? "POOL A" : i === 1 ? "POOL B" : i === 2 ? "POOL A" : "BRACKET"}
              </span>
            </span>
            <span
              className="shrink-0 font-display uppercase text-court"
              style={{ fontSize: 16, letterSpacing: -0.3 }}
            >
              ${job.payPerGame}
            </span>
          </div>
        ))}
      </div>
    </DataCard>
  );
}

export function JobDetailSpecs({ job }: { job: JobDetail }) {
  const rows: [string, string][] = [
    ["SPORT", job.sportLabel],
    ["LEVEL", job.levelLabel],
    ["RULESET", job.ruleset ?? "—"],
    ["GAME LENGTH", job.gameLength],
    ["UNIFORM", job.uniform ?? "—"],
    ["PARKING", job.parking ?? "—"],
  ];
  return (
    <DataCard tab="SPECS">
      <div className="px-3.5 pb-3 pt-5">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between border-b border-ink/10 py-2.5 last:border-b-0"
          >
            <span
              className="font-mono-bold text-[10px] uppercase text-ink-60"
              style={{ letterSpacing: 1.6 }}
            >
              {label}
            </span>
            <span
              className="flex-1 pl-4 text-right font-mono-bold text-[11px] uppercase text-ink"
              style={{ letterSpacing: 1 }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </DataCard>
  );
}

export function JobDetailHirerNote({ note }: { note: string }) {
  return (
    <div className="mb-4 border-l-[3px] border-signal bg-signal/10 px-3.5 py-4">
      <p
        className="mb-2 font-mono-bold text-[9px] uppercase text-signal"
        style={{ letterSpacing: 1.8 }}
      >
        ▸ Note from organizer
      </p>
      <p className="text-[13px] text-ink" style={{ lineHeight: "19px" }}>
        {note}
      </p>
    </div>
  );
}
