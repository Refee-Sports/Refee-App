import { afterEach, describe, expect, it, vi } from "vitest";
import { readEmailFile, setPendingRosterCode, siteOrigin, takePendingRosterCode } from "./files";

afterEach(() => vi.unstubAllGlobals());

function stubWindow(storage: Partial<Storage>, origin = "https://refee.app") {
  vi.stubGlobal("window", { localStorage: storage, location: { origin } });
}

describe("readEmailFile", () => {
  it("reads the file's text", async () => {
    const file = { size: 20, text: async () => "a@x.com\nb@x.com" } as unknown as File;
    expect(await readEmailFile(file)).toBe("a@x.com\nb@x.com");
  });

  it("refuses anything over 1 MB", async () => {
    const file = { size: 2 * 1024 * 1024, text: async () => "" } as unknown as File;
    await expect(readEmailFile(file)).rejects.toThrow("over 1 MB");
  });
});

describe("pending roster code", () => {
  it("is kept through sign-in and handed over once", () => {
    const data = new Map<string, string>();
    stubWindow({
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    });
    setPendingRosterCode("ABC123");
    expect(takePendingRosterCode()).toBe("ABC123");
    expect(takePendingRosterCode()).toBeNull();
  });

  it("doesn't break in private mode", () => {
    stubWindow({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => setPendingRosterCode("ABC123")).not.toThrow();
    expect(takePendingRosterCode()).toBeNull();
  });
});

describe("siteOrigin", () => {
  it("uses the page's own origin for QR links", () => {
    stubWindow({}, "http://localhost:3000");
    expect(siteOrigin()).toBe("http://localhost:3000");
  });

  it("falls back to refee.app on the server", () => {
    expect(siteOrigin()).toBe("https://refee.app");
  });
});
