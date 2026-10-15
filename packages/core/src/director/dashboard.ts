import { supabase } from "../client";
import { fetchMyHirerId, type DirectorGameRow } from "./queries";

// The director's dashboard: which upcoming games are still short of referees
// (the next 7 days flagged), and what they've spent, this month and per
// tournament, with Refee's fee shown on its own. Time to fill is recorded
// (jobs.filled_at, 0072) but not shown yet.

/**
 * Refee's fee on top of crew pay. Must equal PLATFORM_FEE_PCT in
 * supabase/functions/_shared/pay-math.ts, which is what's actually charged; a
 * test fails if they drift apart.
 */
export const PLATFORM_FEE_PCT = 0.05;

const URGENT_DAYS = 7;
const CHARGED = new Set(["prepaid", "processing", "paid", "disputed"]);

export type ShortGame = {
  gameId: string;
  title: string;
  startsAt: string;
  timeZone: string | null;
  confirmed: number;
  crew: number;
  /** Within the next 7 days. */
  urgent: boolean;
};

export type Spend = { charged: number; pending: number; fee: number; total: number };

export type DirectorDashboard = {
  coverage: {
    upcoming: number;
    staffed: number;
    openSlots: number;
    urgentCount: number;
    short: ShortGame[];
  };
  spend: {
    month: Spend;
    tournaments: (Spend & { tournamentId: string; name: string })[];
  };
};

function emptySpend(): Spend {
  return { charged: 0, pending: 0, fee: 0, total: 0 };
}

/** What a game costs the director, and whether that has been charged yet. */
function gameSpend(game: DirectorGameRow): Spend | null {
  const g = game as DirectorGameRow & { refunded_amount_cents?: number | null; pay_total?: number | null };
  const charged = CHARGED.has(g.payment_status ?? "");
  if (g.status === "cancelled" && !charged) return null;
  if (charged) {
    const crew = (g.prepaid_crew_cents ?? 0) / 100 || (g.pay_total ?? (g.pay_per_game ?? 0) * (g.crew_size ?? 1));
    const fee = (g.prepaid_fee_cents ?? 0) / 100 || Math.round(crew * PLATFORM_FEE_PCT);
    const amount = crew + fee - (g.refunded_amount_cents ?? 0) / 100;
    return { charged: amount, pending: 0, fee, total: amount };
  }
  const crew = (g.pay_per_game ?? 0) * (g.crew_size ?? 1);
  const fee = Math.round(crew * PLATFORM_FEE_PCT);
  return { charged: 0, pending: crew + fee, fee, total: crew + fee };
}

function add(into: Spend, s: Spend) {
  into.charged += s.charged;
  into.pending += s.pending;
  into.fee += s.fee;
  into.total += s.total;
}

export function summarizeDirectorDashboard(games: DirectorGameRow[], now: Date = new Date()): DirectorDashboard {
  const urgentBefore = now.getTime() + URGENT_DAYS * 86_400_000;
  let upcoming = 0;
  let staffed = 0;
  let openSlots = 0;
  const short: ShortGame[] = [];
  const month = emptySpend();
  const byTournament = new Map<string, Spend & { tournamentId: string; name: string }>();

  for (const game of games) {
    const start = new Date(game.starts_at);
    const live = game.status !== "cancelled" && game.status !== "completed";
    if (live && start > now) {
      upcoming += 1;
      const crew = game.crew_size ?? 1;
      const confirmed = Math.min(game.confirmedCount ?? 0, crew);
      if (confirmed >= crew) {
        staffed += 1;
      } else {
        openSlots += crew - confirmed;
        short.push({
          gameId: game.id,
          title: game.title,
          startsAt: game.starts_at,
          timeZone: game.timezone ?? null,
          confirmed,
          crew,
          urgent: start.getTime() <= urgentBefore,
        });
      }
    }

    const spend = gameSpend(game);
    if (!spend) continue;
    if (start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth()) add(month, spend);
    const tournament = (game as DirectorGameRow & { tournaments?: { name: string } | { name: string }[] | null }).tournaments;
    const t = Array.isArray(tournament) ? tournament[0] : tournament;
    if (game.tournament_id) {
      const entry =
        byTournament.get(game.tournament_id) ??
        { tournamentId: game.tournament_id, name: t?.name ?? "Tournament", ...emptySpend() };
      add(entry, spend);
      byTournament.set(game.tournament_id, entry);
    }
  }

  short.sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.startsAt.localeCompare(b.startsAt));
  return {
    coverage: { upcoming, staffed, openSlots, urgentCount: short.filter((s) => s.urgent).length, short },
    spend: { month, tournaments: [...byTournament.values()].sort((a, b) => b.total - a.total) },
  };
}

/** "waiting 20 min", "waiting 5 hours", "waiting 3 days". */
export function waitingLabel(since: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 60_000));
  if (minutes < 60) return `waiting ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `waiting ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `waiting ${days} day${days === 1 ? "" : "s"}`;
}

/** The director's games from the last 120 days on, with crew counts and tournament names. */
export async function loadDirectorDashboard(userId: string): Promise<DirectorDashboard | null> {
  const hirerId = await fetchMyHirerId(userId);
  if (!hirerId) return null;
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("jobs")
    .select("*, job_assignments(status), tournaments(name)")
    .eq("hirer_id", hirerId)
    .gte("starts_at", since);
  if (error) return null;
  const games = ((data ?? []) as Array<Record<string, unknown>>).map(({ job_assignments, ...job }) => ({
    ...(job as unknown as DirectorGameRow),
    confirmedCount: ((job_assignments ?? []) as { status: string }[]).filter((a) =>
      ["accepted", "needs_reconfirm", "completed"].includes(a.status)
    ).length,
  }));
  return summarizeDirectorDashboard(games);
}
