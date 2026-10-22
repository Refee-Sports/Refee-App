import type { ReactNode } from "react";

/** Port of the app's DataCard — a rounded card with a mono label above it. */
export function DataCard({
  tab,
  children,
  className = "",
}: {
  tab: string;
  children: ReactNode;
  className?: string;
}) {
  // The label sits above the card, so rounded corners and cards that clip
  // their content (the map) both keep it visible.
  return (
    <div className="mb-3">
      <span
        className="mb-1.5 ml-1 block font-mono-bold text-[9px] uppercase text-ink-60"
        style={{ letterSpacing: 1.8 }}
      >
        {tab}
      </span>
      <div className={`rounded-lg border border-ink bg-chalk ${className}`}>{children}</div>
    </div>
  );
}
