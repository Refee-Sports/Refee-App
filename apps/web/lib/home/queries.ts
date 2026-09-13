import { supabase } from "@/lib/supabase";

export type AssignmentRow = {
  id: string;
  status: string;
  job: {
    id: string;
    title: string;
    starts_at: string;
    venue_name: string;
    venue_city: string;
    venue_state: string;
    pay_per_game: number;
    num_games: number;
    sport_id: string;
    hirers: { org_name: string } | null;
  };
};

export type EarningsSummary = {
  paidThisMonth: number;
  pendingTotal: number;
  gamesThisMonth: number;
};

/**
 * Applications waiting on the organizer.
 *
 * Accepting a game whose auto_accept is off creates a "pending" assignment,
 * not an accepted one. Those used to surface nowhere — the feed hides jobs
 * you've responded to, the Invited tab has no backend source, and the home
 * screen only queries accepted — so applying made a game vanish. Home shows
 * them now so a ref can see the application is in.
 */
export async function fetchPendingApplications(userId: string): Promise<{
  pending: AssignmentRow[];
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("job_assignments")
    .select(
      "id, status, job:jobs(id, title, starts_at, venue_name, venue_city, venue_state, pay_per_game, num_games, sport_id, hirers(org_name))"
    )
    .eq("ref_id", userId)
    .eq("status", "pending");

  if (error) return { pending: [], error: new Error(error.message) };

  const now = new Date();
  const pending = ((data ?? []) as unknown as AssignmentRow[])
    .filter((r) => r.job && new Date(r.job.starts_at) >= now)
    .sort((a, b) => new Date(a.job.starts_at).getTime() - new Date(b.job.starts_at).getTime());

  return { pending, error: null };
}

export async function fetchMyAssignments(userId: string): Promise<{
  today: AssignmentRow[];
  upcoming: AssignmentRow[];
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("job_assignments")
    .select(
      "id, status, job:jobs(id, title, starts_at, venue_name, venue_city, venue_state, pay_per_game, num_games, sport_id, hirers(org_name))"
    )
    .eq("ref_id", userId)
    .in("status", ["accepted"]);

  if (error) return { today: [], upcoming: [], error: new Error(error.message) };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const rows = ((data ?? []) as unknown as AssignmentRow[])
    .filter((r) => r.job)
    .filter((r) => new Date(r.job.starts_at) >= todayStart)
    .sort(
      (a, b) => new Date(a.job.starts_at).getTime() - new Date(b.job.starts_at).getTime()
    )
    .slice(0, 10);

  const today: AssignmentRow[] = [];
  const upcoming: AssignmentRow[] = [];

  for (const r of rows) {
    const d = new Date(r.job.starts_at);
    if (d >= todayStart && d <= todayEnd) {
      today.push(r);
    } else {
      upcoming.push(r);
    }
  }

  return { today, upcoming, error: null };
}

export async function fetchEarningsSummary(userId: string): Promise<{
  summary: EarningsSummary;
  error: Error | null;
}> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("job_assignments")
    .select("status, payout_status, amount_due, job:jobs(starts_at, num_games, pay_per_game)")
    .eq("ref_id", userId)
    .in("status", ["accepted", "completed", "cancelled"]);

  if (error) {
    return {
      summary: { paidThisMonth: 0, pendingTotal: 0, gamesThisMonth: 0 },
      error: new Error(error.message),
    };
  }

  let paidThisMonth = 0;
  let pendingTotal = 0;
  let gamesThisMonth = 0;

  for (const row of data ?? []) {
    const r = row as {
      status?: string;
      payout_status?: string;
      amount_due?: number | null;
      job?: { starts_at?: string; num_games?: number; pay_per_game?: number };
    };
    const startsAt = r.job?.starts_at;
    const isThisMonth = startsAt ? new Date(startsAt) >= monthStart : false;
    const games = r.job?.num_games ?? 1;
    const amt =
      r.amount_due ??
      (r.job?.pay_per_game != null ? r.job.pay_per_game * games : 0);

    if (r.status === "cancelled") {
      // late-cancellation bust fee: counts toward money, not games
      const fee = r.amount_due ?? 0;
      if (fee > 0) {
        if (r.payout_status === "paid") {
          if (isThisMonth) paidThisMonth += fee;
        } else {
          pendingTotal += fee;
        }
      }
    } else if (r.payout_status === "paid") {
      if (isThisMonth) {
        paidThisMonth += amt;
        gamesThisMonth += games;
      }
    } else if (r.status === "accepted" || r.status === "completed") {
      pendingTotal += amt;
      if (isThisMonth) gamesThisMonth += games;
    }
  }

  return {
    summary: { paidThisMonth, pendingTotal, gamesThisMonth },
    error: null,
  };
}
