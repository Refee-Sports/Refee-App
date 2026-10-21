import { describe, expect, it } from "vitest";
import { contrast, resolve } from "../src/color";
import { badgeVariants, buttonVariants, choice, field, fieldFocusGlow, toggle } from "../src/variants";
import { shadow } from "../src/tokens";

// Readable text is 4.5:1 (WCAG AA). Measured against what's actually behind
// it: a transparent or tinted fill is composited over paper.
const AA = 4.5;
// ink-60 mono labels at 9px+ bold measure 4.0:1; the design system accepts
// that for muted captions only (tokens.json, ink-60).
const MUTED_CAPTION = 3.9;

describe("color helpers", () => {
  it("measures contrast like WCAG", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrast("#08111C", "#E5E1D6")).toBeGreaterThan(14);
  });
  it("resolves token keys and composites translucent fills over paper", () => {
    expect(resolve("ink")).toBe("#08111C");
    expect(resolve("transparent")).toBe("transparent");
    expect(contrast(resolve("ink60"), "transparent")).toBeGreaterThan(3.9);
  });
});

describe("buttons", () => {
  for (const [name, v] of Object.entries(buttonVariants)) {
    it(`${name}: label reads at rest and pressed`, () => {
      expect(contrast(resolve(v.fg), resolve(v.bg))).toBeGreaterThanOrEqual(AA);
      expect(contrast(resolve(v.fgPressed), resolve(v.bgPressed))).toBeGreaterThanOrEqual(AA);
    });
  }

  it("darkens the label while pressed where the tint would drop it under AA", () => {
    expect(buttonVariants.danger.fgPressed).toBe("foulInkPress");
    expect(choice.pressedSelectedFg).toBe("signalDeep");
  });

  it("keeps red for hard-to-undo actions and green for Done", () => {
    expect(buttonVariants.danger).toMatchObject({ fg: "foulInk", border: "foulInk", bg: "transparent" });
    expect(buttonVariants["danger-fill"]).toMatchObject({ bg: "foulInk", fg: "inkInv" });
    expect(buttonVariants.court).toMatchObject({ bg: "court", fg: "ink" });
    expect(buttonVariants.secondary).toMatchObject({ bg: "transparent", fg: "ink", border: "ink" });
  });
});

describe("badges", () => {
  for (const [name, v] of Object.entries(badgeVariants)) {
    it(`${name}: label reads`, () => {
      expect(contrast(resolve(v.fg), resolve(v.bg))).toBeGreaterThanOrEqual(AA);
    });
  }
  it("status text uses the -ink tokens, borders the bright ones", () => {
    expect(badgeVariants.confirmed).toMatchObject({ fg: "courtInk", border: "court" });
    expect(badgeVariants.foul).toMatchObject({ fg: "foulInk", border: "foul" });
    expect(badgeVariants.warn).toMatchObject({ fg: "whistleInk", border: "whistle" });
  });
});

describe("choices and fields", () => {
  it("rest and selected labels read", () => {
    expect(contrast(resolve(choice.rest.fg), resolve(choice.rest.bg))).toBeGreaterThanOrEqual(AA);
    expect(contrast(resolve(choice.selected.fg), resolve(choice.selected.bg))).toBeGreaterThanOrEqual(AA);
    expect(contrast(resolve(choice.pressedSelectedFg), resolve(choice.pressedSelected))).toBeGreaterThanOrEqual(AA);
    expect(contrast(resolve(choice.chip.rest.fg), resolve(choice.chip.rest.bg))).toBeGreaterThanOrEqual(MUTED_CAPTION);
  });

  it("presses by the documented amounts", () => {
    expect(choice.scale).toEqual({ chip: 0.96, bigChoice: 0.96, optionRow: 0.98, card: 0.98 });
    expect(toggle).toMatchObject({ width: 50, height: 28, thumb: 18, thumbHeld: 24, inset: 4 });
  });

  it("fields: placeholder and errors read on chalk", () => {
    expect(contrast(resolve(field.placeholder), resolve(field.bg))).toBeGreaterThanOrEqual(MUTED_CAPTION);
    expect(contrast(resolve(field.borderError), resolve(field.bg))).toBeGreaterThanOrEqual(AA);
    expect(field.borderFocus).toBe("signal");
    expect(shadow.glowFieldFocus).toBe(`0 0 0 ${fieldFocusGlow.width}px ${fieldFocusGlow.color}`);
  });
});
