import { supabase } from "../client";

export type Coords = { lat: number; lng: number };

/** A geocoded venue: its pin and, when known, its IANA time zone. */
export type GeocodedVenue = Coords & { timezone: string | null };

/** Geocode a free-text address via the edge function. Returns null if not found. */
export async function geocodeAddress(address: string): Promise<GeocodedVenue | null> {
  const { data, error } = await supabase.functions.invoke("geocode", {
    body: { address },
  });
  if (error || !data?.found) return null;
  return { lat: data.lat, lng: data.lng, timezone: data.timezone ?? null };
}

/** Great-circle distance in miles between two points. */
export function distanceMiles(a: Coords, b: Coords): number {
  const R = 3958.8; // Earth radius, miles
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

const ZIP = /^[0-9]{5}$/;

/**
 * What to look a referee's home up by, most precise first. A city's centre can
 * be 15–25 miles from where someone lives in a big city, so the ZIP goes first.
 */
export function homeQueries(home: { city: string; state: string; zip?: string | null }): string[] {
  const zip = home.zip?.trim() ?? "";
  const city = `${home.city.trim()}, ${home.state.trim()}, USA`;
  return ZIP.test(zip) ? [`${zip}, ${home.state.trim()}, USA`, city] : [city];
}

/** What to look a venue up by: the street address, then its ZIP, then its city. */
export function venueQueries(v: {
  venueAddress?: string | null;
  venueZip?: string | null;
  venueCity: string;
  venueState: string;
}): string[] {
  const street = v.venueAddress?.trim();
  const zip = v.venueZip?.trim() ?? "";
  const queries: string[] = [];
  if (street) queries.push(`${street}, ${v.venueCity}, ${v.venueState}${zip ? ` ${zip}` : ""}, USA`);
  if (ZIP.test(zip)) queries.push(`${zip}, ${v.venueState}, USA`);
  queries.push(`${v.venueCity}, ${v.venueState}, USA`);
  return queries;
}

/** The first of these queries the geocoder can place, or null. */
export async function geocodeFirst(
  queries: string[],
  geocode: (q: string) => Promise<GeocodedVenue | null> = geocodeAddress
): Promise<GeocodedVenue | null> {
  for (const q of queries) {
    const found = await geocode(q);
    if (found) return found;
  }
  return null;
}
