const { tailwindTheme } = require("@refee/design/tailwind");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Colors, radii, shadows and tracking come from @refee/design, the one
      // home for tokens (mirrors docs/design-system/tokens.json).
      ...tailwindTheme(),
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
    },
  },
  plugins: [],
};
