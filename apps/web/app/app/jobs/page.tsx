"use client";

import { useMemo, useState } from "react";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/AppButton";
import { JobCard } from "@/components/job/JobCard";
import { useJobsFeed } from "@/hooks/useJobsFeed";
import {
  applyJobFeedFilters,
  JOB_FEED_FILTERS,
  type JobFeedFilterId,
} from "@/lib/jobs/filters";
import type { FeedTab } from "@/lib/jobs/types";

/** Port of refee-mobile/refee/app/(app)/(tabs)/jobs.tsx. */
export default function JobsFeedPage() {
  const {
    rowsForTab,
    counts,
    loading,
    error,
    usedMockForAvailable,
    locationMode,
    locating,
    toggleLocationMode,
  } = useJobsFeed();

  const [tab, setTab] = useState<FeedTab>("available");
  const [activeFilters, setActiveFilters] = useState<Set<JobFeedFilterId>>(new Set());
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const tabRows = useMemo(() => rowsForTab(tab), [rowsForTab, tab]);
  const visible = useMemo(
    () => applyJobFeedFilters(tabRows, activeFilters),
    [tabRows, activeFilters]
  );
  const filtersActive = activeFilters.size > 0;

  const toggleFilter = (id: JobFeedFilterId) =>
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleLocationToggle = async () => {
    setLocationNote(null);
    const ok = await toggleLocationMode();
    if (!ok) {
      setLocationNote(
        "Location is off. Allow location access to see games near where you are right now — showing games near your home city for now."
      );
    }
  };

  const headerDate = useMemo(() => {
    const d = new Date();
    const w = d
      .toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Chicago" })
      .toUpperCase();
    const ymd = d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    return `${w} · ${ymd.replace(/-/g, ".")}`;
  }, []);

  return (
    <div className="app-canvas bg-paper">
      <div className="flex items-end justify-between px-5 pb-2 pt-3 sm:px-0 lg:pt-6">
        <div>
          <p
            className="mb-1 font-mono text-[9px] uppercase text-ink-60"
            style={{ letterSpacing: 1.8 }}
          >
            {headerDate}
          </p>
          {/* 26px on phones, larger once there is room for it */}
          <h1
            className="font-display text-[26px] uppercase leading-none text-ink lg:text-[34px]"
            style={{ letterSpacing: -1 }}
          >
            JOBS<span className="text-signal">/</span>FEED
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setFilterPanelOpen((v) => !v)}
          aria-label="Filters"
          aria-expanded={filterPanelOpen}
          className={`relative flex h-9 w-9 items-center justify-center border ${
            filterPanelOpen || filtersActive
              ? "border-signal bg-signal/10 text-signal"
              : "border-ink bg-chalk text-ink"
          }`}
        >
          <Icon name="filter" size={14} />
          {filtersActive ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-signal px-1 font-mono-bold text-[9px] text-paper">
              {activeFilters.size}
            </span>
          ) : null}
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 border-y border-ink px-5 py-2 sm:px-0">
        <span
          className="flex-1 font-mono-bold text-[9px] uppercase text-ink"
          style={{ letterSpacing: 1.4 }}
        >
          <span className="text-signal">{counts.available}</span> NEW ·{" "}
          <span className="text-signal">{counts.invited}</span> INVITED
        </span>
        <button
          type="button"
          onClick={handleLocationToggle}
          disabled={locating}
          aria-label="Toggle location mode"
          className={`flex items-center gap-1 border px-2 py-1 ${
            locationMode === "near_me"
              ? "border-signal bg-signal/10 text-signal"
              : "border-ink-20 bg-chalk text-ink"
          }`}
        >
          {locating ? (
            <Spinner className="h-2.5 w-2.5" />
          ) : (
            <Icon name={locationMode === "near_me" ? "navigation" : "home"} size={10} />
          )}
          <span className="font-mono-bold text-[9px] uppercase" style={{ letterSpacing: 1.4 }}>
            {locationMode === "near_me" ? "NEAR ME" : "HOME"}
          </span>
        </button>
      </div>

      <ZebraRule variant="signal" thin noMargin />

      <div className="flex-1 px-5 pb-6 sm:px-0">
        {locationNote ? (
          <p
            className="mt-3 border border-whistle bg-whistle/10 px-3 py-2 font-mono text-[10px] uppercase text-ink-80"
            style={{ letterSpacing: 1 }}
          >
            {locationNote}
          </p>
        ) : null}

        {loading ? (
          <div className="mb-2 flex flex-col items-center py-8 text-signal">
            <Spinner />
            <span
              className="mt-3 font-mono-bold text-[10px] uppercase text-ink-60"
              style={{ letterSpacing: 2 }}
            >
              Loading jobs…
            </span>
          </div>
        ) : null}

        {!loading && error && tab === "available" ? (
          <p
            className="mb-2 px-1 py-2 font-mono text-[10px] uppercase text-foul"
            style={{ letterSpacing: 1 }}
          >
            {usedMockForAvailable
              ? `${error} — showing offline demo list.`
              : `Couldn't load jobs: ${error}`}
          </p>
        ) : null}

        {/* Tabs */}
        <div className="mb-3 mt-3 flex border border-ink lg:max-w-lg">
          {(
            [
              ["available", "Available", counts.available],
              ["invited", "Invited", counts.invited],
              ["saved", "Saved", counts.saved],
            ] as const
          ).map(([key, label, count], idx) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex-1 py-2.5 ${idx < 2 ? "border-r border-ink" : ""} ${
                  active ? "bg-ink" : "bg-chalk"
                }`}
              >
                <span
                  className={`font-mono-bold text-[9px] uppercase ${
                    active ? "text-paper" : "text-ink-60"
                  }`}
                  style={{ letterSpacing: 1.2 }}
                >
                  {label} <span className={active ? "text-hi-vis" : "text-ink"}>{count}</span>
                </span>
              </button>
            );
          })}
        </div>

        {filterPanelOpen ? (
          <div className="mb-4 border border-ink bg-paper">
            <div className="flex items-center justify-between border-b border-ink-20 px-3 py-2">
              <span
                className="font-mono-bold text-[9px] uppercase text-ink-60"
                style={{ letterSpacing: 1.6 }}
              >
                Filters
              </span>
              {filtersActive ? (
                <button
                  type="button"
                  onClick={() => setActiveFilters(new Set())}
                  className="font-mono-bold text-[9px] uppercase text-signal"
                  style={{ letterSpacing: 1.4 }}
                >
                  Clear all
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 p-3">
              {JOB_FEED_FILTERS.map((f) => {
                const on = activeFilters.has(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFilter(f.id)}
                    aria-pressed={on}
                    className={`border px-3 py-2 font-mono-bold text-[9px] uppercase ${
                      on ? "border-signal bg-signal text-paper" : "border-ink bg-chalk text-ink"
                    }`}
                    style={{ letterSpacing: 1.2 }}
                  >
                    {f.showPin ? "📍 " : ""}
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {filtersActive && tabRows.length > 0 ? (
          <p
            className="mb-3 px-0.5 font-mono-bold text-[9px] uppercase text-ink-60"
            style={{ letterSpacing: 1.4 }}
          >
            Showing {visible.length} of {tabRows.length}
          </p>
        ) : null}

        <div className="card-grid">
          {visible.length === 0 && !loading ? (
            <p className="px-1 py-6 font-mono text-xs uppercase text-ink-60">
              {tabRows.length === 0
                ? "No jobs in this tab yet."
                : filtersActive
                  ? "No jobs match your filters. Try clearing one or tap the filter icon."
                  : "No jobs in this tab yet."}
            </p>
          ) : null}
          {visible.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </div>
    </div>
  );
}
