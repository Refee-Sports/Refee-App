import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));

import { fetchMinAppVersion, isVersionBelow, parseVersion } from "./version";

describe("parseVersion", () => {
  it("reads major.minor.patch", () => {
    expect(parseVersion("1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("v10.0.4")).toEqual([10, 0, 4]);
    expect(parseVersion("1.0.0-beta.1")).toEqual([1, 0, 0]);
  });

  it("rejects things that aren't versions", () => {
    expect(parseVersion("latest")).toBeNull();
    expect(parseVersion("1.2")).toBeNull();
    expect(parseVersion("")).toBeNull();
    expect(parseVersion(null)).toBeNull();
    expect(parseVersion(undefined)).toBeNull();
  });
});

describe("isVersionBelow — who has to update", () => {
  it("is true for an older version at any position", () => {
    expect(isVersionBelow("0.9.9", "1.0.0")).toBe(true);
    expect(isVersionBelow("1.0.9", "1.1.0")).toBe(true);
    expect(isVersionBelow("1.1.0", "1.1.1")).toBe(true);
  });

  it("compares numerically, not as text", () => {
    expect(isVersionBelow("1.9.0", "1.10.0")).toBe(true);
    expect(isVersionBelow("1.10.0", "1.9.0")).toBe(false);
  });

  it("is false for the same or a newer version", () => {
    expect(isVersionBelow("1.0.0", "1.0.0")).toBe(false);
    expect(isVersionBelow("2.0.0", "1.9.9")).toBe(false);
  });

  it("fails open when either side isn't a version", () => {
    expect(isVersionBelow("1.0.0", null)).toBe(false);
    expect(isVersionBelow("1.0.0", "garbage")).toBe(false);
    expect(isVersionBelow(undefined, "1.0.0")).toBe(false);
    expect(isVersionBelow("dev", "1.0.0")).toBe(false);
  });
});

describe("fetchMinAppVersion", () => {
  beforeEach(() => mocks.rpc.mockReset());

  it("asks the backend for the platform's minimum", async () => {
    mocks.rpc.mockResolvedValue({ data: "1.2.0", error: null });
    expect(await fetchMinAppVersion("ios")).toBe("1.2.0");
    expect(mocks.rpc).toHaveBeenCalledWith("get_min_app_version", { p_platform: "ios" });
  });

  it("returns null on an error or when the network throws, so nobody is locked out", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await fetchMinAppVersion("android")).toBeNull();
    mocks.rpc.mockRejectedValueOnce(new Error("offline"));
    expect(await fetchMinAppVersion("android")).toBeNull();
  });
});
