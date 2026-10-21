// Next.js's recommended rules (core web vitals) and its TypeScript rules.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import designBaseline from "./eslint.design-baseline.json" with { type: "json" };
// Next routes like [id] and Expo groups like (app) are glob syntax; match them literally.
const literalPath = (file) => file.replace(/[[\]()*?{}!]/g, "\\$&");

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // A leading underscore marks a parameter kept for the shared signature.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // The design system: screens are built from components/ui, and colors
    // come from tokens (Tailwind classes or @refee/design), never literals.
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    ignores: ["components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name=/^(button|input|select|textarea)$/]",
          message:
            "Use the shared controls in components/ui (AppButton, TextField, OptionRow, Chip, BigChoice, Toggle…) so you get the design system's states. If none fits, add one there.",
        },
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: "Use a token (a Tailwind class, or palette from @refee/design) instead of a hex color.",
        },
      ],
    },
  },
  // Files written before the rule. Move them onto components/ui and delete
  // them from eslint.design-baseline.json; never add to it.
  ...(designBaseline.length ? [{ files: designBaseline.map(literalPath), rules: { "no-restricted-syntax": "off" } }] : []),
  { ignores: [".next/**", "out/**", "next-env.d.ts"] },
];

export default config;
