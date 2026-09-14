"use client";

/** Shown instead of a page's content when it couldn't load, with a way to retry. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mx-5 flex flex-col items-center border border-foul bg-foul/10 px-6 py-10 text-center sm:mx-0"
    >
      <p className="font-mono-bold text-[11px] uppercase text-foul" style={{ letterSpacing: 1.5 }}>
        Couldn&apos;t load this page
      </p>
      <p className="mt-2 max-w-sm text-[13px] leading-5 text-ink">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 bg-ink px-5 py-3 font-mono-bold text-[10px] uppercase text-paper hover:opacity-80"
        style={{ letterSpacing: 2 }}
      >
        Try again
      </button>
    </div>
  );
}
