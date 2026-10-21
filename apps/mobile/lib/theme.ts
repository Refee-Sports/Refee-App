/**
 * Refee design tokens for things Tailwind can't reach (status bar, native
 * props, SVG). The values live in @refee/design; this keeps the light/dark
 * shape mobile code expects.
 */
import { dark, light } from "@refee/design";

export const colors = {
  light,
  dark: { ...light, ...dark },
} as const;

export type Mode = "light" | "dark";

export const tokens = (mode: Mode) => colors[mode];
