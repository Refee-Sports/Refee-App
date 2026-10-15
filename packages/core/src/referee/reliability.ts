import { supabase } from "../client";

// Show rate: how often a referee kept the games they confirmed over the last
// year (migration 0069). Late withdrawals (inside 48 hours) and no-shows count
// against it; withdrawing in good time, or a director cancelling, never does.

export type ReliabilityCounts = { kept: number; late_withdrawals: number; no_shows: number };

export type ShowRate = {
  /** Whole percent, rounded down; null until there are enough games to judge. */
  rate: number | null;
  label: string;
  detail: string;
};

/** Fewer confirmed games than this and one bad day would define someone. */
const MIN_GAMES = 3;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function showRate(counts: ReliabilityCounts | null | undefined): ShowRate {
  const kept = counts?.kept ?? 0;
  const late = counts?.late_withdrawals ?? 0;
  const noShows = counts?.no_shows ?? 0;
  const total = kept + late + noShows;
  if (total < MIN_GAMES) {
    return { rate: null, label: "New referee", detail: `Fewer than ${MIN_GAMES} games in the last year` };
  }
  const rate = Math.floor((kept / total) * 100);
  const lapses = [late ? plural(late, "late drop-out") : null, noShows ? plural(noShows, "no-show") : null].filter(Boolean);
  return {
    rate,
    label: `${rate}% show rate`,
    detail: lapses.length ? `${lapses.join(" · ")} in the last year` : "Kept every game in the last year",
  };
}

/** Counts for each referee, keyed by id. Missing ids simply have no entry. */
export async function fetchReliability(refIds: string[]): Promise<Map<string, ReliabilityCounts>> {
  const ids = [...new Set(refIds.filter(Boolean))];
  const result = new Map<string, ReliabilityCounts>();
  if (ids.length === 0) return result;
  try {
    const { data } = await supabase.rpc("referee_reliability", { p_ref_ids: ids });
    for (const row of (data ?? []) as Array<ReliabilityCounts & { ref_id: string }>) {
      result.set(row.ref_id, { kept: row.kept, late_withdrawals: row.late_withdrawals, no_shows: row.no_shows });
    }
  } catch {
    /* A missing show rate never hides an applicant or a profile. */
  }
  return result;
}
