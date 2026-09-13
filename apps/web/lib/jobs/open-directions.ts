/** Opens the venue in Google Maps in a new tab (web equivalent of the app's map deep link). */
export function openVenueDirections(venueName: string, venueAddress: string | null) {
  const query = encodeURIComponent(
    venueAddress ? `${venueName}, ${venueAddress}` : venueName
  );
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${query}`,
    "_blank",
    "noopener,noreferrer"
  );
}
