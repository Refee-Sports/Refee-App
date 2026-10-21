import type { Config } from "tailwindcss";
import { tailwindTheme } from "@refee/design/tailwind";

/**
 * Tokens come from @refee/design. Fonts are wired via next/font in
 * app/layout.tsx and exposed as CSS variables.
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
      // Colors, radii, shadows and tracking come from @refee/design, the one
      // home for tokens (mirrors docs/design-system/tokens.json).
      ...tailwindTheme(),
      maxWidth: {
        wrap: "1320px",
      },
    },
  },
  plugins: [],
};

export default config;
