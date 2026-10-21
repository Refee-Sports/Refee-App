import type { Fill } from "./color";
import type { ColorKey } from "./tokens";

/**
 * What each shared component looks like, as token keys. Both platforms
 * render from these: mobile resolves them to values directly, web keeps
 * literal Tailwind classes (so the compiler can see them) and a test checks
 * those classes name the same tokens.
 */

export type ButtonVariant = "primary" | "hi-vis" | "secondary" | "danger" | "danger-fill" | "court";

// fgPressed darkens the label where the pressed tint would drop it under 4.5:1.
export type ButtonLook = { bg: Fill; bgPressed: Fill; border: ColorKey; fg: ColorKey; fgPressed: ColorKey };

export const buttonVariants: Record<ButtonVariant, ButtonLook> = {
  primary: { bg: "ink", bgPressed: "inkPress", border: "ink", fg: "paper", fgPressed: "paper" },
  "hi-vis": { bg: "hiVis", bgPressed: "hiVisPress", border: "ink", fg: "ink", fgPressed: "ink" },
  // Decline, Cancel: neutral, never red.
  secondary: { bg: "transparent", bgPressed: "ink10", border: "ink", fg: "ink", fgPressed: "ink" },
  // Hard-to-undo only: cancel a game, remove a ref, drop out of a confirmed game.
  danger: { bg: "transparent", bgPressed: "ink10", border: "foulInk", fg: "foulInk", fgPressed: "foulInkPress" },
  "danger-fill": { bg: "foulInk", bgPressed: "foulInkPress", border: "foulInk", fg: "inkInv", fgPressed: "inkInv" },
  // The Done state: court fill, ink label.
  court: { bg: "court", bgPressed: "court", border: "ink", fg: "ink", fgPressed: "ink" },
};

export type BadgeVariant = "live" | "confirmed" | "signal" | "warn" | "foul" | "neutral" | "ink";

export type BadgeLook = { bg: Fill; border: ColorKey; fg: ColorKey; dot: ColorKey };

export const badgeVariants: Record<BadgeVariant, BadgeLook> = {
  live: { bg: "hiVis", border: "ink", fg: "ink", dot: "ink" },
  confirmed: { bg: "transparent", border: "court", fg: "courtInk", dot: "court" },
  signal: { bg: "transparent", border: "signal", fg: "signal", dot: "signal" },
  warn: { bg: "transparent", border: "whistle", fg: "whistleInk", dot: "whistle" },
  foul: { bg: "transparent", border: "foul", fg: "foulInk", dot: "foul" },
  neutral: { bg: "transparent", border: "ink", fg: "ink", dot: "ink" },
  ink: { bg: "ink", border: "ink", fg: "paper", dot: "paper" },
};

/** OptionRow, BigChoice and tappable cards; chips are the lighter variant. */
export const choice = {
  rest: { bg: "chalk", border: "ink", fg: "ink" },
  /** OptionRow's `dim` list and other quiet rows. */
  restDim: { bg: "chalk", border: "ink20", fg: "ink" },
  selected: { bg: "signalTint", border: "signal", fg: "signal" },
  pressed: "chalkPress",
  pressedSelected: "signalTintPress",
  /** Signal on signal-tint-press is 4.1:1, so the label deepens while held. */
  pressedSelectedFg: "signalDeep",
  chip: {
    rest: { bg: "transparent", border: "ink20", fg: "ink60" },
    pressed: { bg: "ink10", border: "ink40", fg: "ink80" },
  },
  scale: { chip: 0.96, bigChoice: 0.96, optionRow: 0.98, card: 0.98 },
} as const satisfies {
  rest: { bg: Fill; border: ColorKey; fg: ColorKey };
  restDim: { bg: Fill; border: ColorKey; fg: ColorKey };
  selected: { bg: Fill; border: ColorKey; fg: ColorKey };
  pressed: ColorKey;
  pressedSelected: ColorKey;
  pressedSelectedFg: ColorKey;
  chip: { rest: { bg: Fill; border: ColorKey; fg: ColorKey }; pressed: { bg: Fill; border: ColorKey; fg: ColorKey } };
  scale: Record<string, number>;
};

/** Buttons press to 97%. */
export const buttonPressScale = 0.97;

export const toggle = {
  width: 50,
  height: 28,
  thumb: 18,
  thumbHeld: 24,
  inset: 4,
  track: { off: "ink10", on: "ink" },
  thumbFill: { off: "paper", on: "hiVis" },
  thumbBorder: { off: "ink40", on: "hiVis" },
} as const satisfies {
  width: number; height: number; thumb: number; thumbHeld: number; inset: number;
  track: { off: ColorKey; on: ColorKey };
  thumbFill: { off: ColorKey; on: ColorKey };
  thumbBorder: { off: ColorKey; on: ColorKey };
};

export const field = {
  bg: "chalk",
  border: "ink",
  borderFocus: "signal",
  borderError: "foulInk",
  text: "ink",
  placeholder: "ink60",
  label: "ink60",
  hint: "ink60",
  error: "foulInk",
} as const satisfies Record<string, ColorKey>;

/** The glow-field-focus ring as native props (a spread shadow RN can't draw). */
export const fieldFocusGlow = { width: 3, color: "rgba(31, 79, 204, 0.25)" };

/** Disabled controls drop to this opacity, with a short reason nearby. */
export const disabledOpacity = 0.4;
