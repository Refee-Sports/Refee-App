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
        hard: "4px 4px 0 var(--ink)",
        "hard-signal": "4px 4px 0 #1F4FCC",
        "hard-hivis": "4px 4px 0 #C9F031",
      },
    },
  },
  plugins: [],
};

export default config;
