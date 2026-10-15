import { supabase } from "../client";
import { fetchOpenJobs } from "../jobs/queries";
import { fetchReliability, type ReliabilityCounts } from "./reliability";

// The referee's home dashboard: money this month and year, games worked by
// level, how often organizers approve them, their rating trend and their next
// game. Worked out from rows they can already read about themselves.

type RawJob = {
  id: string;
  title: string;
  starts_at: string;
  timezone: string | null;
  level: string | null;
  num_games: number | null;
  pay_per_game: number | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_city: string | null;
  venue_state: string | null;
  arrival_notes: string | null;
};

export type DashboardAssignment = {
  status: string | null;
  amount_due: number | null;
  payout_status: string | null;
  application_outcome: string | null;
  jobs: RawJob | RawJob[] | null;
};

export type DashboardRating = { overall: number | null; ratedAt: string };

export type NextGame = {
  jobId: string;
  title: string;
  startsAt: string;
  timeZone: string | null;
  venueName: string | null;
  venueAddress: string | null;
  venueCity: string | null;
  venueState: string | null;
  arrivalNotes: string | null;
  /** The organizer changed the game; the referee has to confirm again. */
  needsReconfirm: boolean;
};

export type LevelCount = { level: string; games: number };

export type RefereeDashboard = {
  money: { month: { paid: number; owed: number }; year: { paid: number; owed: number } };
  gamesByLevel: { month: LevelCount[]; year: LevelCount[] };
  /** Organizers' decisions only; rate is null until there are enough of them. */
  approval: { approved: number; decided: number; rate: number | null };
  rating: { recent: number; recentCount: number; previous: number | null } | null;
  nextGame: NextGame | null;
};

const MIN_DECISIONS = 3;
const RATING_WINDOW = 10;

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function average(values: number[]): number {
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
}

function byLevel(counts: Map<string, number>): LevelCount[] {
  return [...counts.entries()]
    .map(([level, games]) => ({ level, games }))
    .sort((x, y) => y.games - x.games);
}

export function summarizeRefereeDashboard(input: {
  assignments: DashboardAssignment[];
  ratings: DashboardRating[];
  now?: Date;
}): RefereeDashboard {
  const now = input.now ?? new Date();
  const month = { paid: 0, owed: 0 };
  const year = { paid: 0, owed: 0 };
  const monthLevels = new Map<string, number>();
  const yearLevels = new Map<string, number>();
  let approved = 0;
  let declined = 0;
  let next: NextGame | null = null;

  for (const row of input.assignments) {
    if (row.application_outcome === "approved") approved += 1;
    if (row.application_outcome === "declined") declined += 1;

    const job = one(row.jobs);
    if (!job) continue;
    const start = new Date(job.starts_at);
    const sameYear = start.getFullYear() === now.getFullYear();
    const sameMonth = sameYear && start.getMonth() === now.getMonth();

    const worked = row.status === "completed";
    const fee = row.status === "cancelled" && (row.amount_due ?? 0) > 0;
    if (worked || fee) {
      const amount = row.amount_due ?? (job.pay_per_game ?? 0) * (job.num_games ?? 1);
      const bucket = row.payout_status === "paid" ? "paid" : "owed";
      if (sameYear) year[bucket] += amount;
      if (sameMonth) month[bucket] += amount;
    }
    if (worked && job.level) {
      const games = job.num_games ?? 1;
      if (sameYear) yearLevels.set(job.level, (yearLevels.get(job.level) ?? 0) + games);
      if (sameMonth) monthLevels.set(job.level, (monthLevels.get(job.level) ?? 0) + games);
    }

    const confirmed = row.status === "accepted" || row.status === "needs_reconfirm";
    if (confirmed && start > now && (!next || start < new Date(next.startsAt))) {
      next = {
        jobId: job.id,
        title: job.title,
        startsAt: job.starts_at,
        timeZone: job.timezone,
        venueName: job.venue_name,
        venueAddress: job.venue_address,
        venueCity: job.venue_city,
        venueState: job.venue_state,
        arrivalNotes: job.arrival_notes,
        needsReconfirm: row.status === "needs_reconfirm",
      };
    }
  }

  const decided = approved + declined;
  const scores = input.ratings
    .filter((r): r is { overall: number; ratedAt: string } => typeof r.overall === "number")
    .sort((x, y) => y.ratedAt.localeCompare(x.ratedAt))
    .map((r) => r.overall);
  const recent = scores.slice(0, RATING_WINDOW);
  const previous = scores.slice(RATING_WINDOW, RATING_WINDOW * 2);

  return {
    money: { month, year },
    gamesByLevel: { month: byLevel(monthLevels), year: byLevel(yearLevels) },
    approval: { approved, decided, rate: decided >= MIN_DECISIONS ? Math.round((approved / decided) * 100) : null },
    rating: recent.length
      ? { recent: average(recent), recentCount: recent.length, previous: previous.length ? average(previous) : null }
      : null,
    nextGame: next,
  };
}

