import { supabase } from "../client";

export type AssignmentRow = {
  id: string;
  status: string;
  job: {
    id: string;
    title: string;
    starts_at: string;
    timezone?: string | null;
    venue_name: string;
    venue_city: string;
    venue_state: string;
    pay_per_game: number;
    num_games: number;
    sport_id: string;
    hirers: { org_name: string } | null;
  };
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
      "id, status, job:jobs(id, title, starts_at, timezone, venue_name, venue_city, venue_state, pay_per_game, num_games, sport_id, hirers(org_name))"
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
      "id, status, job:jobs(id, title, starts_at, timezone, venue_name, venue_city, venue_state, pay_per_game, num_games, sport_id, hirers(org_name))"
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
