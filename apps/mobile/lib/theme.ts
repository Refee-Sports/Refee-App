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
    whistleInk: "#7A5700", // warning text on paper (5.04:1)
    courtInk: "#00733F", // green text (4.57:1 on paper)
    foulInk: "#B3202C", // red text + destructive fills (5.09:1 on paper)
    inkPress: "#2B3440", // pressed primary button
    hiVisPress: "#B1D61F", // pressed hi-vis button
    chalkPress: "#E9E5DA", // pressed option rows, big choice, cards
    signalTintPress: "rgba(31, 79, 204, 0.18)", // pressed selected choice
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
    courtInk: "#00D982", // reuses court-dark (10.74:1 on dark paper)
    foulInk: "#FF4757", // reuses foul-dark (6.01:1 on dark paper)
    inkPress: "#2B3440",
    hiVisPress: "#B1D61F",
    chalkPress: "#E9E5DA",
    signalTintPress: "rgba(31, 79, 204, 0.18)",
  },
} as const;

export type Mode = "light" | "dark";

export const tokens = (mode: Mode) => colors[mode];
