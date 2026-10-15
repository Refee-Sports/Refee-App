import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  platform: "ios",
  written: [] as { name: string; text: string }[],
  available: true,
  shareAsync: vi.fn(),
}));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return m.platform;
    },
  },
}));
vi.mock("expo-file-system", () => ({
  Paths: { cache: "cache" },
  File: class {
    uri: string;
    constructor(_dir: string, public name: string) {
      this.uri = `file:///cache/${name}`;
    }
    create() {}
    write(text: string) {
      m.written.push({ name: this.name, text });
    }
  },
}));
vi.mock("expo-sharing", () => ({ isAvailableAsync: async () => m.available, shareAsync: m.shareAsync }));

import { shareCsv } from "./share";

beforeEach(() => {
  m.platform = "ios";
  m.written = [];
  m.available = true;
  m.shareAsync.mockReset();
});

describe("shareCsv", () => {
  it("writes the file and opens the share sheet", async () => {
    await shareCsv("refee-earnings-2026.csv", "a,b\r\n", "Save earnings");
    expect(m.written).toEqual([{ name: "refee-earnings-2026.csv", text: "a,b\r\n" }]);
    expect(m.shareAsync).toHaveBeenCalledWith("file:///cache/refee-earnings-2026.csv", {
      mimeType: "text/csv",
      UTI: "public.comma-separated-values-text",
      dialogTitle: "Save earnings",
    });
  });

  it("says so when the device can't share files", async () => {
    m.available = false;
    await expect(shareCsv("x.csv", "", "Save")).rejects.toThrow("File sharing is not available");
  });

  it("downloads instead when running in a browser", async () => {
    m.platform = "web";
    const anchor = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal("document", { createElement: () => anchor, body: { appendChild: vi.fn() } });
    vi.stubGlobal("URL", { createObjectURL: () => "blob:1", revokeObjectURL: vi.fn() });
    await shareCsv("x.csv", "a", "Save");
    expect(anchor.download).toBe("x.csv");
    expect(anchor.click).toHaveBeenCalled();
    expect(m.shareAsync).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
