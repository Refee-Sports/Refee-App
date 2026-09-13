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

/** Levels that require an age group (youth/high-school divisions). */
export const AGE_REQUIRED_LEVELS = ["youth_rec", "high_school"];

export const QUARTER_MINUTES = ["6", "7", "8", "9", "10", "12"];
export const HALF_MINUTES = ["14", "16", "18", "20", "24"];

export function periodLabel(format: "quarters" | "halves"): string {
  return format === "quarters" ? "QUARTER" : "HALF";
}
