import type { ReactNode } from "react";

const TONES = {
  signal: "text-signal",
  court: "text-court",
  whistle: "text-whistle-ink",
  hiVis: "text-hi-vis-dark",
} as const;

/** The label above a landing-page section: referee stripes, then the words. */
export function SectionMark({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-3 ${TONES[tone]}`}>
      <span className="stripe-mark" aria-hidden />
      <span className="font-mono-bold text-[11px] uppercase" style={{ letterSpacing: "0.18em" }}>
        {children}
      </span>
    </span>
  );
}
