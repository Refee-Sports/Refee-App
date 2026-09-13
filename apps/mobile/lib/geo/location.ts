import * as Location from "expo-location";
import type { Coords } from "@/lib/geo/geocode";

export type LocationResult =
  | { ok: true; coords: Coords }
  | { ok: false; reason: "denied" | "unavailable" };

/**
 * Requests foreground location permission and returns the device's current
 * coordinates. Used for the "near me" feed mode; never required — the feed
 * falls back to the ref's home city when this is denied or unavailable.
 */
export async function getCurrentCoords(): Promise<LocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return { ok: false, reason: "denied" };

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { ok: true, coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
