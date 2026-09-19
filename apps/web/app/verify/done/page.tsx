"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  ASSIGNOR_HOME,
  DIRECTOR_HOME,
  REFEREE_HOME,
} from "@/components/providers/RouteGate";
import {
  fetchMyIdentityStatus,
  verificationBlocker,
  type IdentityStatus,
} from "@/lib/identity/queries";

/** How long to keep asking before telling them to get on with their day. */
const POLL_MS = 3000;
const GIVE_UP_MS = 60_000;

/**
 * Where Didit returns people when they've finished. The answer doesn't arrive
 * with them — it arrives at the backend as a signed webhook — so this screen
 * waits for that to land rather than believing anything in the URL.
 */
export default function VerifyDonePage() {
  const { userId, primaryRole, refreshProfile } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<IdentityStatus | null>(null);
  const [stillWaiting, setStillWaiting] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  const home =
    primaryRole === "director"
      ? DIRECTOR_HOME
      : primaryRole === "assignor"
        ? ASSIGNOR_HOME
        : REFEREE_HOME;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const poll = async () => {
      const next = await fetchMyIdentityStatus(userId);
      if (cancelled) return;
      setStatus(next.status);
      setReason(next.reason);

      if (next.status === "approved") {
        await refreshProfile();
        if (!cancelled) router.replace(home);
        return;
      }
      if (next.status === "declined") return;

      if (Date.now() - startedAt.current > GIVE_UP_MS) {
        setStillWaiting(true);
        return;
      }
      timer = setTimeout(() => void poll(), POLL_MS);
    };

    let timer = setTimeout(() => void poll(), 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId, home, router, refreshProfile]);

  const declined = status === "declined";

  return (
    <div className="flex min-h-screen flex-col bg-paper px-5 py-10">
      <div className="mx-auto w-full max-w-md">
        <h1
          className="whitespace-pre-line font-display text-ink"
          style={{ fontSize: 40, lineHeight: "46px", letterSpacing: -1.5 }}
        >
          {declined ? "WE COULDN'T" : "WE'RE"}
          {"\n"}
          <span className="text-signal">{declined ? "VERIFY THAT" : "CHECKING"}</span>
        </h1>

        <p className="mt-4 text-[14px] leading-5 text-ink-80">
          {declined
            ? "That check didn't pass. You can start a new one — it's often just a blurry photo or an expired ID."
            : stillWaiting
              ? "This one is taking longer than usual. Nothing is wrong — you can carry on and we'll open everything up the moment it clears."
              : (status ? verificationBlocker(status, primaryRole) : "Hang on while we get the result.")}
        </p>
        {reason && (declined || status === "in_review") ? (
          <p className="mt-3 border-l-2 border-foul pl-3 text-[13px] leading-5 text-ink">{reason}</p>
        ) : null}

        {!declined && !stillWaiting && (
          <p
            className="mt-6 font-mono text-[10px] uppercase text-ink-40"
            style={{ letterSpacing: 2 }}
          >
            Checking…
          </p>
        )}

        <button
          type="button"
          onClick={() => router.replace(declined ? "/verify" : home)}
          className="mt-8 flex w-full items-center justify-center gap-2 bg-ink py-4 text-paper hover:opacity-80"
        >
          <span className="font-mono-bold" style={{ fontSize: 12, letterSpacing: 2.5 }}>
            {declined ? "TRY AGAIN" : "KEEP LOOKING AROUND"}
          </span>
          <span className="font-mono-bold text-base">→</span>
        </button>
      </div>
    </div>
  );
}
