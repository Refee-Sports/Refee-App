/** Tab used in the jobs feed UI */
export type FeedTab = "available" | "invited" | "saved";

/** Row shape for job cards in the feed (DB or mock) */
export type JobListRow = {
  id: string;
  jobId: string;
  tab: FeedTab;
  title: string;
  org: string;
  orgVerified?: boolean;
  pay: string;
  payUnit: string;
  date: string;
  time: string;
  crew: string;
  dist: string;
  tags: string[];
  variant?: "hot" | "featured" | "default";
  tagLeft?: string;
  footerCta: string;
  footerCtaTone: "ink" | "signal" | "muted";
  /** ISO start — used for date filters */
  startsAtIso: string;
  payPerGame: number;
  crewSize: number;
  level: string;
  ageGroup: string | null;
  /** Miles from ref; null when unknown (DB rows until geocoding) */
  distanceMiles: number | null;
};

/** Full job detail for the job screen */
export type JobDetail = {
  id: string;
  jobCode: string;
  telemetryLeft: string;
  telemetryRight: string;
  heroTag: string;
  title: string;
  org: string;
  orgVerified?: boolean;
  payTotal: number;
  payPerGame: number;
  numGames: number;
  payoutHours: number;
  whenPrimary: string;
  whenSecondary: string;
  whenTertiary: string;
  wherePrimary: string;
  whereSecondary: string;
  whereTertiary: string;
  venueName: string;
  venueAddress: string | null;
  /** Street, city, state, ZIP in normal case — for maps and copy. Null when only the city is known. */
  venueFullAddress?: string | null;
  /** Map pin; null when the venue couldn't be geocoded. */
  venueLat?: number | null;
  venueLng?: number | null;
  /** Which court or gym at the venue. */
  court?: string | null;
  /** Entrance, parking, doors time, check-in. */
  arrivalNotes?: string | null;
  crewSize: number;
  sportLabel: string;
  levelLabel: string;
  ruleset: string | null;
  gameLength: string;
  uniform: string | null;
  parking: string | null;
  hirerNote: string | null;
  slotsOpen: number;
  closesInLabel: string | null;
  isFeatured: boolean;
  /** Raw ISO start time — absent on mock rows */
  startsAtIso?: string;
  /** IANA zone of the venue; times on this job are shown in it. */
  timeZone?: string | null;
  /** For mock / UI-only rows */
  variant?: "hot" | "featured" | "default";
};
