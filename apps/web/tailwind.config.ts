import type { Config } from "tailwindcss";

/**
 * Mirrors the Refee-App design tokens (see ../Refee-App/Refee/refee/tailwind.config.js).
 * Fonts are wired via next/font in app/layout.tsx and exposed as CSS variables.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Hover styles only apply on devices that can hover, so a tap on a phone
  // never leaves a button stuck in its lifted state.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        // Light surfaces
        paper: "#E5E1D6",
        "paper-2": "#D8D3C5",
        "paper-3": "#C9C3B2",
        chalk: "#F5F2EA",

        // Dark surfaces
        "dark-paper": "#05080D",
        "dark-paper-2": "#0A0F18",
        "dark-chalk": "#131B28",

        // Brand
        signal: {
          DEFAULT: "#1F4FCC",
          dark: "#4F8CFF",
          deep: "#0B2880",
          tint: "rgba(31, 79, 204, 0.08)",
        },

        // Status / sport-tech accents
        "hi-vis": {
          DEFAULT: "#C9F031",
          dark: "#D4FF3A",
        },
        court: {
          DEFAULT: "#00A85C",
          dark: "#00D982",
        },
        whistle: {
          DEFAULT: "#F5B90B",
          dark: "#FFD24A",
          // Readable as small text on paper; plain whistle is for fills.
          ink: "#7A5700",
        },
        foul: {
          DEFAULT: "#E63946",
          dark: "#FF4757",
        },

        // Ink (text)
        ink: {
          DEFAULT: "#08111C",
          80: "rgba(8, 17, 28, 0.78)",
          60: "rgba(8, 17, 28, 0.56)",
          40: "rgba(8, 17, 28, 0.36)",
          20: "rgba(8, 17, 28, 0.18)",
          10: "rgba(8, 17, 28, 0.08)",
        },

        // Ink on dark surfaces (mirrors the app's dark palette)
        "ink-inv": {
          DEFAULT: "#FFFFFF",
          80: "rgba(255, 255, 255, 0.78)",
          60: "rgba(255, 255, 255, 0.56)",
          40: "rgba(255, 255, 255, 0.36)",
          20: "rgba(255, 255, 255, 0.18)",
          10: "rgba(255, 255, 255, 0.08)",
        },

        // Text-safe status colors and pressed states
        "court-ink": "#00733F", // green text (4.57:1 on paper)
        "foul-ink": "#B3202C", // red text + destructive fills (5.09:1 on paper)
        "ink-press": "#2B3440", // pressed primary button
        "hi-vis-press": "#B1D61F", // pressed hi-vis button
        "chalk-press": "#E9E5DA", // pressed option rows, big choice, cards
        "signal-tint-press": "rgba(31, 79, 204, 0.18)", // pressed selected choice
      },
      // Rounded scale. ZebraRule stays square.
      borderRadius: {
        sm: "10px", // fields, selects
        md: "12px", // buttons, option rows, big choice
        lg: "18px", // cards, sheets
        full: "9999px", // badges, chips, toggles
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter: "-0.03em",
        tight: "-0.02em",
        wide: "0.04em",
        wider: "0.12em",
        widest: "0.18em",
      },
      maxWidth: {
        wrap: "1320px",
      },
      boxShadow: {
        hard: "4px 4px 0 #08111C",
        "ring-hover": "0 0 0 3px #E5E1D6, 0 0 0 5px #08111C",
        "ring-hover-selected": "0 0 0 3px #E5E1D6, 0 0 0 5px #1F4FCC",
        "ring-focus": "0 0 0 2px #E5E1D6, 0 0 0 4px #1F4FCC",
        "glow-field-focus": "0 0 0 3px rgba(31, 79, 204, 0.25)",
        "hard-signal": "4px 4px 0 #1F4FCC",
        "hard-hivis": "4px 4px 0 #C9F031",
      },
    },
  },
  plugins: [],
};

export default config;
