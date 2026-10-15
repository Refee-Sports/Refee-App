import { describe, expect, it } from "vitest";
import { cleanHomeZip } from "@refee/core/profile/queries";

describe("cleanHomeZip", () => {
  it("keeps a 5-digit ZIP, trimmed", () => {
    expect(cleanHomeZip(" 77007 ")).toEqual({ zip: "77007" });
  });

  it("treats blank as no ZIP, since it's optional", () => {
    expect(cleanHomeZip("")).toEqual({ zip: null });
    expect(cleanHomeZip(null)).toEqual({ zip: null });
    expect(cleanHomeZip(undefined)).toEqual({ zip: null });
  });

  it("refuses anything else with a plain message", () => {
    expect(cleanHomeZip("7700")).toEqual({ error: "Enter a 5-digit ZIP code, or leave it blank." });
    expect(cleanHomeZip("77007-1234")).toEqual({ error: "Enter a 5-digit ZIP code, or leave it blank." });
  });
});
