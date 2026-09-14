type Venue = {
  name: string;
  /** Full street address in normal case; null when only the city is known. */
  address: string | null;
  lat?: number | null;
  lng?: number | null;
};

function searchQuery(v: Venue): string {
  return encodeURIComponent(v.address ? `${v.name}, ${v.address}` : v.name);
}

function hasPin(v: Venue): v is Venue & { lat: number; lng: number } {
  return v.lat != null && v.lng != null;
}

/** Directions in Apple Maps. Opens the Maps app on iPhone and Mac. */
export function appleMapsUrl(v: Venue): string {
  return hasPin(v)
    ? `https://maps.apple.com/?daddr=${v.lat},${v.lng}&q=${encodeURIComponent(v.name)}`
    : `https://maps.apple.com/?q=${searchQuery(v)}`;
}

/** Directions in Google Maps. Hands off to the Google Maps app on phones. */
export function googleMapsUrl(v: Venue): string {
  return hasPin(v)
    ? `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${searchQuery(v)}`;
}

/** Opens the venue in Google Maps in a new tab (web equivalent of the app's map deep link). */
export function openVenueDirections(venueName: string, venueAddress: string | null) {
  window.open(googleMapsUrl({ name: venueName, address: venueAddress }), "_blank", "noopener,noreferrer");
}
