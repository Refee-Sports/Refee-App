import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadTextFile } from "./download";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("downloadTextFile", () => {
  it("downloads the text under the given name, then releases the link", async () => {
    vi.useFakeTimers();
    const anchor = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    const blobs: Blob[] = [];
    const appendChild = vi.fn();
    vi.stubGlobal("document", { createElement: vi.fn(() => anchor), body: { appendChild } });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((b: Blob) => (blobs.push(b), "blob:1")),
      revokeObjectURL: vi.fn(),
    });

    downloadTextFile("refee-earnings-2026.csv", "a,b\r\n");

    expect(anchor).toMatchObject({ href: "blob:1", download: "refee-earnings-2026.csv" });
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalled();
    expect(anchor.remove).toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:1");
    expect(await blobs[0].text()).toBe("a,b\r\n");
    expect(blobs[0].type).toBe("text/csv;charset=utf-8");
  });
});
