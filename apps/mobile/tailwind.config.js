/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Light surfaces
        paper: "#E5E1D6",
        "paper-2": "#D8D3C5",
        chalk: "#F5F2EA",

        // Dark surfaces
        "dark-paper": "#05080D",
        "dark-paper-2": "#0A0F18",
        "dark-chalk": "#131B28",

        // Brand
        signal: {
          DEFAULT: "#1F4FCC",  // light mode
          dark: "#4F8CFF",     // dark mode
          deep: "#0B2880",
          tint: "rgba(31, 79, 204, 0.08)",
        },

        // Status / sport-tech accents
        "hi-vis": {
          DEFAULT: "#C9F031",   // light
          dark: "#D4FF3A",      // dark
        },
        court: {
          DEFAULT: "#00A85C",   // light
          dark: "#00D982",      // dark
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

        // Text-safe status colors and pressed states
        "court-ink": { DEFAULT: "#00733F", dark: "#00D982" }, // green text (4.57:1 on paper)
        "foul-ink": { DEFAULT: "#B3202C", dark: "#FF4757" }, // red text + destructive fills (5.09:1 on paper)
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
      boxShadow: {
        hard: "4px 4px 0 #08111C",
        "ring-hover": "0 0 0 3px #E5E1D6, 0 0 0 5px #08111C",
        "ring-hover-selected": "0 0 0 3px #E5E1D6, 0 0 0 5px #1F4FCC",
        "ring-focus": "0 0 0 2px #E5E1D6, 0 0 0 4px #1F4FCC",
        "glow-field-focus": "0 0 0 3px rgba(31, 79, 204, 0.25)",
      },
      fontFamily: {
        // Display = Inter Tight Black (heavy, condensed; scoreboard energy)
        display: ["InterTight_900Black"],
        // Body = Inter Tight (regular weights)
        body: ["InterTight_500Medium"],
        "body-bold": ["InterTight_700Bold"],
        // Mono = JetBrains Mono (telemetry, data)
        mono: ["JetBrainsMono_500Medium"],
        "mono-bold": ["JetBrainsMono_700Bold"],
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter: "-0.03em",
        tight: "-0.02em",
        wide: "0.04em",
        wider: "0.12em",
        widest: "0.18em",
      },
    },
  },
  plugins: [],
};
