import { light } from "./tokens";

export { light, dark, radius, shadow, letterSpacing, motion, camelize, kebab } from "./tokens";
export type { ColorKey } from "./tokens";
export { contrast, resolve, type Fill } from "./color";
export * from "./variants";

/** Light-theme colors by token key, for code that can't use a class (icon colors, native props). */
export const palette = light;
