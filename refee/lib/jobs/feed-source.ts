import type { FeedTab, JobListRow } from "./types";

/**
 * Chooses the rows shown for a feed tab.
 *
 * Mock data is an OFFLINE demo only: it appears solely when Supabase is not
 * configured. When Supabase IS configured we show real data exclusively — an
 * empty tab renders the empty state rather than falling back to the seed
 * (out-of-area) demo jobs. This prevents the demo Austin/TX jobs from leaking
 * into a real referee's feed once they've taken all nearby games.
 */
export function resolveTabRows(params: {
  configured: boolean;
  tab: FeedTab;
  dbAvailable: JobListRow[];
  dbInvited: JobListRow[];
  mockRows: JobListRow[];
}): JobListRow[] {
  const { configured, tab, dbAvailable, dbInvited, mockRows } = params;
  if (configured) {
    if (tab === "available") return dbAvailable;
    if (tab === "invited") return dbInvited;
    return [];
  }
  return mockRows.filter((j) => j.tab === tab);
}

/** Tab counts, following the same offline-only rule as resolveTabRows. */
export function resolveCounts(params: {
  configured: boolean;
  dbAvailable: JobListRow[];
  dbInvited: JobListRow[];
  mockRows: JobListRow[];
}): { available: number; invited: number; saved: number } {
  const { configured, dbAvailable, dbInvited, mockRows } = params;
  if (configured) {
    return { available: dbAvailable.length, invited: dbInvited.length, saved: 0 };
  }
  return {
    available: mockRows.filter((j) => j.tab === "available").length,
    invited: mockRows.filter((j) => j.tab === "invited").length,
    saved: mockRows.filter((j) => j.tab === "saved").length,
  };
}
