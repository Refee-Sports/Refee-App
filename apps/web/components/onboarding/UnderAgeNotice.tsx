"use client";

import { useState } from "react";
import { waitlistAge } from "@refee/core/identity/age";
import { joinUnder18Waitlist } from "@/lib/identity/waitlist";

type Status = "idle" | "saving" | "done";

/**
 * Shown under the date-of-birth field when someone enters a 16 or 17 year old's
 * birthday. Refee is 18+, so this is the one place we answer "can I still use
 * it?" — with an offer to email them if a supervised option ever exists. It
 * renders nothing for anyone else, so nothing is ever collected from a child
 * under 16 and adults are never asked.
 */
export function UnderAgeNotice({ dateOfBirth }: { dateOfBirth: string }) {
  const age = dateOfBirth ? waitlistAge(dateOfBirth) : null;
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  if (age === null) return null;

  const join = async () => {
    setStatus("saving");
    setError(null);
    const result = await joinUnder18Waitlist(age);
    if (result.error) {
      setError(result.error);
      setStatus("idle");
      return;
    }
    setStatus("done");
  };

  return (
    <div className="mt-4 border border-signal/30 bg-signal/5 px-3.5 py-3">
      <p className="font-body-bold text-[13px] text-ink">Refee is 18+ for now.</p>
      <p className="mt-1 text-[13px] leading-[18px] text-ink-80">
        Plenty of {age}-year-olds officiate, so we&apos;re looking at a supervised option. Want an email if we build it?
      </p>

      {status === "done" ? (
        <p className="mt-3 font-mono-bold text-[10px] uppercase text-court-ink" style={{ letterSpacing: 1.2 }}>
          You&apos;re on the list. We&apos;ll use the email on your account.
        </p>
      ) : (
        <button
          type="button"
          onClick={join}
          disabled={status === "saving"}
          className="mt-3 w-full border border-ink px-3 py-2.5 font-mono-bold text-[11px] uppercase text-ink hover:bg-ink hover:text-paper disabled:opacity-60"
          style={{ letterSpacing: 1.5 }}
        >
          {status === "saving" ? "Saving…" : "Email me if you build it"}
        </button>
      )}

      {error ? (
        <p className="mt-2 font-mono text-[10px] uppercase text-foul-ink" style={{ letterSpacing: 1 }} role="alert">
          {error}
        </p>
      ) : null}

      <p className="mt-3 font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
        We keep your account email and your age, not your birthday.
      </p>
    </div>
  );
}
