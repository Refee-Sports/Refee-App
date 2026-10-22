// Shared basketball option sets used by tournament + game creation.

export const RULESETS = [
  { id: "NFHS", label: "NFHS" },
  { id: "NCAA-M", label: "NCAA MEN'S" },
  { id: "NCAA-W", label: "NCAA WOMEN'S" },
  { id: "PRO", label: "PRO" },
];

export const LEVELS = [
  { id: "youth_rec", label: "YOUTH / REC" },
  { id: "high_school", label: "HIGH SCHOOL" },
  { id: "juco", label: "JUCO" },
  { id: "naia", label: "NAIA" },
  { id: "ncaa_mens", label: "NCAA MEN'S" },
  { id: "ncaa_womens", label: "NCAA WOMEN'S" },
  { id: "pro_am", label: "PRO-AM" },
];

/** Levels that require an age group. High school uses a team level instead:
 *  a varsity game spans grades 9–12, so an age bracket means nothing there. */
export const AGE_REQUIRED_LEVELS = ["youth_rec"];

/** Age brackets for youth / rec games. */
export const YOUTH_AGE_GROUPS = ["U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18"];

/** High school team levels (stored in jobs.team_level). */
export const TEAM_LEVELS = [
  { id: "varsity", label: "VARSITY" },
  { id: "jv", label: "JV" },
  { id: "freshman", label: "FRESHMAN" },
];

/** A game is 2 halves or 4 quarters; a half runs at most 20 minutes. */
export const MAX_HALF_MINUTES = 20;
export const QUARTER_MINUTES = ["6", "7", "8", "9", "10", "12"];
/** Every half length from 8 to 20 minutes. */
export const HALF_MINUTES = Array.from({ length: MAX_HALF_MINUTES - 7 }, (_, i) => String(i + 8));

/** "2 × 20 MIN HALVES" / "4 × 8 MIN QUARTERS", or a dash when not set. */
export function formatGameLength(
  format: "quarters" | "halves" | string | null | undefined,
  periodMinutes: number | null | undefined
): string {
  if (!periodMinutes || (format !== "halves" && format !== "quarters")) return "—";
  return format === "halves" ? `2 × ${periodMinutes} MIN HALVES` : `4 × ${periodMinutes} MIN QUARTERS`;
}

export function periodLabel(format: "quarters" | "halves"): string {
  return format === "quarters" ? "QUARTER" : "HALF";
}
