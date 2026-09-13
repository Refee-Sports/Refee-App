/**
 * A stylized preview of the Refee app's job feed rendered inside a realistic
 * iPhone frame (Dynamic Island, side buttons, status-bar glyphs, home
 * indicator). Pure CSS/markup — no image asset. Basketball-only to match the
 * current launch focus, with a "more sports soon" strip.
 */
export function PhoneMock() {
  return (
    <div className="relative mx-auto w-full max-w-[288px]">
      {/* Side buttons */}
      <span className="absolute -left-[2px] top-[104px] h-7 w-[3px] rounded-l-sm bg-ink/70" />
      <span className="absolute -left-[2px] top-[150px] h-11 w-[3px] rounded-l-sm bg-ink/70" />
      <span className="absolute -left-[2px] top-[206px] h-11 w-[3px] rounded-l-sm bg-ink/70" />
      <span className="absolute -right-[2px] top-[168px] h-16 w-[3px] rounded-r-sm bg-ink/70" />

      {/* Titanium frame */}
      <div className="relative rounded-[46px] bg-gradient-to-b from-[#20262e] via-[#0b111a] to-[#04070c] p-[9px] shadow-[0_28px_55px_-18px_rgba(8,17,28,0.55)] ring-1 ring-black/50">
        {/* Screen */}
        <div className="relative overflow-hidden rounded-[38px] bg-paper">
          {/* Dynamic Island */}
          <div className="absolute left-1/2 top-[11px] z-20 h-[26px] w-[84px] -translate-x-1/2 rounded-full bg-[#04070c]">
            <span className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#12202b]" />
          </div>

          {/* Status bar */}
          <div className="relative z-10 flex items-center justify-between px-6 pb-1.5 pt-4">
            <span className="font-body text-[13px] font-bold tracking-tight text-ink">
              9:41
            </span>
            <div className="flex items-center gap-1.5 text-ink">
              <CellularIcon />
              <WifiIcon />
              <BatteryIcon />
            </div>
          </div>

          {/* App header */}
          <div className="px-5 pb-2 pt-2">
            <div className="flex items-center justify-between gap-2">
              <p className="kicker whitespace-nowrap">Jobs near you</p>
              <span className="inline-flex shrink-0 items-center gap-1.5">
                <span className="dot dot-pulse bg-court" />
                <span className="whitespace-nowrap font-mono text-[9px] font-bold uppercase tracking-widest text-court">
                  On duty
                </span>
              </span>
            </div>
            <h3 className="mt-1 font-display text-2xl font-black tracking-tight text-ink">
              12 open games
            </h3>
          </div>

          {/* Job cards — basketball only */}
          <div className="space-y-3 px-4">
            <JobCard
              badge={{ label: "Live", tone: "live" }}
              title="U14 Rec — Court 2"
              meta="Sat 10:00 AM · Lincoln HS"
              pay="72"
            />
            <JobCard
              badge={{ label: "1 spot", tone: "signal" }}
              title="JV Boys — Main Gym"
              meta="Sat 1:30 PM · Riverside HS"
              pay="65"
            />
            <JobCard
              badge={{ label: "Confirmed", tone: "confirmed" }}
              title="Rec League — Court 4"
              meta="Sun 9:00 AM · Eastgate"
              pay="58"
              muted
            />
          </div>

          {/* More sports coming soon */}
          <div className="mx-4 mb-3 mt-3 border border-dashed border-ink-20 bg-chalk/50 px-3 py-2.5">
            <p className="kicker !text-ink-40">More sports coming soon</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-40">
              Soccer · Baseball · Volleyball · Football
            </p>
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-2.5 pt-1">
            <span className="h-1 w-28 rounded-full bg-ink/25" />
          </div>
        </div>
      </div>

      {/* Floating pay chip */}
      <div className="absolute -right-5 bottom-[58px] hidden rotate-3 border border-ink bg-hi-vis px-3 py-2 shadow-[4px_4px_0_var(--ink)] sm:block">
        <p className="font-mono text-[9px] uppercase tracking-widest text-ink">
          Paid out
        </p>
        <p className="font-display text-lg font-black tracking-tight text-ink">
          $1,284
        </p>
      </div>
    </div>
  );
}

function JobCard({
  badge,
  title,
  meta,
  pay,
  muted = false,
}: {
  badge: { label: string; tone: "live" | "signal" | "confirmed" };
  title: string;
  meta: string;
  pay: string;
  muted?: boolean;
}) {
  const badgeClass =
    badge.tone === "live"
      ? "badge-live"
      : badge.tone === "confirmed"
        ? "badge-confirmed"
        : "badge-signal";

  return (
    <div
      className={`card p-3.5 ${muted ? "opacity-60" : "shadow-[3px_3px_0_var(--ink)]"}`}
    >
      <div className="flex items-center justify-between">
        <span className="kicker">Basketball</span>
        <span className={`badge ${badgeClass}`}>
          {badge.tone !== "confirmed" && <span className="dot dot-pulse" />}
          {badge.label}
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <p className="font-display text-base font-black leading-tight tracking-tight text-ink">
            {title}
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-60">
            {meta}
          </p>
        </div>
        <div className="text-right leading-none">
          <span className="font-display text-xl font-black tracking-tight text-court">
            ${pay}
          </span>
        </div>
      </div>
    </div>
  );
}

/* --- status-bar glyphs --- */
function CellularIcon() {
  return (
    <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden>
      <rect x="0" y="7" width="3" height="4" rx="1" />
      <rect x="4.5" y="5" width="3" height="6" rx="1" />
      <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
      <rect x="13.5" y="0" width="3" height="11" rx="1" />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor" aria-hidden>
      <path d="M7.5 2.2c2.3 0 4.4.9 6 2.4l-1.3 1.4A6.7 6.7 0 0 0 7.5 4.1c-1.8 0-3.5.7-4.7 1.9L1.5 4.6A8.6 8.6 0 0 1 7.5 2.2Z" />
      <path d="M7.5 5.6c1.4 0 2.7.5 3.6 1.5l-1.4 1.4c-.6-.6-1.3-.9-2.2-.9-.9 0-1.7.3-2.2.9L3.9 7.1A5.2 5.2 0 0 1 7.5 5.6Z" />
      <circle cx="7.5" cy="9.6" r="1.3" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <span className="flex items-center gap-[2px]">
      <span className="relative flex h-[11px] w-[22px] items-center rounded-[3px] border border-ink/60 px-[1.5px]">
        <span className="h-[6px] w-[15px] rounded-[1px] bg-ink" />
      </span>
      <span className="h-[4px] w-[1.5px] rounded-r bg-ink/60" />
    </span>
  );
}
