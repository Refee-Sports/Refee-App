/**
 * App Store / Google Play buttons. Links are placeholders (#) until the
 * apps are live — swap the href once you have store listings.
 */
const APP_STORE_URL = "#";
const PLAY_STORE_URL = "#";

export function StoreButtons({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <a
        href={APP_STORE_URL}
        className="group inline-flex items-center gap-3 border border-ink bg-ink px-5 py-3 text-paper transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--signal)]"
      >
        <AppleIcon />
        <span className="leading-tight">
          <span className="block font-mono text-[9px] uppercase tracking-widest text-paper/60">
            Download on the
          </span>
          <span className="block font-display text-lg font-black tracking-tight">
            App Store
          </span>
        </span>
      </a>
      <a
        href={PLAY_STORE_URL}
        className="group inline-flex items-center gap-3 border border-ink bg-paper px-5 py-3 text-ink transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--ink)]"
      >
        <PlayIcon />
        <span className="leading-tight">
          <span className="block font-mono text-[9px] uppercase tracking-widest text-ink-60">
            Get it on
          </span>
          <span className="block font-display text-lg font-black tracking-tight">
            Google Play
          </span>
        </span>
      </a>
    </div>
  );
}

function AppleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 12.53c-.02-2.02 1.65-2.99 1.72-3.04-.94-1.37-2.4-1.56-2.92-1.58-1.24-.13-2.42.73-3.05.73-.63 0-1.6-.71-2.63-.69-1.35.02-2.6.79-3.29 2-1.4 2.44-.36 6.05 1.01 8.03.67.97 1.47 2.05 2.51 2.01 1.01-.04 1.39-.65 2.61-.65 1.22 0 1.56.65 2.63.63 1.09-.02 1.78-.99 2.44-1.96.77-1.12 1.09-2.21 1.11-2.27-.02-.01-2.13-.82-2.15-3.24zM15.1 6.35c.56-.68.94-1.62.83-2.56-.81.03-1.79.54-2.37 1.22-.52.6-.97 1.56-.85 2.48.9.07 1.83-.46 2.39-1.14z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3.6 2.3c-.3.3-.5.8-.5 1.4v16.6c0 .6.2 1.1.5 1.4l.1.1L13 12.1v-.2L3.7 2.2l-.1.1zM16.3 15.2 13.4 12.3v-.2l2.9-2.9.1.1 3.5 2c1 .6 1 1.5 0 2.1l-3.6 1.8zM13.4 12.3l3 3L6 21.6c-.7.4-1.3.3-1.7-.1l9.1-9.2zM4.3 2.4c.4-.4 1-.5 1.7-.1l10.4 5.9-3 3L4.3 2.4z" />
    </svg>
  );
}
