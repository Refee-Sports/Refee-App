import type { ReactNode } from "react";

/**
 * The mono telemetry strip below the app header.
 * "14 NEW · 3 INVITED" / "RADIUS 25 MI" — readout style.
 */
export function Telemetry({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex justify-between px-5 pb-3">
      <span
        className="font-mono text-[9px] uppercase text-ink-60"
        style={{ letterSpacing: 1.5 }}
      >
        {left}
      </span>
      {right ? (
        <span
          className="font-mono text-[9px] uppercase text-ink-60"
          style={{ letterSpacing: 1.5 }}
        >
          {right}
        </span>
      ) : null}
    </div>
  );
}
