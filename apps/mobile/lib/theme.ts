/**
 * Refee design tokens — single source of truth.
 * Tailwind reads from tailwind.config.js.
 * For things Tailwind can't reach (status bar, native bg, SVG) use these.
 */

export const colors = {
  // Light mode
  light: {
    paper: "#E5E1D6",
    paper2: "#D8D3C5",
    chalk: "#F5F2EA",
    ink: "#08111C",
    signal: "#1F4FCC",
    hiVis: "#C9F031",
    court: "#00A85C",
    whistle: "#F5B90B",
    foul: "#E63946",
  },
  // Dark mode
  dark: {
    paper: "#05080D",
    paper2: "#0A0F18",
    chalk: "#131B28",
    ink: "#FFFFFF",
    signal: "#4F8CFF",
    hiVis: "#D4FF3A",
    court: "#00D982",
    whistle: "#FFD24A",
    foul: "#FF4757",
  },
} as const;

export type Mode = "light" | "dark";

export const tokens = (mode: Mode) => colors[mode];
