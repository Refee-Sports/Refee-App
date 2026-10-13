import { LOGO_SRC, type LogoTone } from "@/lib/brand/logo";

/** The Refee lockup. Size it with a text-size class: the logo is 1.25em tall. */
export function Wordmark({ className = "", tone = "positive" }: { className?: string; tone?: LogoTone }) {
  return (
    <span className={`inline-flex items-center leading-none ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
      <img src={LOGO_SRC[tone]} alt="Refee" className="h-[1.25em] w-auto" />
    </span>
  );
}
