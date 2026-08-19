// Dynamic Type policy. React Native text already scales with the OS font-size
// setting (allowFontScaling defaults to true); this caps how far so the dense
// display/mono layouts stay intact. Pure + framework-free so it's unit-testable.

/** Max OS font-size (Dynamic Type) multiplier applied app-wide. Text still
 *  scales for accessibility, just not far enough to break tight layouts. */
export const MAX_FONT_SCALE = 1.4;

/**
 * Merge the default font cap into text props, letting an explicit
 * `maxFontSizeMultiplier` on the element override the global default.
 */
export function withFontCap<T extends { maxFontSizeMultiplier?: number }>(
  props: T,
  cap: number = MAX_FONT_SCALE
): T {
  return { maxFontSizeMultiplier: cap, ...props };
}
