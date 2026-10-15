import { beforeEach, describe, expect, it, vi } from "vitest";

const loc = vi.hoisted(() => ({
  requestForegroundPermissionsAsync: vi.fn(),
  getForegroundPermissionsAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
  getLastKnownPositionAsync: vi.fn(),
  Accuracy: { Balanced: 3 },
}));
vi.mock("expo-location", () => loc);

import { getCoordsIfAlreadyAllowed, getCurrentCoords } from "./location";

const at = (latitude: number, longitude: number) => ({ coords: { latitude, longitude } });

beforeEach(() => {
  Object.values(loc).forEach((f) => typeof f === "function" && (f as ReturnType<typeof vi.fn>).mockReset());
});

describe("getCurrentCoords (Near me)", () => {
  it("asks, then returns the device's position", async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    loc.getCurrentPositionAsync.mockResolvedValue(at(30.27, -97.74));
    expect(await getCurrentCoords()).toEqual({ ok: true, coords: { lat: 30.27, lng: -97.74 } });
  });

  it("reports a refusal", async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: "denied" });
    expect(await getCurrentCoords()).toEqual({ ok: false, reason: "denied" });
  });

  it("reports a failure to locate", async () => {
    loc.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    loc.getCurrentPositionAsync.mockRejectedValue(new Error("no fix"));
    expect(await getCurrentCoords()).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("getCoordsIfAlreadyAllowed (no home pin)", () => {
  it("never asks for permission", async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue({ status: "undetermined" });
    expect(await getCoordsIfAlreadyAllowed()).toEqual({ ok: false, reason: "denied" });
    expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("uses a recent known position when there is one", async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    loc.getLastKnownPositionAsync.mockResolvedValue(at(1, 2));
    expect(await getCoordsIfAlreadyAllowed()).toEqual({ ok: true, coords: { lat: 1, lng: 2 } });
    expect(loc.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("asks the GPS when nothing recent is known", async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    loc.getLastKnownPositionAsync.mockResolvedValue(null);
    loc.getCurrentPositionAsync.mockResolvedValue(at(3, 4));
    expect(await getCoordsIfAlreadyAllowed()).toEqual({ ok: true, coords: { lat: 3, lng: 4 } });
  });
});
