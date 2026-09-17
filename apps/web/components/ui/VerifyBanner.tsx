"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { verificationBlocker } from "@/lib/identity/queries";

/**
 * Shown at the top of a role's home while their ID hasn't been confirmed.
 *
 * It explains why the buttons below are off. The database is what actually
 * refuses the work (migration 0042) — this is so nobody has to find that out
 * by being rejected.
 */
export function VerifyBanner() {
  const { identityStatus } = useAuth();

  // null = still resolving; approved = nothing to say.
  if (!identityStatus || identityStatus === "approved") return null;

  const message = verificationBlocker(identityStatus);
  if (!message) return null;

  const waiting = identityStatus === "in_review";

  return (
    <div
      role="status"
      className={`mx-5 mb-4 flex flex-col gap-3 border px-4 py-3 sm:mx-0 sm:flex-row sm:items-center ${
        waiting ? "border-ink-20 bg-chalk" : "border-signal bg-signal/10"
      }`}
    >
      <p className="flex-1 text-[13px] leading-5 text-ink">{message}</p>
      {!waiting && (
        <Link
          href="/verify"
          className="shrink-0 bg-ink px-4 py-2.5 text-center font-mono-bold text-[10px] uppercase text-paper hover:opacity-80"
          style={{ letterSpacing: 2 }}
        >
          Verify my ID
        </Link>
      )}
    </div>
  );
}

/**
 * The reason a gated control is disabled, or null when it isn't.
 * Use for `disabled` and `title` on Apply, Accept, Post game, Offer.
 */
export function useVerificationGate(): string | null {
  const { identityStatus } = useAuth();
  if (!identityStatus) return null;
  return identityStatus === "approved" ? null : verificationBlocker(identityStatus);
}
