type Variant =
  | "live"
  | "confirmed"
  | "signal"
  | "warn"
  | "foul"
  | "neutral"
  | "ink";

type Props = {
  label: string;
  variant?: Variant;
  pulse?: boolean;
  withDot?: boolean;
};

/** Port of the app's components/ui/Badge. */
const styles: Record<Variant, string> = {
  live: "bg-hi-vis text-ink border-ink",
  confirmed: "bg-transparent text-court border-court",
  signal: "bg-transparent text-signal border-signal",
  warn: "bg-transparent text-whistle border-whistle",
  foul: "bg-transparent text-foul border-foul",
  neutral: "bg-transparent text-ink border-ink",
  ink: "bg-ink text-paper border-ink",
};

export function Badge({ label, variant = "neutral", pulse, withDot }: Props) {
  return (
    <span
      className={`${styles[variant]} inline-flex items-center gap-1.5 border px-2 py-1 font-mono-bold text-[9px] uppercase`}
      style={{ letterSpacing: 1.5 }}
    >
      {withDot && (
        <span
          className={`h-[5px] w-[5px] shrink-0 rounded-full bg-current ${pulse ? "dot-pulse" : ""}`}
        />
      )}
      {label}
    </span>
  );
}
