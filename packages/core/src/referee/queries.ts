import { supabase } from "../client";

// ── Types ────────────────────────────────────────────────────────────────────

export type UpcomingGameRow = {
  assignmentId: string;
  jobId: string;
  title: string;
  startsAt: string;
  /** IANA zone of the venue. */
  timeZone: string | null;
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
      "id, job_id, status, jobs(id, title, starts_at, timezone, venue_name, venue_city, venue_state, pay_per_game, hirers(org_name))"
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
        timeZone: job.timezone ?? null,
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

// ── Ratings received ─────────────────────────────────────────────────────────

export type ReceivedRating = {
  jobId: string | null;
  jobTitle: string | null;
  gameDate: string | null;
  overall: number | null;
  onTime: number | null;
  professionalism: number | null;
  gameManagement: number | null;
  ratedAt: string;
};

/**
 * The ratings this referee received, newest first: the game and the three
 * scores. The director's comment is not shared with the referee.
 */
export async function fetchMyRatings(): Promise<{ ratings: ReceivedRating[]; error: Error | null }> {
  const { data, error } = await supabase.rpc("my_ratings");
  if (error) return { ratings: [], error: new Error(error.message) };
  const ratings = ((data ?? []) as any[]).map((r) => ({
    jobId: r.job_id ?? null,
    jobTitle: r.job_title ?? null,
    gameDate: r.game_date ?? null,
    overall: r.rating ?? null,
    onTime: r.on_time ?? null,
    professionalism: r.professionalism ?? null,
    gameManagement: r.game_management ?? null,
    ratedAt: r.rated_at,
  }));
  return { ratings, error: null };
}

// ── Earnings statement ───────────────────────────────────────────────────────
// One line per game worked (and per late-cancellation fee), with where that
// money stands, so a referee can reconcile what Refee owes them against what
// reached their bank, and later against their 1099.

export type PayoutState = "paid" | "processing" | "pending" | "failed";

export type LedgerRow = {
  assignmentId: string;
  jobId: string;
  title: string;
  orgName: string;
  startsAt: string;
  timeZone: string | null;
  /** A game worked, or the fee paid when a director cancelled late. */
  kind: "game" | "late_cancel";
  amount: number;
  payout: PayoutState;
  paidAt: string | null;
};

const PAYOUT_STATES: PayoutState[] = ["paid", "processing", "pending", "failed"];

/** Shapes raw job_assignments rows (with their job and organizer) into statement lines, newest first. */
export function toLedgerRows(data: unknown[]): LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (const raw of data as any[]) {
    const job = Array.isArray(raw.jobs) ? raw.jobs[0] : raw.jobs;
    if (!job) continue;
    let kind: LedgerRow["kind"];
    if (raw.status === "completed") kind = "game";
    else if (raw.status === "cancelled" && (raw.amount_due ?? 0) > 0) kind = "late_cancel";
    else continue;
    const hirer = Array.isArray(job.hirers) ? job.hirers[0] : job.hirers;
    rows.push({
      assignmentId: raw.id,
      jobId: job.id,
      title: job.title,
      orgName: hirer?.org_name ?? "Organizer",
      startsAt: job.starts_at,
      timeZone: job.timezone ?? null,
      kind,
      amount: Number(raw.amount_due ?? job.pay_per_game ?? 0),
      payout: PAYOUT_STATES.includes(raw.payout_status) ? raw.payout_status : "pending",
      paidAt: raw.paid_at ?? null,
    });
  }
  return rows.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

/** Money already paid out vs still owed; games counts games worked, not fees. */
export function ledgerTotals(rows: LedgerRow[]): { paid: number; owed: number; games: number } {
  let paid = 0;
  let owed = 0;
  let games = 0;
  for (const r of rows) {
    if (r.payout === "paid") paid += r.amount;
    else owed += r.amount;
    if (r.kind === "game") games += 1;
  }
  return { paid, owed, games };
}

/** Where one line's money stands, in words. */
export function payoutLabel(row: LedgerRow): string {
  switch (row.payout) {
    case "paid": {
      if (!row.paidAt) return "Paid";
      const day = new Date(row.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `Paid ${day}`;
    }
    case "processing":
      return "Sending to your Stripe account";
    case "failed":
      return "Payment failed · Refee is fixing it";
    default:
      return "Owed · paid within 48 hours of the game";
  }
}

export async function fetchEarningsLedger(
  userId: string
): Promise<{ rows: LedgerRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("job_assignments")
    .select(
      "id, status, amount_due, payout_status, paid_at, jobs(id, title, starts_at, timezone, pay_per_game, hirers(org_name))"
    )
    .eq("ref_id", userId)
    .in("status", ["completed", "cancelled"]);
  if (error) return { rows: [], error: new Error(error.message) };
  return { rows: toLedgerRows(data ?? []), error: null };
}

// ── Earnings export ──────────────────────────────────────────────────────────

const CSV_STATUS: Record<PayoutState, string> = {
  paid: "Paid",
  processing: "Sending",
  pending: "Owed",
  failed: "Failed",
};

/** One CSV cell: quoted when needed, and never read as a formula by a spreadsheet. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** "2026-10-04": a game's calendar day at the venue. */
function venueDate(iso: string, tz: string | null): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: tz || "America/Chicago" });
}

/**
 * The earnings statement as CSV, for a spreadsheet or an accountant. Pass a
 * year to export one tax year (by the game's date).
 */
export function earningsCsv(rows: LedgerRow[], opts: { year?: number } = {}): string {
  const header = ["Game date", "Game", "Organizer", "Type", "Amount (USD)", "Status", "Paid on"];
  const lines = rows
    .filter((r) => opts.year == null || venueDate(r.startsAt, r.timeZone).startsWith(`${opts.year}-`))
    .map((r) =>
      [
        venueDate(r.startsAt, r.timeZone),
        r.title,
        r.orgName,
        r.kind === "game" ? "Game" : "Late-cancellation fee",
        r.amount.toFixed(2),
        CSV_STATUS[r.payout],
        r.paidAt ? r.paidAt.slice(0, 10) : "",
      ]
        .map(csvCell)
        .join(",")
    );
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}

export function earningsCsvFilename(opts: { year?: number } = {}, now: Date = new Date()): string {
  return `refee-earnings-${opts.year ?? now.toISOString().slice(0, 10)}.csv`;
}

/** The years a referee has earnings in, newest first, for choosing a tax year to export. */
export function earningsYears(rows: LedgerRow[]): number[] {
  return [...new Set(rows.map((r) => Number(venueDate(r.startsAt, r.timeZone).slice(0, 4))))].sort((a, b) => b - a);
}
