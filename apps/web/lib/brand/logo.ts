/** Horizontal "On Call" lockups, copied from brand/logo. Positive sits on paper; reverse on ink. */
export const LOGO_SRC = {
  positive: "/brand/lockup-horizontal-positive.svg",
  reverse: "/brand/lockup-horizontal-reverse.svg",
} as const;

export type LogoTone = keyof typeof LOGO_SRC;
