import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import path from "node:path";
import { readFileSync } from "node:fs";
import { tailwindTheme } from "../src/tailwind";
import { light } from "../src/tokens";
import webConfig from "../../../apps/web/tailwind.config";

const require = createRequire(import.meta.url);
const mobileConfig = require(path.resolve(__dirname, "../../../apps/mobile/tailwind.config.js"));

describe("tailwindTheme", () => {
  const theme = tailwindTheme();

  it("keeps the class names the apps already use", () => {
    expect(theme.colors.paper).toBe(light.paper);
    expect(theme.colors["paper-2"]).toBe(light.paper2);
    expect(theme.colors.ink.DEFAULT).toBe(light.ink);
    expect(theme.colors.ink[60]).toBe(light.ink60);
    expect(theme.colors.signal.tint).toBe(light.signalTint);
    expect(theme.colors.whistle.ink).toBe(light.whistleInk);
    expect(theme.colors["court-ink"].DEFAULT).toBe(light.courtInk);
    expect(theme.colors["foul-ink-press"]).toBe(light.foulInkPress);
    expect(theme.colors["dark-paper"]).toBe("#05080D");
  });

  it("carries the Rounded scale and the hard shadow/rings", () => {
    expect(theme.borderRadius).toEqual({ sm: "10px", md: "12px", lg: "18px", full: "9999px" });
    expect(theme.boxShadow.hard).toBe("4px 4px 0 #08111C");
    expect(theme.boxShadow["ring-focus"]).toBe("0 0 0 2px #E5E1D6, 0 0 0 4px #1F4FCC");
  });
});

describe("both apps read their tokens from @refee/design", () => {
  const theme = tailwindTheme();

  it("web", () => {
    expect(webConfig.theme?.extend?.colors).toEqual(theme.colors);
    expect(webConfig.theme?.extend?.borderRadius).toEqual(theme.borderRadius);
    expect(webConfig.theme?.extend?.boxShadow).toEqual(theme.boxShadow);
    expect(webConfig.future).toEqual({ hoverOnlyWhenSupported: true });
  });

  it("mobile", () => {
    expect(mobileConfig.theme.extend.colors).toEqual(theme.colors);
    expect(mobileConfig.theme.extend.borderRadius).toEqual(theme.borderRadius);
    expect(mobileConfig.theme.extend.boxShadow).toEqual(theme.boxShadow);
  });

  it("web CSS variables agree with the tokens", () => {
    const css = readFileSync(path.resolve(__dirname, "../../../apps/web/app/globals.css"), "utf8");
    const root = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));
    const vars = [...root.matchAll(/--([\w-]+):\s*([^;]+);/g)];
    const known = vars.filter(([, name]) => name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()) in light);
    expect(known.length).toBeGreaterThan(10);
    for (const [, name, value] of known) {
      const key = name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase()) as keyof typeof light;
      expect(value.toLowerCase().replace(/\s+/g, ""), `--${name}`).toBe(light[key].toLowerCase().replace(/\s+/g, ""));
    }
  });
});
