"use client";

import type { ReactNode } from "react";

type Variant = "primary" | "hi-vis" | "secondary" | "danger" | "court";

type Props = {
  label: string;
  onClick?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  showArrow?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  type?: "button" | "submit";
};

/**
 * Port of the app's components/ui/Button — squared corners, mono uppercase
 * label, optional arrow. Hover/active states are the web additions.
 */
const styles: Record<Variant, string> = {
  primary: "bg-ink text-paper border-ink hover:bg-signal hover:border-signal",
  "hi-vis": "bg-hi-vis text-ink border-hi-vis hover:bg-ink hover:text-hi-vis",
  secondary: "bg-transparent text-ink border-ink hover:bg-ink hover:text-paper",
  danger: "bg-transparent text-foul border-foul hover:bg-foul hover:text-paper",
  court: "bg-court text-white border-court hover:bg-ink hover:border-ink",
};

export function AppButton({
  label,
  onClick,
  variant = "primary",
  disabled,
  loading,
  showArrow = false,
  fullWidth = false,
  icon,
  type = "button",
}: Props) {
  const isOff = disabled || loading;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isOff}
      className={`
        ${styles[variant]} border-[1.5px] px-5 py-4
        ${fullWidth ? "w-full" : ""}
        ${isOff ? "cursor-not-allowed opacity-40" : "cursor-pointer active:opacity-80"}
        inline-flex items-center justify-center gap-2
        font-mono-bold text-xs uppercase
      `}
      style={{ letterSpacing: 2 }}
    >
      {loading ? (
        <Spinner />
      ) : (
        <>
          {icon}
          <span>{label}</span>
          {showArrow && <span className="ml-1 text-base">→</span>}
        </>
      )}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 animate-spin border-2 border-current border-t-transparent ${className}`}
      style={{ borderRadius: "50%" }}
    />
  );
}
