export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display font-black tracking-tight text-ink leading-none ${className}`}
      aria-label="Refee"
    >
      REF<span className="text-signal">EE</span>
    </span>
  );
}
