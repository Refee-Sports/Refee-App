"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  ASSIGNOR_HOME,
  DIRECTOR_HOME,
  REFEREE_HOME,
} from "@/components/providers/RouteGate";
import { startIdentityVerification } from "@/lib/identity/queries";

/**
 * Where someone proves who they are. The check itself happens on Didit's own
 * pages — Refee never receives the ID images or the selfie — and the decision
 * comes back to the backend, signed. This screen only starts it.
 */
export default function VerifyPage() {
  const { primaryRole, identityStatus } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const home =
    primaryRole === "director"
      ? DIRECTOR_HOME
      : primaryRole === "assignor"
        ? ASSIGNOR_HOME
        : REFEREE_HOME;

  const start = async () => {
    setLoading(true);
    setError(null);
    const { url, error: startError } = await startIdentityVerification();
    if (startError) {
      setError(startError.message);
      setLoading(false);
      return;
    }
    if (!url) {
      // Nothing for them to do right now (already approved, or with reviewers).
      router.replace(home);
      return;
    }
    window.location.href = url;
  };

  if (identityStatus === "approved") {
    return (
      <Shell line1="YOU'RE" line2="VERIFIED">
        <p className="text-[14px] leading-5 text-ink-80">
          Your ID has been confirmed. You can take, post and staff games.
        </p>
        <Primary label="Continue" onClick={() => router.replace(home)} />
      </Shell>
    );
  }

  if (identityStatus === "in_review") {
    return (
      <Shell line1="WE'RE" line2="CHECKING">
        <p className="text-[14px] leading-5 text-ink-80">
          Someone is looking at your ID now. This usually takes a few minutes.
          You can keep browsing while you wait — we&apos;ll open everything up as
          soon as it clears.
        </p>
        <Primary label="Keep looking around" onClick={() => router.replace(home)} />
      </Shell>
    );
  }

  const retrying = identityStatus === "declined" || identityStatus === "expired"
    || identityStatus === "abandoned";

  return (
    <Shell line1={retrying ? "LET'S TRY" : "VERIFY"} line2={retrying ? "AGAIN" : "YOUR ID"}>
      <p className="text-[14px] leading-5 text-ink-80">
        {retrying
          ? "That check didn't go through. You can start a new one — have your ID ready and good light helps."
          : "Refee is open to anyone, so we check that every person on it is real and who they say they are. Directors are handing you their games; referees are handing you their pay."}
      </p>

      <ol className="mt-6 flex flex-col gap-3 border border-ink-20 px-4 py-4">
        {[
          "Photograph your government ID",
          "Take a short selfie",
          "That's it — usually under two minutes",
        ].map((step, i) => (
          <li key={step} className="flex gap-3">
            <span
              className="font-mono-bold text-[10px] text-signal"
              style={{ letterSpacing: 1.5 }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="flex-1 text-[13px] leading-5 text-ink">{step}</span>
          </li>
        ))}
      </ol>

      {/* Face match and liveness are biometric processing; several states
          require saying so plainly before anything is captured. */}
      <p className="mt-5 text-[11px] leading-4 text-ink-60">
        Our identity partner, Didit, scans your ID and compares it to your selfie
        to confirm it&apos;s you. That includes a biometric face match. Refee never
        receives or stores your ID images. By continuing you agree to Didit
        performing this check.
      </p>

      {error && (
        <p
          className="mt-4 font-mono text-[10px] uppercase text-foul"
          style={{ letterSpacing: 1 }}
        >
          {error}
        </p>
      )}

      <Primary
        label={loading ? "Starting…" : retrying ? "Start a new check" : "Verify my ID"}
        onClick={() => void start()}
        disabled={loading}
      />
      <button
        type="button"
        onClick={() => router.replace(home)}
        className="mt-3 w-full py-3 font-mono text-[10px] uppercase text-ink-60 hover:text-ink"
        style={{ letterSpacing: 2 }}
      >
        I&apos;ll do this later
      </button>
    </Shell>
  );
}

function Shell({
  line1,
  line2,
  children,
}: {
  line1: string;
  line2: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-paper px-5 py-10">
      <div className="mx-auto w-full max-w-md">
        <h1
          className="whitespace-pre-line font-display text-ink"
          style={{ fontSize: 40, lineHeight: "46px", letterSpacing: -1.5 }}
        >
          {line1}
          {"\n"}
          <span className="text-signal">{line2}</span>
        </h1>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function Primary({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`mt-6 flex w-full items-center justify-center gap-2 py-4 ${
        disabled
          ? "cursor-not-allowed bg-ink-20 text-ink-40"
          : "bg-ink text-paper hover:opacity-80"
      }`}
    >
      <span className="font-mono-bold" style={{ fontSize: 12, letterSpacing: 2.5 }}>
        {label.toUpperCase()}
      </span>
      <span className="font-mono-bold text-base">→</span>
    </button>
  );
}
