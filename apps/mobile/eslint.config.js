// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const designBaseline = require("./eslint.design-baseline.json");
// Next routes like [id] and Expo groups like (app) are glob syntax; match them literally.
const literalPath = (file) => file.replace(/[[\]()*?{}!]/g, "\\$&");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // The design system: screens are built from components/ui (Tappable is
    // the base for any tap none of the shared controls fit), and colors come
    // from tokens (NativeWind classes or palette from @refee/design).
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    ignores: ["components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name=/^(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|TextInput|Switch)$/]",
          message:
            "Use the shared controls in components/ui (Button, IconButton, TextLink, ListRow, TextField, OptionRow, Chip, BigChoice, Toggle, Card, or Tappable) so you get the design system's pressed state.",
        },
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: "Use a token (a NativeWind class, or palette from @refee/design) instead of a hex color.",
        },
      ],
    },
  },
  // Files written before the rule. Move them onto components/ui and delete
  // them from eslint.design-baseline.json; never add to it.
  ...(designBaseline.length ? [{ files: designBaseline.map(literalPath), rules: { "no-restricted-syntax": "off" } }] : []),
]);
