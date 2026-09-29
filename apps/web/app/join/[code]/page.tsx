"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/AppButton";
import { supabase } from "@/lib/supabase";
import {
  extractRosterCode,
  joinRosterByCode,
  previewRosterInviteCode,
  type RosterCodePreview,
} from "@/lib/assignor/queries";
import { setPendingRosterCode } from "@/lib/roster/files";

/**
 * Where a scanned roster QR code lands (/join/<code>). Signed-out visitors are
 * sent to sign in first; the code is remembered so they come straight back.
 */
export default function JoinRosterPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = extractRosterCode(decodeURIComponent(params.code ?? ""));
  const [state, setState] = useState<"loading" | "signed-out" | "ready" | "invalid" | "joining">("loading");
  const [preview, setPreview] = useState<RosterCodePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code) {
        setState("invalid");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        setPendingRosterCode(code);
        setState("signed-out");
        return;
      }
      const result = await previewRosterInviteCode(code);
      if (cancelled) return;
      if (result.error || !result.preview) {
        setError(result.error?.message ?? null);
        setState("invalid");
      } else {
        setPreview(result.preview);
        setState("ready");
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  const join = async () => {
    if (!code) return;
    setState("joining");
    const { error: e } = await joinRosterByCode(code);
    if (e) {
      setError(e.message);
      setState("ready");
      return;
    }
    router.replace("/app/organizations");
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-paper px-6">
      {state === "loading" ? (
        <div className="flex justify-center text-signal"><Spinner /></div>
      ) : state === "signed-out" ? (
        <div>
          <p className="font-mono-bold text-[10px] uppercase text-signal" style={{ letterSpacing: 2 }}>Roster invitation</p>
          <h1 className="mt-3 font-display text-ink" style={{ fontSize: 36, lineHeight: "40px", letterSpacing: -1.5 }}>
            SIGN IN TO<br /><span className="text-signal">JOIN THE ROSTER.</span>
          </h1>
          <p className="mt-3 text-[14px] leading-5 text-ink-80">
            You&apos;ve been invited to join an assignor&apos;s roster on Refee. Sign in or create your account and we&apos;ll bring you
            right back to accept.
          </p>
          <Link
            href="/auth/welcome"
            className="mt-7 flex w-full items-center justify-center bg-ink py-4 font-mono-bold text-[12px] uppercase text-paper hover:opacity-80"
            style={{ letterSpacing: 2.5 }}
          >
            Continue
          </Link>
        </div>
      ) : state === "invalid" ? (
        <div>
          <h1 className="font-display text-ink" style={{ fontSize: 34, lineHeight: "38px", letterSpacing: -1 }}>
            THAT CODE<br /><span className="text-foul">DOESN&apos;T WORK.</span>
          </h1>
          <p className="mt-3 text-[14px] leading-5 text-ink-80">
            {error ?? "It may have been replaced. Ask the assignor for their current QR code."}
          </p>
          <Link href="/app/organizations" className="mt-6 flex w-full items-center justify-center bg-ink py-4 font-mono-bold text-[12px] uppercase text-paper" style={{ letterSpacing: 2 }}>
            Back
          </Link>
        </div>
      ) : (
        <div>
          <p className="font-mono-bold text-[10px] uppercase text-signal" style={{ letterSpacing: 2 }}>Roster invitation</p>
          <h1 className="mt-3 font-display uppercase text-ink" style={{ fontSize: 36, lineHeight: "40px", letterSpacing: -1.5 }}>
            Join {preview?.display_name}&apos;s<br /><span className="text-signal">roster?</span>
          </h1>
          <p className="mt-3 text-[14px] leading-5 text-ink-80">
            {preview?.city ? `${preview.city}, ${preview.state}. ` : ""}
            They&apos;ll be able to offer you games, and you&apos;ll see the games they open to their roster. You can also be on other
            rosters, and you can leave any time.
          </p>
          {error ? <p className="mt-3 font-mono text-[10px] uppercase text-foul" role="alert">{error}</p> : null}
          <button
            type="button"
            onClick={() => void join()}
            disabled={state === "joining"}
            className="mt-7 flex w-full items-center justify-center bg-ink py-4 font-mono-bold text-[12px] uppercase text-paper hover:opacity-80 disabled:opacity-60"
            style={{ letterSpacing: 2.5 }}
          >
            {state === "joining" ? <Spinner /> : "Join roster"}
          </button>
          <Link href="/app/organizations" className="mt-2 block py-4 text-center font-mono-bold text-[11px] uppercase text-ink underline" style={{ letterSpacing: 1.5 }}>
            Not now
          </Link>
        </div>
      )}
    </main>
  );
}
