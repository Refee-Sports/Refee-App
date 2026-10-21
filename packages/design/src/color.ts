import { light, type ColorKey } from "./tokens";

/** A token key, or "transparent" for an unfilled control. */
export type Fill = ColorKey | "transparent";

/** The light-theme value of a token ("transparent" passes through). */
export function resolve(key: Fill): string {
  return key === "transparent" ? "transparent" : light[key];
}

type RGBA = [number, number, number, number];

function parse(color: string): RGBA {
  if (color === "transparent") return [0, 0, 0, 0];
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const fn = color.match(/^rgba?\(([^)]+)\)$/i);
  if (fn) {
    const [r, g, b, a = "1"] = fn[1].split(",").map((s) => s.trim());
    return [Number(r), Number(g), Number(b), Number(a)];
  }
  throw new Error(`Unsupported color: ${color}`);
}

/** Paints `top` over an opaque `bottom`. */
function over(top: RGBA, bottom: RGBA): RGBA {
  const a = top[3];
  return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1) as RGBA;
}

function luminance([r, g, b]: RGBA): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * WCAG contrast of text `fg` on fill `bg`. A translucent or transparent fill
 * is first laid over paper, the surface every control sits on.
 */
export function contrast(fg: string, bg: string): number {
  const ground = over(parse(bg), parse(light.paper));
  const text = over(parse(fg), ground);
  const [hi, lo] = [luminance(text), luminance(ground)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}
