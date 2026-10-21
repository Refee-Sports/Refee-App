import {
  badgeVariants,
  buttonVariants,
  choice,
  field,
  resolve,
  toggle,
  type BadgeVariant,
  type ButtonVariant,
} from "@refee/design";

// The design system's looks, resolved to the colors React Native needs.
// Components in components/ui render from these.

export type Look = { bg: string; border: string; fg: string };

export function buttonLook(variant: ButtonVariant, pressed: boolean): Look {
  const v = buttonVariants[variant];
  return { bg: resolve(pressed ? v.bgPressed : v.bg), border: resolve(v.border), fg: resolve(v.fg) };
}

export function badgeLook(variant: BadgeVariant): Look & { dot: string } {
  const v = badgeVariants[variant];
  return { bg: resolve(v.bg), border: resolve(v.border), fg: resolve(v.fg), dot: resolve(v.dot) };
}

/** OptionRow, BigChoice and tappable cards. */
export function choiceLook({ selected, pressed, dim = false }: { selected: boolean; pressed: boolean; dim?: boolean }): Look {
  const base = selected ? choice.selected : dim ? choice.restDim : choice.rest;
  const bg = pressed ? (selected ? choice.pressedSelected : choice.pressed) : base.bg;
  return { bg: resolve(bg), border: resolve(base.border), fg: resolve(base.fg) };
}

export function chipLook({ selected, pressed }: { selected: boolean; pressed: boolean }): Look {
  if (selected) {
    return {
      bg: resolve(pressed ? choice.pressedSelected : choice.selected.bg),
      border: resolve(choice.selected.border),
      fg: resolve(choice.selected.fg),
    };
  }
  const v = pressed ? choice.chip.pressed : choice.chip.rest;
  return { bg: resolve(v.bg), border: resolve(v.border), fg: resolve(v.fg) };
}

/** Thumb position inside the track's 1px border; it grows toward the middle while held. */
export function toggleLook({ checked, held }: { checked: boolean; held: boolean }) {
  const inner = toggle.width - 2;
  const thumbWidth = held ? toggle.thumbHeld : toggle.thumb;
  const state = checked ? "on" : "off";
  return {
    track: resolve(toggle.track[state]),
    thumb: resolve(toggle.thumbFill[state]),
    thumbBorder: resolve(toggle.thumbBorder[state]),
    thumbWidth,
    thumbLeft: checked ? inner - toggle.inset - thumbWidth : toggle.inset,
  };
}

export function fieldLook({ focused, error }: { focused: boolean; error: boolean }) {
  return {
    bg: resolve(field.bg),
    border: resolve(focused ? field.borderFocus : error ? field.borderError : field.border),
    glow: focused,
    text: resolve(field.text),
    placeholder: resolve(field.placeholder),
    label: resolve(field.label),
    hint: resolve(field.hint),
    error: resolve(field.error),
  };
}
