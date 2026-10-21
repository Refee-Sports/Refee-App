import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { camelize, dark, kebab, light, radius, shadow } from "../src/tokens";

// The design system (docs/design-system/tokens.json) is the spec; this
// package is its one home in code. Every value must match, and nothing may
// exist here that the spec doesn't name.
const spec = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../docs/design-system/tokens.json"), "utf8"),
) as {
  color: { tokens: { name: string; value: string | { light: string; dark?: string } }[] };
  radius: { tokens: { name: string; value: string }[] };
  shadow: { tokens: { name: string; value: string }[] };
};

const norm = (v: string) => v.toLowerCase().replace(/\s+/g, "");

describe("names", () => {
  it("round-trips between the spec's kebab names and code's camel keys", () => {
    expect(camelize("ink-inv-80")).toBe("inkInv80");
    expect(camelize("paper-2")).toBe("paper2");
    expect(camelize("signal-tint-press")).toBe("signalTintPress");
    expect(kebab("inkInv80")).toBe("ink-inv-80");
    expect(kebab("paper2")).toBe("paper-2");
    expect(kebab("hiVisPress")).toBe("hi-vis-press");
  });
});

describe("colors match the design system", () => {
  for (const t of spec.color.tokens) {
    const key = camelize(t.name) as keyof typeof light;
    const lightValue = typeof t.value === "string" ? t.value : t.value.light;
    const darkValue = typeof t.value === "string" ? undefined : t.value.dark;

    it(`${t.name} (light)`, () => {
      expect(light[key], `${t.name} is missing from @refee/design`).toBeDefined();
      expect(norm(light[key])).toBe(norm(lightValue));
    });

    if (darkValue) {
      it(`${t.name} (dark)`, () => {
        expect(norm((dark as Record<string, string>)[key] ?? "")).toBe(norm(darkValue));
      });
    }
  }

  it("invents no colors the design system doesn't name", () => {
    const named = new Set(spec.color.tokens.map((t) => camelize(t.name)));
    expect(Object.keys(light).filter((k) => !named.has(k))).toEqual([]);
    expect(Object.keys(dark).filter((k) => !named.has(k))).toEqual([]);
  });
});

describe("radius and shadow match the design system", () => {
  for (const t of spec.radius.tokens) {
    it(t.name, () => {
      const key = t.name.replace(/^radius-/, "") as keyof typeof radius;
      expect(`${radius[key]}px`).toBe(t.value);
    });
  }
  for (const t of spec.shadow.tokens) {
    it(t.name, () => {
      const key = camelize(t.name) as keyof typeof shadow;
      expect(norm(shadow[key] ?? "")).toBe(norm(t.value));
    });
  }
});
