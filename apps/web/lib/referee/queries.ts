import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

export type UpcomingGameRow = {
  assignmentId: string;
  jobId: string;
  title: string;
  startsAt: string;
  venueName: string;
  venueCity: string;
  venueState: string;
  payPerGame: number;
  orgName: string;
  /** director changed time/venue/pay — ref must re-accept */
  needsReconfirm: boolean;
};

export type EarningsPeriod = "week" | "month" | "year";

export type EarningsSummary = {
  totalEarned: number;
  gamesWorked: number;
  /** pay locked in from accepted upcoming games (not yet worked) */
  pendingTotal: number;
  pendingGames: number;
};

function getPeriodStart(period: EarningsPeriod): Date {
  const now = new Date();
  if (period === "week") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay()); // Sunday start
    return d;
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(now.getFullYear(), 0, 1); // Jan 1
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function fetchUpcomingGames(
  userId: string
): Promise<{ games: UpcomingGameRow[]; error: Error | null }> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("job_assignments")
    .select(
      "id, job_id, status, jobs(id, title, starts_at, venue_name, venue_city, venue_state, pay_per_game, hirers(org_name))"
    )
    .eq("ref_id", userId)
    .in("status", ["accepted", "needs_reconfirm"]);

  if (error) return { games: [], error: new Error(error.message) };

  const games: UpcomingGameRow[] = (data ?? [])
    .map((row: any) => {
      const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
      if (!job || job.starts_at <= now) return null;
      const hirer = Array.isArray(job.hirers) ? job.hirers[0] : job.hirers;
      return {
        assignmentId: row.id,
        jobId: row.job_id,
        title: job.title,
        startsAt: job.starts_at,
        venueName: job.venue_name,
        venueCity: job.venue_city,
        venueState: job.venue_state,
        payPerGame: job.pay_per_game,
        orgName: hirer?.org_name ?? "ORGANIZER",
        needsReconfirm: row.status === "needs_reconfirm",
      };
    })
    .filter((g): g is UpcomingGameRow => g !== null)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 5);

  return { games, error: null };
}

export async function fetchEarningsSummary(
  userId: string,
  period: EarningsPeriod = "week"
): Promise<{ summary: EarningsSummary; error: Error | null }> {
  const empty: EarningsSummary = { totalEarned: 0, gamesWorked: 0, pendingTotal: 0, pendingGames: 0 };

  const { data, error } = await supabase
    .from("job_assignments")
    .select("status, amount_due, jobs(pay_per_game, starts_at)")
    .eq("ref_id", userId)
    .in("status", ["completed", "accepted", "cancelled"]);

  if (error) {
    return { summary: empty, error: new Error(error.message) };
  }

  const periodStart = getPeriodStart(period).toISOString();
  const now = new Date().toISOString();

  let totalEarned = 0;
  let gamesWorked = 0;
  let pendingTotal = 0;
  let pendingGames = 0;

  for (const row of (data ?? []) as any[]) {
    const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
    if (!job) continue;
    const amount = row.amount_due ?? job.pay_per_game ?? 0;

    if (row.status === "completed") {
      // earned — filtered by selected period
      if (job.starts_at >= periodStart) {
        totalEarned += amount;
        gamesWorked += 1;
      }
    } else if (row.status === "cancelled" && (row.amount_due ?? 0) > 0) {
      // late-cancellation bust fee counts as earned, but not a game worked
      if (job.starts_at >= periodStart) {
        totalEarned += row.amount_due;
      }
    } else if (row.status === "accepted" && job.starts_at > now) {
      // scheduled but not yet worked — period-independent
      pendingTotal += amount;
      pendingGames += 1;
    }
  }

  return { summary: { totalEarned, gamesWorked, pendingTotal, pendingGames }, error: null };
}
