import type { JobListRow } from "./types";
import { DEFAULT_TIME_ZONE } from "../time";


export const JOB_FEED_FILTERS = [
  { id: "radius_25", label: "25 MI", showPin: true, radiusMiles: 25 },
  { id: "this_week", label: "THIS WK", showPin: false },
  { id: "pay_100", label: "$100+", showPin: false, minPay: 100 },
  { id: "crew_3", label: "3-CREW", showPin: false, minCrew: 3 },
  { id: "u18_plus", label: "U18+", showPin: false },
] as const;

export type JobFeedFilterId = (typeof JOB_FEED_FILTERS)[number]["id"];

export function parseDistanceMiles(dist: string): number | null {
  const m = dist.match(/([\d.]+)\s*MI/i);
  return m ? parseFloat(m[1]) : null;
}

function datePartsIn(d: Date, tz: string) {
  const ymd = d.toLocaleDateString("en-CA", { timeZone: tz });
  const [y, m, day] = ymd.split("-").map(Number);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d);
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { y, m, day, dow: dowMap[weekday] ?? 0 };
}

/**
 * Same calendar week (Sun–Sat) at the venue — the week the game card shows.
 * "Now" is read in the same zone, so a late-Saturday game out west still
 * counts as this week for a ref anywhere.
 */
export function isThisWeekAtVenue(iso: string, tz?: string | null, now = new Date()): boolean {
  const zone = tz || DEFAULT_TIME_ZONE;
  const job = datePartsIn(new Date(iso), zone);
  const cur = datePartsIn(now, zone);
  const jobUtc = Date.UTC(job.y, job.m - 1, job.day);
  const curUtc = Date.UTC(cur.y, cur.m - 1, cur.day);
  return jobUtc - job.dow * 86_400_000 === curUtc - cur.dow * 86_400_000;
}

/** The same check pinned to America/Chicago (kept for existing callers). */
export function isThisWeekChicago(iso: string, now = new Date()): boolean {
  return isThisWeekAtVenue(iso, "America/Chicago", now);
}

export function matchesU18Plus(row: JobListRow): boolean {
  const level = row.level.toLowerCase();
  if (level === "adult" || level === "high_school" || level === "pro_am") return true;

  const ag = row.ageGroup?.toUpperCase() ?? "";
  if (ag === "ADULT" || ag === "HS") return true;
  const ageNum = ag.match(/^U(\d+)/)?.[1];
  if (ageNum && parseInt(ageNum, 10) >= 18) return true;

  for (const tag of row.tags) {
    const t = tag.toUpperCase();
    if (t === "ADULT" || t === "HS") return true;
    const tagNum = t.match(/^U(\d+)/)?.[1];
    if (tagNum && parseInt(tagNum, 10) >= 18) return true;
  }
  return false;
}

function matchesFilter(row: JobListRow, filterId: JobFeedFilterId): boolean {
  switch (filterId) {
    case "radius_25":
      if (row.distanceMiles == null) return true;
      return row.distanceMiles <= 25;
    case "this_week":
      return isThisWeekAtVenue(row.startsAtIso, row.timeZone);
    case "pay_100":
      return row.payPerGame >= 100;
    case "crew_3":
      return row.crewSize >= 3;
    case "u18_plus":
      return matchesU18Plus(row);
    default:
      return true;
  }
}

/** All active filters must pass (AND). Empty set returns all rows. */
export function applyJobFeedFilters(
  rows: JobListRow[],
  active: ReadonlySet<JobFeedFilterId>
): JobListRow[] {
  if (active.size === 0) return rows;
  return rows.filter((row) =>
    [...active].every((filterId) => matchesFilter(row, filterId))
  );
}

export function activeRadiusMiles(active: ReadonlySet<JobFeedFilterId>): number | null {
  if (active.has("radius_25")) return 25;
  return null;
}
