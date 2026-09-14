// What stops a reviewed import row from being posted. Mirrors the checks
// import_tournament_schedule makes, so the director fixes rows before Create.

export type ReviewRow = {
  homeTeam: string;
  awayTeam: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24-hour */
  time: string;
  level: string;
  ageGroup: string;
};

export function rowErrors(row: ReviewRow, t: { starts_on: string; ends_on: string } | null): string[] {
  const errors: string[] = [];
  const home = row.homeTeam.trim();
  const away = row.awayTeam.trim();
  if (!home || !away) errors.push("Both teams needed");
  else if (home.toLowerCase() === away.toLowerCase()) errors.push("Teams must differ");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) errors.push("Date needed");
  else if (t && (row.date < t.starts_on.slice(0, 10) || row.date > t.ends_on.slice(0, 10))) {
    errors.push("Outside the tournament dates");
  }
  if (!/^\d{2}:\d{2}$/.test(row.time)) errors.push("Tip-off time needed");
  if (!row.level) errors.push("Level needed");
  if (row.level === "youth_rec" && !row.ageGroup.trim()) errors.push("Age group needed");
  return errors;
}
