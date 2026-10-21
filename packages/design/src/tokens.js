/**
 * Refee design tokens — the one place in code that defines a color, radius
 * or shadow. Mirrors docs/design-system/tokens.json (tests fail on drift).
 *
 * Plain CommonJS so both Tailwind configs can require() it; types live in
 * tokens.d.ts. Keys are camelCase versions of the spec's names
 * ("ink-inv-80" → inkInv80); `kebab`/`camelize` convert between them.
 */

/** Light theme: every color token. */
const light = {
  // Surfaces
  paper: "#E5E1D6",
  paper2: "#D8D3C5",
  paper3: "#C9C3B2",
  chalk: "#F5F2EA",

  // Ink (text) and its translucent steps
  ink: "#08111C",
  ink80: "rgba(8, 17, 28, 0.78)",
  ink60: "rgba(8, 17, 28, 0.56)",
  ink40: "rgba(8, 17, 28, 0.36)",
  ink20: "rgba(8, 17, 28, 0.18)",
  ink10: "rgba(8, 17, 28, 0.08)",

  // Ink on dark surfaces
  inkInv: "#FFFFFF",
  inkInv80: "rgba(255, 255, 255, 0.78)",
  inkInv60: "rgba(255, 255, 255, 0.56)",
  inkInv40: "rgba(255, 255, 255, 0.36)",
  inkInv20: "rgba(255, 255, 255, 0.18)",
  inkInv10: "rgba(255, 255, 255, 0.08)",

  // Hairlines (web)
  line: "rgba(8, 12, 18, 0.1)",
  line2: "rgba(8, 12, 18, 0.18)",
  line3: "rgba(8, 12, 18, 0.32)",

  // Brand
  signal: "#1F4FCC",
  signalDeep: "#0B2880",
  signalTint: "rgba(31, 79, 204, 0.08)",
  hiVis: "#C9F031",

  // State: bright token for fills/dots/borders, -ink token for text
  court: "#00A85C",
  courtInk: "#00733F",
  whistle: "#F5B90B",
  whistleInk: "#7A5700",
  foul: "#E63946",
  foulInk: "#B3202C",

  // Pressed fills
  inkPress: "#2B3440",
  hiVisPress: "#B1D61F",
  foulInkPress: "#961A24",
  chalkPress: "#E9E5DA",
  signalTintPress: "rgba(31, 79, 204, 0.18)",
};

/** Dark theme: only the tokens whose value changes; the rest inherit light. */
const dark = {
  paper: "#05080D",
  paper2: "#0A0F18",
  chalk: "#131B28",
  signal: "#4F8CFF",
  hiVis: "#D4FF3A",
  court: "#00D982",
  courtInk: "#00D982",
  whistle: "#FFD24A",
  foul: "#FF4757",
  foulInk: "#FF4757",
};

/** The Rounded scale, in px. ZebraRule stays square (none). */
const radius = { none: 0, sm: 10, md: 12, lg: 18, full: 9999 };

const shadow = {
  hard: "4px 4px 0 #08111C",
  hardSignal: "4px 4px 0 #1F4FCC",
  hardHivis: "4px 4px 0 #C9F031",
  ringHover: "0 0 0 3px #E5E1D6, 0 0 0 5px #08111C",
  ringHoverSelected: "0 0 0 3px #E5E1D6, 0 0 0 5px #1F4FCC",
  ringFocus: "0 0 0 2px #E5E1D6, 0 0 0 4px #1F4FCC",
  glowFieldFocus: "0 0 0 3px rgba(31, 79, 204, 0.25)",
};

const letterSpacing = {
  tightest: "-0.04em",
  tighter: "-0.03em",
  tight: "-0.02em",
  wide: "0.04em",
  wider: "0.12em",
  widest: "0.18em",
};

/** Pressed states snap in on touch-down and ease back over this long. */
const motion = { pressOutMs: 120 };

/** "ink-inv-80" → "inkInv80" */
const camelize = (name) => name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
/** "inkInv80" → "ink-inv-80" */
const kebab = (key) =>
  key.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/([a-zA-Z])(\d)/g, "$1-$2").toLowerCase();

module.exports = { light, dark, radius, shadow, letterSpacing, motion, camelize, kebab };
