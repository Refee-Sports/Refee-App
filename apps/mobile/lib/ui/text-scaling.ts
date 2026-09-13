import { createElement } from "react";
import { MAX_FONT_SCALE, withFontCap } from "./typography";

// RN 0.81 / React 19: Text & TextInput are plain function components (the new
// `component(...)` type) — no forwardRef `.render`, no `defaultProps`. So the
// reliable way to set an app-wide default is to wrap each module's default
// export once, before anything renders. `import { Text } from "react-native"`
// reads the RN index's live `get Text()` getter at use time, so replacing the
// underlying module default propagates everywhere without migrating call sites.
// An explicit maxFontSizeMultiplier on an element still wins (see withFontCap).
type TextModule = { default?: ((props: any) => unknown) & { displayName?: string }; __refeeFontCap?: boolean };

function capModuleDefault(mod: TextModule) {
  const Original = mod?.default;
  if (typeof Original !== "function" || mod.__refeeFontCap) return;

  const Capped = (props: any) => createElement(Original as never, withFontCap(props, MAX_FONT_SCALE) as never);
  (Capped as { displayName?: string }).displayName = Original.displayName ?? "Capped";

  try {
    mod.default = Capped;
    mod.__refeeFontCap = true;
  } catch {
    /* default is read-only under this bundler — global cap unavailable */
  }
}

/**
 * Caps OS Dynamic Type scaling for all Text/TextInput app-wide so text stays
 * scalable (accessibility) without breaking the dense layouts. Idempotent.
 * Call once at app start, before the first render (see app/_layout.tsx).
 */
export function applyGlobalFontScaleCap() {
  // Static require paths (Metro requires literals). These are the same modules
  // the react-native index re-exports as Text / TextInput.
  capModuleDefault(require("react-native/Libraries/Text/Text"));
  capModuleDefault(require("react-native/Libraries/Components/TextInput/TextInput"));
}
