import type { JobDetail, JobListRow } from "./types";

type HirerJoin = { org_name: string; is_verified: boolean } | null;

export type JobDbRow = {
  id: string;
  hirer_id: string;
  sport_id: string;
  title: string;
  job_type: string;
  level: string;
  age_group: string | null;
  gender: string | null;
  ruleset: string | null;
  starts_at: string;
  ends_at: string | null;
  duration_minutes: number | null;
  venue_name: string;
  venue_address: string | null;
  venue_city: string;
  venue_state: string;
  venue_lat: number | null;
  venue_lng: number | null;
  pay_per_game: number;
  num_games: number;
  payout_window_hours: number | null;
  crew_size: number;
  status: string;
  is_featured: boolean;
  hirer_note: string | null;
  uniform_requirements: string | null;
  parking_info: string | null;
  closes_at: string | null;
  hirers: HirerJoin;
};

const TZ = "America/Chicago";

function formatCardDate(iso: string): string {
  const d = new Date(iso);
  const w = d.toLocaleDateString("en-US", { weekday: "short", timeZone: TZ }).toUpperCase();
  const md = d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", timeZone: TZ });
  return `${w} ${md}`;
}

function formatDetailDate(iso: string): string {
  return formatCardDate(iso);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  });
}

function formatDuration(dm: number | null): string {
  if (!dm) return "—";
  if (dm >= 120) return `${Math.round(dm / 60)}H`;
  return `${dm}M`;
}

function splitTitle(title: string): string {
  const t = title.toUpperCase();
  const mid = Math.floor(t.length / 2);
  const sp = t.lastIndexOf(" ", mid);
  if (sp <= 0) return t;
  return `${t.slice(0, sp)}\n${t.slice(sp + 1)}`;
}

function jobCodeFromId(id: string): string {
  return `#${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function tagsFromRow(row: JobDbRow): string[] {
  const tags: string[] = [];
  if (row.age_group) tags.push(row.age_group.toUpperCase());
  if (row.gender) tags.push(row.gender.replace("_", "-").toUpperCase());
  if (tags.length === 0) tags.push(row.level.replace("_", " ").toUpperCase());
  return tags.slice(0, 3);
}

function listVariant(row: JobDbRow): "hot" | "featured" | "default" {
  if (row.is_featured) return "featured";
  return "default";
}

function listTagLeft(row: JobDbRow): string | undefined {
  if (row.is_featured) return "FEATURED";
  return row.level.replace("_", " ").toUpperCase();
}

function formatClosesIn(closesAt: string | null): string | null {
  if (!closesAt) return null;
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return "CLOSED";
  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (h > 0) return `CLOSES IN ${h}H ${m}M`;
  return `CLOSES IN ${m}M`;
}

function heroTagFromRow(row: JobDbRow): string {
  if (row.is_featured && row.job_type === "tournament") return "FEATURED · TOURNAMENT";
  if (row.is_featured) return "FEATURED · POSTING";
  return row.job_type.replace("_", " ").toUpperCase();
}

function telemetryLeftFromRow(row: JobDbRow, slotsOpen: number): string {
  const closes = formatClosesIn(row.closes_at);
  if (slotsOpen > 0) {
    const slots = `${slotsOpen} SLOT${slotsOpen > 1 ? "S" : ""} LEFT`;
    return closes ? `${slots} · ${closes}` : `${slots} · OPEN ROLE`;
  }
  if (closes) return closes;
  if (row.is_featured) return "FEATURED POSTING";
  return "OPEN ASSIGNMENT";
}

export function mapDbJobToListRow(row: JobDbRow): JobListRow {
  const org = row.hirers?.org_name ?? "ORGANIZER";
  const variant = listVariant(row);
  const dm = row.duration_minutes;
  const timeStr = `${formatTime(row.starts_at)} · ${formatDuration(dm)}`;

  return {
    id: row.id,
    jobId: `JOB${jobCodeFromId(row.id)}`,
    tab: "available",
    title: splitTitle(row.title),
    org: org.toUpperCase(),
    orgVerified: row.hirers?.is_verified,
    pay: String(row.pay_per_game),
    payUnit: row.job_type === "multi_day" ? "/ DAY" : "/ GAME",
    date: formatCardDate(row.starts_at),
    time: timeStr,
    crew: `${row.crew_size}-PERSON`,
    dist: "—",
    tags: tagsFromRow(row),
    variant,
    tagLeft: listTagLeft(row),
    footerCta: "VIEW →",
    footerCtaTone: row.is_featured ? "signal" : "muted",
    startsAtIso: row.starts_at,
    payPerGame: row.pay_per_game,
    crewSize: row.crew_size,
    level: row.level,
    ageGroup: row.age_group,
    distanceMiles: null,
  };
}

export function mapDbJobToDetail(row: JobDbRow): JobDetail {
  const org = row.hirers?.org_name ?? "ORGANIZER";
  const payTotal = row.pay_per_game * row.num_games;
  const payout = row.payout_window_hours ?? 48;
  const dm = row.duration_minutes;
  const tertiary = dm ? `~ ${Math.max(1, Math.round(dm / 60))} HR BLOCK` : "—";
  const variant = listVariant(row);
  const slotsOpen = row.crew_size;

  const line =
    row.venue_address?.toUpperCase() ??
    `${row.venue_city}, ${row.venue_state}`.toUpperCase();

  return {
    id: row.id,
    jobCode: jobCodeFromId(row.id),
    telemetryLeft: telemetryLeftFromRow(row, slotsOpen),
    telemetryRight: "OPEN",
    heroTag: heroTagFromRow(row),
    title: row.title.toUpperCase(),
    org: org.toUpperCase(),
    orgVerified: row.hirers?.is_verified ?? false,
    payTotal,
    payPerGame: row.pay_per_game,
    numGames: row.num_games,
    payoutHours: payout,
    startsAtIso: row.starts_at,
    whenPrimary: formatDetailDate(row.starts_at),
    whenSecondary: `${formatTime(row.starts_at)} CT`,
    whenTertiary: tertiary,
    wherePrimary: row.venue_city.toUpperCase(),
    whereSecondary: row.venue_name.toUpperCase(),
    whereTertiary: line,
    venueName: row.venue_name.toUpperCase(),
    venueAddress: line,
    crewSize: row.crew_size,
    sportLabel: row.sport_id.replace("_", " ").toUpperCase(),
    levelLabel: [row.level, row.age_group, row.gender]
      .filter(Boolean)
      .join(" · ")
      .replace(/_/g, " ")
      .toUpperCase(),
    ruleset: row.ruleset?.toUpperCase() ?? null,
    gameLength: row.duration_minutes
      ? `${row.num_games} × ${Math.round((row.duration_minutes / row.num_games) || 32)} MIN`
      : "—",
    uniform: row.uniform_requirements?.toUpperCase() ?? null,
    parking: row.parking_info?.toUpperCase() ?? null,
    hirerNote: row.hirer_note,
    slotsOpen,
    closesInLabel: formatClosesIn(row.closes_at),
    isFeatured: row.is_featured,
    variant,
  };
}
