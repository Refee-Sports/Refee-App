/**
 * The token set in Tailwind's theme.extend shape, for both apps' configs
 * (NativeWind on mobile reads the same). Class names are the ones the apps
 * already use: bg-paper-2, text-ink-60, text-court-ink, bg-signal-tint…
 */
const { light, dark, radius, shadow, letterSpacing, kebab } = require("./tokens");

function tailwindTheme() {
  const L = light;
  return {
    colors: {
      // Surfaces
      paper: L.paper,
      "paper-2": L.paper2,
      "paper-3": L.paper3,
      chalk: L.chalk,
      "dark-paper": dark.paper,
      "dark-paper-2": dark.paper2,
      "dark-chalk": dark.chalk,
      line: { DEFAULT: L.line, 2: L.line2, 3: L.line3 },

      // Brand
      signal: { DEFAULT: L.signal, dark: dark.signal, deep: L.signalDeep, tint: L.signalTint },
      "hi-vis": { DEFAULT: L.hiVis, dark: dark.hiVis },

      // State: bright for fills, -ink for text
      court: { DEFAULT: L.court, dark: dark.court },
      whistle: { DEFAULT: L.whistle, dark: dark.whistle, ink: L.whistleInk },
      foul: { DEFAULT: L.foul, dark: dark.foul },
      "court-ink": { DEFAULT: L.courtInk, dark: dark.courtInk },
      "foul-ink": { DEFAULT: L.foulInk, dark: dark.foulInk },

      // Ink
      ink: { DEFAULT: L.ink, 80: L.ink80, 60: L.ink60, 40: L.ink40, 20: L.ink20, 10: L.ink10 },
      "ink-inv": {
        DEFAULT: L.inkInv,
        80: L.inkInv80,
        60: L.inkInv60,
        40: L.inkInv40,
        20: L.inkInv20,
        10: L.inkInv10,
      },

      // Pressed fills
      "ink-press": L.inkPress,
      "hi-vis-press": L.hiVisPress,
      "foul-ink-press": L.foulInkPress,
      "chalk-press": L.chalkPress,
      "signal-tint-press": L.signalTintPress,
    },
    borderRadius: {
      sm: `${radius.sm}px`,
      md: `${radius.md}px`,
      lg: `${radius.lg}px`,
      full: `${radius.full}px`,
    },
    boxShadow: Object.fromEntries(Object.entries(shadow).map(([k, v]) => [kebab(k), v])),
    letterSpacing: { ...letterSpacing },
  };
}

module.exports = { tailwindTheme };
