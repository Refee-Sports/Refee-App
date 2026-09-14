// Every game is shown in its venue's time zone (jobs.timezone). Refs travel to
// the venue, so "1:30 PM ET" at the gym is the time that matters. Chat and other
// non-venue times use the viewer's own zone instead.

/** Zone for rows that predate per-game zones (and the offline demo data). */
export const DEFAULT_TIME_ZONE = "America/Chicago";

// Short labels people read on US schedules. Explicit so web and mobile (whose
// Intl support differs) print the same thing.
const ZONE_LABELS: Record<string, { short: string; name: string }> = {
  "America/New_York": { short: "ET", name: "Eastern" },
  "America/Detroit": { short: "ET", name: "Eastern" },
  "America/Indiana/Indianapolis": { short: "ET", name: "Eastern" },
  "America/Kentucky/Louisville": { short: "ET", name: "Eastern" },
  "America/Chicago": { short: "CT", name: "Central" },
  "America/Indiana/Knox": { short: "CT", name: "Central" },
  "America/Denver": { short: "MT", name: "Mountain" },
  "America/Boise": { short: "MT", name: "Mountain" },
  "America/Phoenix": { short: "MT", name: "Arizona" },
  "America/Los_Angeles": { short: "PT", name: "Pacific" },
  "America/Anchorage": { short: "AKT", name: "Alaska" },
  "Pacific/Honolulu": { short: "HT", name: "Hawaii" },
  "America/Puerto_Rico": { short: "AT", name: "Atlantic" },
};

function zone(tz?: string | null): string {
  return tz || DEFAULT_TIME_ZONE;
}

/** "ET", "CT", "AT"… for a zone. Falls back to Intl's own abbreviation. */
export function zoneLabel(tz?: string | null): string {
  const z = zone(tz);
  const known = ZONE_LABELS[z];
  if (known) return known.short;
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: z, timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? z;
  } catch {
    return z;
  }
}

/** "Eastern", "Central", "Atlantic"… for sentences like "Times are Eastern". */
export function zoneName(tz?: string | null): string {
  return ZONE_LABELS[zone(tz)]?.name ?? zone(tz);
}

/** "1:30 PM" at the venue. */
export function formatGameTime(iso: string, tz?: string | null): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: zone(tz),
  });
}

/** "1:30 PM ET" at the venue. */
export function formatGameTimeWithZone(iso: string, tz?: string | null): string {
  return `${formatGameTime(iso, tz)} ${zoneLabel(tz)}`;
}

/** A date for a game instant, in the venue's zone. */
export function formatGameDate(
  iso: string,
  tz: string | null | undefined,
  opts: Intl.DateTimeFormatOptions
): string {
  return new Date(iso).toLocaleDateString("en-US", { ...opts, timeZone: zone(tz) });
}

/** "2026-09-20" — the calendar day at the venue. */
export function venueDay(iso: string, tz?: string | null): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: zone(tz) });
}

/**
 * A date-only value ("2026-09-20", e.g. tournaments.starts_on). Rendered in
 * UTC: new Date("2026-09-20") is UTC midnight, which is still Sep 19 anywhere
 * in the Americas.
 */
export function formatDateOnly(ymd: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(`${ymd.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    ...opts,
    timeZone: "UTC",
  });
}
