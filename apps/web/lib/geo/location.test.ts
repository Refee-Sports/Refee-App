import { afterEach, describe, expect, it, vi } from "vitest";
import { getCoordsIfAlreadyAllowed, getCurrentCoords } from "./location";

function stubNavigator(opts: {
  permission?: PermissionState;
  position?: { latitude: number; longitude: number };
  errorCode?: number;
}) {
  const getCurrentPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) => {
    if (opts.position) ok({ coords: opts.position } as GeolocationPosition);
    else fail({ code: opts.errorCode ?? 2, PERMISSION_DENIED: 1 } as GeolocationPositionError);
  });
  vi.stubGlobal("navigator", {
    geolocation: { getCurrentPosition },
    permissions: opts.permission ? { query: vi.fn(async () => ({ state: opts.permission })) } : undefined,
  });
  return getCurrentPosition;
}

afterEach(() => vi.unstubAllGlobals());

describe("getCurrentCoords", () => {
  it("returns the browser's position", async () => {
    stubNavigator({ position: { latitude: 30.27, longitude: -97.74 } });
    expect(await getCurrentCoords()).toEqual({ ok: true, coords: { lat: 30.27, lng: -97.74 } });
  });

  it("tells a refusal apart from a failure", async () => {
    stubNavigator({ errorCode: 1 });
    expect(await getCurrentCoords()).toEqual({ ok: false, reason: "denied" });
    stubNavigator({ errorCode: 2 });
    expect(await getCurrentCoords()).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("getCoordsIfAlreadyAllowed", () => {
  it("reads the position only when permission was already granted", async () => {
    stubNavigator({ permission: "granted", position: { latitude: 1, longitude: 2 } });
    expect(await getCoordsIfAlreadyAllowed()).toEqual({ ok: true, coords: { lat: 1, lng: 2 } });
  });

  it("never prompts: anything but granted is a no", async () => {
    const ask = stubNavigator({ permission: "prompt", position: { latitude: 1, longitude: 2 } });
    expect(await getCoordsIfAlreadyAllowed()).toEqual({ ok: false, reason: "denied" });
    expect(ask).not.toHaveBeenCalled();
  });

  it("copes with browsers that can't report permissions", async () => {
    stubNavigator({ position: { latitude: 1, longitude: 2 } });
    expect(await getCoordsIfAlreadyAllowed()).toEqual({ ok: false, reason: "unavailable" });
  });
});
