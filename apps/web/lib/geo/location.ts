import type { Coords } from "@/lib/geo/geocode";

export type LocationResult =
  | { ok: true; coords: Coords }
  | { ok: false; reason: "denied" | "unavailable" };

/**
 * Browser Geolocation equivalent of the app's expo-location helper. Used for
 * the "near me" feed mode; never required — the feed falls back to the ref's
 * home city when this is denied or unavailable.
 */
export async function getCurrentCoords(): Promise<LocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ok: false, reason: "unavailable" };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        }),
      (err) =>
        resolve({
          ok: false,
          reason: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable",
        }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    );
  });
}

/**
 * The browser's location only if the person already allowed it, never
 * prompting. Used when a referee has no home pin: rather than shrinking their
 * feed to their city, measure from where they are.
 */
export async function getCoordsIfAlreadyAllowed(): Promise<LocationResult> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions) return { ok: false, reason: "unavailable" };
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    if (status.state !== "granted") return { ok: false, reason: "denied" };
    return getCurrentCoords();
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
