"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/AppButton";
import { supabase } from "@/lib/supabase";
import { clearViewingAs, markViewingAs } from "@/components/admin/ViewingAsBanner";

/**
 * Where a staff "view as" link lands. The one-time token is in the fragment
 * (never sent to a server); redeeming it signs this window in as that person,
 * and the app takes it from there.
 */
export default function ViewAsPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Tokens are single-use; Strict Mode runs effects twice in development.
    if (started.current) return;
    started.current = true;
    (async () => {
      const tokenHash = new URLSearchParams(window.location.hash.slice(1)).get("token_hash");
      // Out of the address bar and history before anything else happens.
      window.history.replaceState(null, "", window.location.pathname);
      if (!tokenHash) {
        setError("This link is missing its sign-in token.");
        return;
      }
      // Marked before the session swaps, so the banner is there from the
      // first screen; named properly once we know who it is.
      markViewingAs("another account");
      const { data, error: err } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (err || !data.session) {
        clearViewingAs();
        setError(err?.message ?? "This link has already been used or has expired. Make a new one.");
        return;
      }
      markViewingAs(data.session.user.email ?? "this account");
      router.replace("/app/home");
    })();
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
      {error ? (
        <>
          <p className="font-mono-bold text-[10px] uppercase text-foul-ink" style={{ letterSpacing: 2 }}>
            Couldn&apos;t sign in
          </p>
          <p className="max-w-sm text-sm text-ink-80">{error}</p>
        </>
      ) : (
        <>
          <span className="text-signal">
            <Spinner />
          </span>
          <p className="font-mono-bold text-[10px] uppercase text-ink-60" style={{ letterSpacing: 2 }}>
            Opening their account…
          </p>
        </>
      )}
    </div>
  );
}
