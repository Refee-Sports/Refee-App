import type { ExtractedGame, ExtractedSchedule } from "./ai-import";

// What an uploaded schedule fills in on the New tournament form. Anything the
// file doesn't say comes back blank for the director to complete.

export type TournamentDraft = {
  name: string;
  /** YYYY-MM-DD, or "" when the file gives no dates. */
  startsOn: string;
  endsOn: string;
  venueName: string;
  venueAddress: string;
  venueCity: string;
  venueState: string;
  venueZip: string;
  courts: string[];
  arrivalNotes: string;
  /** Games the file puts at a different venue than the tournament's. */
  gamesElsewhere: number;
};

const MAX_COURTS = 20;

const isDay = (d: string | null | undefined): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
const key = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** The venue most games are at, with its details from the first game listed there. */
function mainGameVenue(games: ExtractedGame[]): ExtractedGame | null {
  const counts = new Map<string, { n: number; game: ExtractedGame }>();
  for (const g of games) {
    const k = key(g.venue_name);
    if (!k) continue;
    const seen = counts.get(k);
    if (seen) seen.n += 1;
    else counts.set(k, { n: 1, game: g });
  }
  let best: { n: number; game: ExtractedGame } | null = null;
  for (const c of counts.values()) if (!best || c.n > best.n) best = c;
  return best?.game ?? null;
}

export function tournamentDraftFromSchedule(s: ExtractedSchedule): TournamentDraft {
  const gameDays = s.games.map((g) => g.date).filter(isDay).sort();
  const eventStart = s.event?.starts_on ?? null;
  const eventEnd = s.event?.ends_on ?? null;
  let startsOn = isDay(eventStart) ? eventStart : "";
  let endsOn = isDay(eventEnd) ? eventEnd : startsOn;
  // Cover every game the file lists, so none lands outside the tournament.
  if (gameDays.length > 0) {
    const first = gameDays[0];
    const last = gameDays[gameDays.length - 1];
    if (!startsOn || first < startsOn) startsOn = first;
    if (!endsOn || last > endsOn) endsOn = last;
  }
  if (startsOn && endsOn && endsOn < startsOn) [startsOn, endsOn] = [endsOn, startsOn];

  const main = mainGameVenue(s.games);
  const venueName = (s.venue.name || main?.venue_name || "").trim();

  const courts: string[] = [];
  for (const g of s.games) {
    const court = (g.court ?? "").trim();
    if (court && courts.length < MAX_COURTS && !courts.some((c) => key(c) === key(court))) courts.push(court);
  }

  return {
    name: (s.event?.name ?? "").trim(),
    startsOn,
    endsOn: endsOn || startsOn,
    venueName,
    venueAddress: (s.venue.address || main?.venue_address || "").trim(),
    venueCity: (s.venue.city || main?.venue_city || "").trim(),
    venueState: (s.venue.state || main?.venue_state || "").trim().toUpperCase(),
    venueZip: (s.venue.zip || main?.venue_zip || "").trim(),
    courts,
    arrivalNotes: (s.event_notes ?? "").trim(),
    gamesElsewhere: venueName
      ? s.games.filter((g) => key(g.venue_name) && key(g.venue_name) !== key(venueName)).length
      : 0,
  };
}
