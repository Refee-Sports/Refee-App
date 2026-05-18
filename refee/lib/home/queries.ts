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
    .in("status", ["accepted", "confirmed"])
    .gte("job.starts_at", new Date().toISOString())
    .order("job.starts_at", { ascending: true })
    .limit(10);

  if (error) return { today: [], upcoming: [], error: new Error(error.message) };

  const rows = ((data ?? []) as unknown as AssignmentRow[]).filter((r) => r.job);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

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
    .select("status, pay_amount, job:jobs(starts_at, num_games)")
    .eq("ref_id", userId)
    .in("status", ["accepted", "confirmed", "paid"]);

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
    const r = row as any;
    const amt: number = r.pay_amount ?? 0;
    const startsAt: string | undefined = r.job?.starts_at;
    const isThisMonth = startsAt ? new Date(startsAt) >= monthStart : false;

    if (r.status === "paid") {
      if (isThisMonth) {
        paidThisMonth += amt;
        gamesThisMonth += r.job?.num_games ?? 1;
      }
    } else {
      pendingTotal += amt;
      if (isThisMonth) gamesThisMonth += r.job?.num_games ?? 1;
    }
  }

  return {
    summary: { paidThisMonth, pendingTotal, gamesThisMonth },
    error: null,
  };
}
