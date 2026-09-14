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
