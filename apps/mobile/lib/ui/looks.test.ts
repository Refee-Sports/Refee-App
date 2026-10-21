import { describe, expect, it } from "vitest";
import { palette } from "@refee/design";
import { badgeLook, buttonLook, chipLook, choiceLook, fieldLook, toggleLook } from "./looks";

// The mobile components render from these, so the design system's looks are
// proven here rather than in a renderer.

describe("buttonLook", () => {
  it("resolves the shared variant to colors", () => {
    expect(buttonLook("primary", false)).toEqual({ bg: palette.ink, border: palette.ink, fg: palette.paper });
    expect(buttonLook("primary", true).bg).toBe(palette.inkPress);
    expect(buttonLook("secondary", false).bg).toBe("transparent");
    expect(buttonLook("secondary", true).bg).toBe(palette.ink10);
    expect(buttonLook("danger", true)).toMatchObject({ bg: palette.ink10, fg: palette.foulInkPress });
    expect(buttonLook("danger-fill", false)).toEqual({ bg: palette.foulInk, border: palette.foulInk, fg: palette.inkInv });
  });
});

describe("badgeLook", () => {
  it("uses the -ink token for status text", () => {
    expect(badgeLook("confirmed")).toMatchObject({ fg: palette.courtInk, border: palette.court, dot: palette.court });
    expect(badgeLook("warn").fg).toBe(palette.whistleInk);
  });
});

describe("choiceLook (OptionRow, BigChoice, cards)", () => {
  it("rest, dim, selected", () => {
    expect(choiceLook({ selected: false, pressed: false })).toEqual({ bg: palette.chalk, border: palette.ink, fg: palette.ink });
    expect(choiceLook({ selected: false, pressed: false, dim: true }).border).toBe(palette.ink20);
    expect(choiceLook({ selected: true, pressed: false })).toEqual({
      bg: palette.signalTint,
      border: palette.signal,
      fg: palette.signal,
    });
  });
  it("tints when pressed", () => {
    expect(choiceLook({ selected: false, pressed: true }).bg).toBe(palette.chalkPress);
    expect(choiceLook({ selected: true, pressed: true })).toMatchObject({ bg: palette.signalTintPress, fg: palette.signalDeep });
  });
});

describe("chipLook", () => {
  it("is the light outline, ink-10 when pressed, signal when selected", () => {
    expect(chipLook({ selected: false, pressed: false })).toEqual({ bg: "transparent", border: palette.ink20, fg: palette.ink60 });
    expect(chipLook({ selected: false, pressed: true })).toEqual({ bg: palette.ink10, border: palette.ink40, fg: palette.ink80 });
    expect(chipLook({ selected: true, pressed: true })).toEqual({
      bg: palette.signalTintPress,
      border: palette.signal,
      fg: palette.signalDeep,
    });
  });
});

describe("toggleLook", () => {
  it("rests 18px at the 4px inset on its side", () => {
    expect(toggleLook({ checked: false, held: false })).toMatchObject({ thumbLeft: 4, thumbWidth: 18, track: palette.ink10, thumb: palette.paper });
    expect(toggleLook({ checked: true, held: false })).toMatchObject({ thumbLeft: 26, thumbWidth: 18, track: palette.ink, thumb: palette.hiVis });
  });
  it("stretches toward the middle while held", () => {
    expect(toggleLook({ checked: false, held: true })).toMatchObject({ thumbLeft: 4, thumbWidth: 24 });
    expect(toggleLook({ checked: true, held: true })).toMatchObject({ thumbLeft: 20, thumbWidth: 24 });
  });
});

describe("fieldLook", () => {
  it("signal border with a glow on focus; foul-ink on error", () => {
    expect(fieldLook({ focused: false, error: false })).toMatchObject({ border: palette.ink, glow: false });
    expect(fieldLook({ focused: true, error: false })).toMatchObject({ border: palette.signal, glow: true });
    expect(fieldLook({ focused: false, error: true })).toMatchObject({ border: palette.foulInk, glow: false });
    expect(fieldLook({ focused: true, error: true }).border).toBe(palette.signal);
    expect(fieldLook({ focused: false, error: false }).placeholder).toBe(palette.ink60);
  });
});
