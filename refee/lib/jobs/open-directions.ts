import { Linking, Platform } from "react-native";

export function openVenueDirections(venueName: string, venueAddress: string | null) {
  const query = encodeURIComponent(
    venueAddress ? `${venueName}, ${venueAddress}` : venueName
  );
  const url =
    Platform.OS === "ios"
      ? `https://maps.apple.com/?q=${query}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`;
  void Linking.openURL(url);
}
