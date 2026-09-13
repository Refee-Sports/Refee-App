"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { ValueStrip } from "@/components/auth/ValueStrip";
import { ZebraRule } from "@/components/ui/ZebraRule";
import {
  fetchOAuthProviderAvailability,
  signInWithAppleOAuth,
  signInWithGoogleOAuth,
  type ProviderAvailability,
} from "@/lib/oauth";
import { getSupabaseSetupError, supabase } from "@/lib/supabase";

/**
 * Welcome — port of refee-mobile/refee/app/(auth)/welcome.tsx.
 *
 * Inverse palette: ink canvas + paper text + hi-vis accents. The three-cell
 * value strip is the entire pitch: 48H / 0% / YOU set rate.
 *
 * On phones this stacks — hero, then the sign-in block pinned to the bottom.
 * From `lg` up it becomes a full-bleed two-panel front door: the pitch on the
 * left, every way in on the right. Both give the same three choices, Google,
 * Apple and phone, because a ref might arrive on either.
 */
export default function WelcomePage() {
  const router = useRouter();
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<ProviderAvailability>({
    google: null,
    apple: null,
  });

  // Which social providers this project can actually complete a sign-in with.
  useEffect(() => {
    let cancelled = false;
    void fetchOAuthProviderAvailability().then((a) => {
      if (!cancelled) setAvailability(a);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const runOAuth = async (provider: "google" | "apple") => {
    const setupErr = getSupabaseSetupError();
    if (setupErr) {
      setOauthError(setupErr);
      return;
    }
    setOauthError(null);
    setOauthLoading(provider);
    const { error } =
      provider === "google" ? await signInWithGoogleOAuth() : await signInWithAppleOAuth();
    setOauthLoading(null);
    if (error) setOauthError(error.message);
  };

  const goToSignIn = async () => {
    await supabase.auth.signOut();
    router.push("/auth/sign-in");
  };

  return (
    <div className="flex min-h-screen flex-col bg-ink lg:grid lg:min-h-screen lg:grid-cols-[minmax(0,1.1fr)_minmax(430px,0.9fr)] lg:items-stretch">
      {/* ── Pitch ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:min-h-screen lg:justify-center">
        <ZebraRule variant="signal" noMargin />

        <div className="flex flex-1 flex-col px-6 pb-6 pt-10 lg:flex-none lg:px-14 lg:py-16 xl:px-20">
          {/* Live tag */}
          <div className="mb-4 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-hi-vis" />
            <span
              className="font-mono-bold text-[10px] uppercase text-hi-vis"
              style={{ letterSpacing: 2 }}
            >
              Called up · Live roster
            </span>
          </div>

          <h1
            className="font-display text-[64px] leading-[72px] text-paper lg:text-[80px] lg:leading-[80px] xl:text-[96px] xl:leading-[96px]"
            style={{ letterSpacing: -2.5 }}
          >
            REF<span className="text-signal-dark">EE</span>
            <br />
            EARN ON
            <br />
            YOUR <span className="text-signal-dark">CALL.</span>
          </h1>

          <p
            className="mb-8 mt-5 max-w-[280px] text-paper/70 lg:mb-10 lg:max-w-md lg:text-[17px] lg:leading-7"
            style={{ fontSize: 15, lineHeight: "22px" }}
          >
            The on-demand marketplace for officials. Find games, set your rate, get
            paid in 48 hours.
          </p>

          {/* Three-cell value strip */}
          <div className="mb-auto lg:mb-0">
            <ValueStrip size="hero" />
          </div>
        </div>
      </div>

      {/* ── Every way in ──────────────────────────────────────────────── */}
      <div
        className="border-t border-paper/15 bg-ink px-6 pt-4 lg:flex lg:min-h-screen lg:flex-col lg:justify-center lg:border-l lg:border-t-0 lg:px-12 lg:py-16 xl:px-16"
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
      >
        <div className="w-full lg:mx-auto lg:max-w-sm">
          {/* Desktop gets a heading; on phones the hero above is the heading. */}
          <div className="hidden lg:mb-8 lg:block">
            <h2
              className="font-display text-[34px] leading-none text-paper"
              style={{ letterSpacing: -1.2 }}
            >
              SIGN IN<span className="text-hi-vis">.</span>
            </h2>
            <p
              className="mt-2 font-mono text-[11px] uppercase text-paper/50"
              style={{ letterSpacing: 1.4 }}
            >
              New or returning · same account
            </p>
          </div>

          <SocialAuthButtons
            variant="welcome"
            loading={oauthLoading}
            onGoogle={() => runOAuth("google")}
            onApple={() => runOAuth("apple")}
            availability={availability}
          />

          {oauthError ? (
            <p
              className="mt-3 border border-foul/40 bg-foul/10 px-3 py-2.5 text-[12px] leading-5 text-foul"
              role="alert"
            >
              {oauthError}
            </p>
          ) : null}

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-paper/25" />
            <span
              className="font-mono-bold text-[10px] uppercase text-paper/45"
              style={{ letterSpacing: 3 }}
            >
              or phone
            </span>
            <span className="h-px flex-1 bg-paper/25" />
          </div>

          <button
            type="button"
            onClick={goToSignIn}
            className="mb-2.5 flex w-full items-center justify-center gap-2 bg-hi-vis py-5 text-ink hover:opacity-80"
          >
            <span className="font-mono-bold" style={{ fontSize: 13, letterSpacing: 2 }}>
              CONTINUE WITH PHONE
            </span>
            <span className="font-mono-bold text-base">→</span>
          </button>

          <button
            type="button"
            onClick={goToSignIn}
            className="w-full border border-paper/30 py-4 text-center text-paper hover:opacity-70"
          >
            <span
              className="font-mono-bold uppercase"
              style={{ fontSize: 11, letterSpacing: 2 }}
            >
              Already a ref? <span className="text-hi-vis">Sign in</span>
            </span>
          </button>

          <div className="mt-5 flex justify-between">
            <span
              className="font-mono-bold text-[9px] uppercase text-paper/40"
              style={{ letterSpacing: 1.5 }}
            >
              v0.1
            </span>
            <span
              className="font-mono-bold text-[9px] uppercase text-paper/40"
              style={{ letterSpacing: 1.5 }}
            >
              ● Built by officials
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
