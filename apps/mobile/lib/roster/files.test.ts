import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  store: new Map<string, string>(),
  failStore: false,
  getDocumentAsync: vi.fn(),
}));
vi.mock("expo-document-picker", () => ({ getDocumentAsync: m.getDocumentAsync }));
vi.mock("expo-file-system", () => ({ File: class { constructor(public uri: string) {} async text() { return "from disk"; } } }));
vi.mock("expo-secure-store", () => ({
  setItemAsync: async (k: string, v: string) => {
    if (m.failStore) throw new Error("locked");
    m.store.set(k, v);
  },
  getItemAsync: async (k: string) => {
    if (m.failStore) throw new Error("locked");
    return m.store.get(k) ?? null;
  },
  deleteItemAsync: async (k: string) => void m.store.delete(k),
}));

// The app's wrapper loads the native client; the shared module is what it re-exports.
vi.mock("@/lib/referee/backgroundCheck", () => import("@refee/core/referee/backgroundCheck"));

import { pickEmailCsv, setPendingRosterCode, takePendingRosterCode } from "./files";

beforeEach(() => {
  m.store.clear();
  m.failStore = false;
  m.getDocumentAsync.mockReset();
});

describe("pickEmailCsv", () => {
  it("is null when the picker is cancelled", async () => {
    m.getDocumentAsync.mockResolvedValue({ canceled: true });
    expect(await pickEmailCsv()).toBeNull();
  });

  it("reads the chosen file", async () => {
    m.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ name: "refs.csv", size: 20, uri: "file:///refs.csv" }] });
    expect(await pickEmailCsv()).toEqual({ name: "refs.csv", text: "from disk" });
  });

  it("refuses anything over 1 MB", async () => {
    m.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ name: "big.csv", size: 2_000_000, uri: "x" }] });
    await expect(pickEmailCsv()).rejects.toThrow("over 1 MB");
  });
});

describe("pending roster code", () => {
  it("survives sign-in and is handed over once", async () => {
    await setPendingRosterCode("ABC123");
    expect(await takePendingRosterCode()).toBe("ABC123");
    expect(await takePendingRosterCode()).toBeNull();
  });

  it("never breaks sign-in if secure storage fails", async () => {
    m.failStore = true;
    await expect(setPendingRosterCode("ABC123")).resolves.toBeUndefined();
    expect(await takePendingRosterCode()).toBeNull();
  });
});
