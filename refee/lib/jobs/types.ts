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
  /** For mock / UI-only rows */
  variant?: "hot" | "featured" | "default";
};
