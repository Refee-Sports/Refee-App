import type { ReactNode } from "react";

/** Port of the app's DataCard — bordered card with a mono tab notch on top. */
export function DataCard({
  tab,
  children,
  className = "",
}: {
  tab: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative mb-3 mt-2 border border-ink bg-chalk ${className}`}>
      <span className="absolute -top-2.5 left-3 z-10 bg-paper px-1.5">
        <span
          className="font-mono-bold text-[8px] uppercase text-ink"
          style={{ letterSpacing: 1.8 }}
        >
          {tab}
        </span>
      </span>
      {children}
    </div>
  );
}
