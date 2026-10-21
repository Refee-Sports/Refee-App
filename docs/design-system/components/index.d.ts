// Types as documentation — ported from the source components' own prop
// types (apps/web/components/ui/*.tsx, apps/mobile/components/ui/*.tsx).
// Not type-checked; this system ships static renditions, not a live bundle.

export type ButtonVariant = "primary" | "hi-vis" | "secondary" | "danger" | "danger-fill" | "court"; // "court" = Done state
export interface ButtonProps {
  label: string;
  onClick?: () => void; // onPress on mobile
  variant?: ButtonVariant; // default "primary"
  disabled?: boolean;
  disabledReason?: string; // shown near the button when disabled
  loading?: boolean; // both platforms: width held, spinner, taps blocked
  loadingLabel?: string; // accessible label while loading, e.g. "Accepting"
  done?: boolean; // swaps to the court Done style with a check
  doneLabel?: string; // e.g. "Accepted"
  showArrow?: boolean;
  fullWidth?: boolean;
  icon?: unknown; // ReactNode
}

export type BadgeVariant = "live" | "confirmed" | "signal" | "warn" | "foul" | "neutral" | "ink";
export interface BadgeProps {
  label: string;
  variant?: BadgeVariant; // default "neutral"
  pulse?: boolean;
  withDot?: boolean;
}

export type ZebraRuleVariant = "ink" | "signal" | "hi-vis";
export interface ZebraRuleProps {
  variant?: ZebraRuleVariant; // default "ink"
  thin?: boolean;
  noMargin?: boolean; // web only
}

export type WordmarkMode = "light" | "dark" | "inverse";
export interface WordmarkProps {
  size?: number; // default 24
  mode?: WordmarkMode; // default "light"
}

export interface TextFieldProps {
  error?: string;
  hint?: string;
  // ...plus standard <input> attributes
}

export interface AffixFieldProps extends TextFieldProps {
  prefix?: string;
  suffix?: string;
}

export interface SelectFieldProps {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  placeholder?: string;
}

export interface DateFieldProps {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}

export interface OptionRowProps {
  label: string;
  sublabel?: string;
  selected: boolean;
  onClick: () => void;
  dim?: boolean; // use the lighter unselected border (the levels list)
}

export interface ChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export interface BigChoiceProps {
  num: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}

export interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string; // aria-label
}

export type IconName =
  | "alert-circle" | "arrow-left" | "arrow-right" | "arrow-up" | "bookmark"
  | "calendar" | "camera" | "check" | "check-circle" | "chevron-down"
  | "chevron-left" | "chevron-right" | "circle" | "copy" | "credit-card"
  | "dollar-sign" | "edit-2" | "file-text" | "filter" | "grid" | "home"
  | "log-out" | "map-pin" | "message-square" | "navigation" | "plus"
  | "send" | "star" | "search" | "upload" | "user" | "users" | "x" | "zap";
export interface IconProps {
  name: IconName;
  size?: number; // default 20
  fill?: string; // default "none"
}
