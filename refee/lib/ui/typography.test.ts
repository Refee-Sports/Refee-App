import { describe, it, expect } from "vitest";
import { MAX_FONT_SCALE, withFontCap } from "./typography";

describe("MAX_FONT_SCALE", () => {
  it("keeps text scalable but bounded (1x–2x range)", () => {
    expect(MAX_FONT_SCALE).toBeGreaterThan(1);
    expect(MAX_FONT_SCALE).toBeLessThanOrEqual(2);
  });
});

describe("withFontCap", () => {
  it("injects the default cap when none is set", () => {
    expect(withFontCap({})).toEqual({ maxFontSizeMultiplier: MAX_FONT_SCALE });
  });

  it("lets an explicit maxFontSizeMultiplier override the default cap", () => {
    expect(withFontCap({ maxFontSizeMultiplier: 1 })).toEqual({ maxFontSizeMultiplier: 1 });
  });

  it("preserves other props", () => {
    const out = withFontCap({ allowFontScaling: false, numberOfLines: 2 } as any);
    expect(out).toMatchObject({
      allowFontScaling: false,
      numberOfLines: 2,
      maxFontSizeMultiplier: MAX_FONT_SCALE,
    });
  });

  it("accepts a custom cap", () => {
    expect(withFontCap({}, 1.2)).toEqual({ maxFontSizeMultiplier: 1.2 });
  });
});
