"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { finalizeOAuthRedirect } from "@/lib/oauth";
import { Spinner } from "@/components/ui/AppButton";

/**
 * OAuth landing page. The app deep-links back into itself after a Google/Apple
 * sign-in; on web the provider redirects here, we exchange the code for a
 * session, and RouteGate takes it from there.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const exchangeStarted = useRef(false);

  useEffect(() => {
    // OAuth codes are single-use. React's development Strict Mode runs effects
    // twice, so never let the same callback page exchange one twice.
    if (exchangeStarted.current) return;
    exchangeStarted.current = true;
    (async () => {
      const { error: err } = await finalizeOAuthRedirect(window.location.href);
      if (err) {
        setError(err.message);
        return;
      }
      const next = new URL(window.location.href).searchParams.get("next");
      router.replace(next === "/account" ? next : "/app/jobs");
    })();
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
      {error ? (
        <>
          <p className="font-mono-bold text-[10px] uppercase text-foul" style={{ letterSpacing: 2 }}>
            Sign-in failed
          </p>
          <p className="text-sm text-ink-80">{error}</p>
          <button
            type="button"
            onClick={() => router.replace("/auth/welcome")}
            className="font-mono-bold text-[11px] uppercase text-signal underline"
            style={{ letterSpacing: 1.5 }}
          >
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <span className="text-signal">
            <Spinner />
          </span>
          <p
            className="font-mono-bold text-[10px] uppercase text-ink-60"
            style={{ letterSpacing: 2 }}
          >
            Signing you in...
          </p>
        </>
      )}
    </div>
  );
}
