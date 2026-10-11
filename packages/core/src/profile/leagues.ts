/** Longest "leagues worked" note we store (matches the 0063 check constraint). */
export const LEAGUES_WORKED_MAX = 300;

/** Tidy what a referee typed: collapse whitespace, cap length, null when empty. */
export function cleanLeaguesWorked(raw: string): string | null {
  const text = raw.replace(/\s+/g, " ").trim().slice(0, LEAGUES_WORKED_MAX).trim();
  return text.length > 0 ? text : null;
}
