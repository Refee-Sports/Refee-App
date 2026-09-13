"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

type Props = {
  /** Shown centred; usually the mono step counter or screen name. */
  title?: ReactNode;
  right?: ReactNode;
  /** Where the back arrow goes. Defaults to browser back. */
  backHref?: string;
  showBack?: boolean;
};

/** The app's small squared back-button header. */
export function ScreenHeader({ title, right, backHref, showBack = true }: Props) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between px-5 py-3">
      {showBack ? (
        <button
          type="button"
          onClick={() => (backHref ? router.push(backHref) : router.back())}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="chevron-left" size={18} />
        </button>
      ) : (
        <span className="h-9 w-9" />
      )}

      <div
        className="font-mono-bold text-[9px] uppercase text-ink-60"
        style={{ letterSpacing: 2 }}
      >
        {title}
      </div>

      <div className="flex h-9 min-w-9 items-center justify-end">{right}</div>
    </div>
  );
}
