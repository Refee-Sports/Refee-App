// Geocodes a free-text address to { lat, lng }.
// Provider-swappable: defaults to Nominatim (OpenStreetMap) — free, no key,
// fine for dev + low volume. For production set GEOCODER=google and
// GOOGLE_MAPS_API_KEY (higher rate limits, commercial terms).
import { getCaller, json, handleOptions } from "../_shared/util.ts";

async function geocodeNominatim(q: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      // Nominatim usage policy requires a descriptive User-Agent.
      "User-Agent": "RefeeApp/1.0 (support@refee.app)",
      "Accept-Language": "en",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function geocodeGoogle(q: string): Promise<{ lat: number; lng: number } | null> {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const loc = data?.results?.[0]?.geometry?.location;
  if (!loc) return null;
  return { lat: loc.lat, lng: loc.lng };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    // Any signed-in user may geocode (rate-limited by provider).
    const user = await getCaller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { address } = await req.json();
    if (!address || typeof address !== "string") {
      return json({ error: "address required" }, 400);
    }

    const provider = Deno.env.get("GEOCODER") ?? "nominatim";
    const coords =
      provider === "google" ? await geocodeGoogle(address) : await geocodeNominatim(address);

    if (!coords) return json({ lat: null, lng: null, found: false });
    return json({ ...coords, found: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