/** "in 3 days", "tomorrow", "in 5 hours", "in 40 min", "now". */
export function countdownLabel(startsAt: string, now: Date = new Date()): string {
  const ms = new Date(startsAt).getTime() - now.getTime();
  if (ms <= 0) return "now";
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours < 1) return `in ${minutes} min`;
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  if (hours < 48) return "tomorrow";
  return `in ${Math.floor(hours / 24)} days`;
}

/** How many of these feed games were posted in the last 24 hours. */
export function newSinceYesterday(rows: { postedAtIso?: string | null }[], now: Date = new Date()): number {
  const since = now.getTime() - 24 * 3_600_000;
  return rows.filter((r) => r.postedAtIso && new Date(r.postedAtIso).getTime() > since).length;
}

/** Confirmed crew on a game, by first name and initial, other than the referee. */
export async function fetchCrewNames(jobId: string, selfId: string): Promise<string[]> {
  const { data } = await supabase
    .from("job_assignments")
    .select("ref_id, public_profiles(first_name, last_initial)")
    .eq("job_id", jobId)
    .in("status", ["accepted", "needs_reconfirm"]);
  return ((data ?? []) as any[])
    .filter((r) => r.ref_id !== selfId)
    .map((r) => one(r.public_profiles) as { first_name: string; last_initial: string } | null)
    .filter((p): p is { first_name: string; last_initial: string } => !!p)
    .map((p) => `${p.first_name} ${p.last_initial}.`);
}

export async function fetchDashboardAssignments(
  userId: string
): Promise<{ assignments: DashboardAssignment[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("job_assignments")
    .select(
      "status, amount_due, payout_status, application_outcome, jobs(id, title, starts_at, timezone, level, num_games, pay_per_game, venue_name, venue_address, venue_city, venue_state, arrival_notes)"
    )
    .eq("ref_id", userId);
  if (error) return { assignments: [], error: new Error(error.message) };
  return { assignments: (data ?? []) as unknown as DashboardAssignment[], error: null };
}

export type RefereeDashboardData = RefereeDashboard & {
  reliability: ReliabilityCounts | null;
  crew: string[];
  /** Open games that match the referee's radius, days, rate and roster. */
  openGames: number;
  newOpenGames: number;
};

/** Everything the referee home dashboard shows, in one go. */
export async function loadRefereeDashboard(userId: string): Promise<RefereeDashboardData> {
  const [{ assignments }, { data: ratingRows }, reliability, open] = await Promise.all([
    fetchDashboardAssignments(userId),
    supabase.rpc("my_ratings"),
    fetchReliability([userId]),
    fetchOpenJobs(supabase, userId),
  ]);
  const ratings = ((ratingRows ?? []) as Array<{ rating: number | null; rated_at: string }>).map((r) => ({
    overall: r.rating,
    ratedAt: r.rated_at,
  }));
  const summary = summarizeRefereeDashboard({ assignments, ratings });
  const crew = summary.nextGame ? await fetchCrewNames(summary.nextGame.jobId, userId) : [];
  return {
    ...summary,
    reliability: reliability.get(userId) ?? null,
    crew,
    openGames: open.jobs.length,
    newOpenGames: newSinceYesterday(open.jobs),
  };
}
