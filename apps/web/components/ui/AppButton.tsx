"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon } from "./Icon";

export type ButtonVariant = "primary" | "hi-vis" | "secondary" | "danger" | "danger-fill" | "court";

export interface AppButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  loadingLabel?: string; // read by screen readers while loading, e.g. "Accepting"
  done?: boolean; // swaps to the court Done style with a check
  doneLabel?: string; // e.g. "Accepted"
  disabledReason?: string; // shown under the button when disabled
  showArrow?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

const base = cn(
  "relative inline-flex min-h-[48px] items-center justify-center gap-2 whitespace-nowrap",
  "rounded-md border-[1.5px] px-6 py-[15px]",
  "font-mono-bold text-[12px] uppercase tracking-[0.14em]",
  "transition-[transform,box-shadow,background-color] duration-[120ms] ease-out",
  // hover: lift to act (pointer devices only, via hoverOnlyWhenSupported)
  "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard",
  // pressed: push in, instantly
  "active:translate-x-0 active:translate-y-0 active:scale-[0.97] active:shadow-none active:duration-0",
  // focus: keyboard only
  "focus-visible:outline-none focus-visible:shadow-ring-focus",
  // disabled
  "disabled:cursor-not-allowed disabled:opacity-40",
  "disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:active:scale-100",
  // reduced motion
  "motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0"
);

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper border-ink active:bg-ink-press active:border-ink-press",
  "hi-vis": "bg-hi-vis text-ink border-ink active:bg-hi-vis-press",
  secondary: "bg-transparent text-ink border-ink active:bg-ink/10",
  danger: "bg-transparent text-foul-ink border-foul-ink active:bg-ink/10",
  "danger-fill": "bg-foul-ink text-white border-foul-ink active:bg-[#961A24]",
  court: "bg-court text-ink border-ink",
};

function ButtonSpinner() {
  return (
    <svg
      className="absolute left-1/2 top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 animate-spin motion-reduce:animate-none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="40 60" />
    </svg>
  );
}

/**
 * Port of the app's components/ui/Button. Lifts on hover (pointer devices
 * only), pushes in on press, holds its width while loading, and turns court
 * green with a check when `done`.
 */
export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(function AppButton(
  {
    label,
    variant = "primary",
    loading = false,
    loadingLabel,
    done = false,
    doneLabel,
    disabledReason,
    showArrow = false,
    fullWidth = false,
    icon,
    disabled,
    className,
    onClick,
    type = "button",
    ...rest
  },
  ref
) {
  const isDone = done && !loading;
  const v: ButtonVariant = isDone ? "court" : variant;
  const text = isDone ? doneLabel ?? label : label;

  return (
    <span className={cn(fullWidth ? "flex w-full" : "inline-flex", "flex-col gap-1.5")}>
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        aria-busy={loading || undefined}
        aria-label={loading ? loadingLabel ?? label : undefined}
        onClick={loading ? undefined : onClick}
        className={cn(base, variants[v], fullWidth && "w-full", loading && "pointer-events-none cursor-progress", className)}
        {...rest}
      >
        <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>
          {isDone ? <Icon name="check" size={16} /> : icon}
          {text}
          {showArrow && !isDone && <Icon name="arrow-right" size={16} />}
        </span>
        {loading && <ButtonSpinner />}
      </button>
      {disabled && disabledReason && (
        <span className="font-mono-bold text-[9px] uppercase tracking-[0.1em] text-ink-60">{disabledReason}</span>
      )}
    </span>
  );
});

export default AppButton;

/** Standalone spinner for loading screens and inline waits. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none ${className}`}
    />
  );
}
