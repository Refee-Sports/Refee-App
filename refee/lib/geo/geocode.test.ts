import { describe, it, expect, vi } from "vitest";

// geocode.ts imports the supabase client (which pulls in React Native polyfills).
// distanceMiles is pure, so stub the client to keep the import Node-friendly.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { distanceMiles, type Coords } from "./geocode";

const NYC: Coords = { lat: 40.7128, lng: -74.006 };
const LA: Coords = { lat: 34.0522, lng: -118.2437 };
const CHI: Coords = { lat: 41.8781, lng: -87.6298 };

describe("distanceMiles (great-circle)", () => {
  it("is zero for identical points", () => {
    expect(distanceMiles(NYC, NYC)).toBe(0);
  });

  it("is symmetric", () => {
    expect(distanceMiles(NYC, LA)).toBeCloseTo(distanceMiles(LA, NYC), 6);
  });

  it("matches known city distances within ~1%", () => {
    // NYC <-> LA ≈ 2445 mi; NYC <-> Chicago ≈ 711 mi.
    expect(distanceMiles(NYC, LA)).toBeGreaterThan(2420);
    expect(distanceMiles(NYC, LA)).toBeLessThan(2470);
    expect(distanceMiles(NYC, CHI)).toBeGreaterThan(700);
    expect(distanceMiles(NYC, CHI)).toBeLessThan(725);
  });

  it("approximates ~69 miles per degree of latitude", () => {
    const a: Coords = { lat: 40, lng: -75 };
    const b: Coords = { lat: 41, lng: -75 };
    expect(distanceMiles(a, b)).toBeGreaterThan(68);
    expect(distanceMiles(a, b)).toBeLessThan(70);
  });

  it("handles antimeridian-spanning longitudes as a short hop", () => {
    const a: Coords = { lat: 0, lng: 179.9 };
    const b: Coords = { lat: 0, lng: -179.9 };
    // 0.2 degrees of longitude at the equator ≈ 13.8 mi, not half the globe.
    expect(distanceMiles(a, b)).toBeLessThan(20);
  });
});
