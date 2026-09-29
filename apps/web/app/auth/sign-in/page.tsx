"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { Spinner } from "@/components/ui/AppButton";
import {
  fetchProviderAvailability,
  signInWithAppleOAuth,
  signInWithGoogleOAuth,
  type ProviderAvailability,
} from "@/lib/oauth";
import { getSupabaseConfig, isLocalSupabaseUrl } from "@/lib/supabase-config";
import { getSupabaseSetupError, supabase } from "@/lib/supabase";
import { isValidEmail, normalizeEmail, sendEmailCode } from "@/lib/auth/emailCode";
import { isDevelopment } from "@/lib/env";

/**
 * Apple, Google, or a one-time code emailed to you — no passwords, no SMS.
 * Web points at the same Supabase project as the app, so the same email is the
 * same account in both.
 */
export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<ProviderAvailability>({
    google: null,
    apple: null,
  });

  // Which social providers this project can actually complete a sign-in with.
  useEffect(() => {
    let cancelled = false;
    void fetchProviderAvailability().then((a) => {
      if (!cancelled) setAvailability(a);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { url: supabaseUrl } = getSupabaseConfig();
  const supabaseHost = supabaseUrl.replace(/^https?:\/\//, "");

  const canSubmit = isValidEmail(email);
  const oauthBusy = oauthLoading !== null;

  const runOAuth = async (provider: "google" | "apple") => {
    const setupErr = getSupabaseSetupError();
    if (setupErr) {
      setOauthError(setupErr);
      setError(null);
      return;
    }
    setOauthError(null);
    setError(null);
    setOauthLoading(provider);
    const result =
      provider === "google" ? await signInWithGoogleOAuth() : await signInWithAppleOAuth();
    setOauthLoading(null);
    if (result.error) setOauthError(result.error.message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || sending) return;
    setSending(true);
    setError(null);

    const setupErr = getSupabaseSetupError();
    if (setupErr) {
      setSending(false);
      setError(setupErr);
      return;
    }

    // Drop any stale session so the code signs in the account it was sent to.
    await supabase.auth.signOut();
    const { error: sendError } = await sendEmailCode(email);
    setSending(false);

    if (sendError) {
      setError(sendError.message);
      return;
    }
    router.push(`/auth/verify?email=${encodeURIComponent(normalizeEmail(email))}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <ScreenHeader
        backHref="/auth/welcome"
        title={
          <>
            <span className="text-ink">01</span> / 08
          </>
        }
      />

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <div className="flex-1">
          <div className="px-5 pb-4">
            <SocialAuthButtons
              variant="sign-in"
              loading={oauthLoading}
              onGoogle={() => runOAuth("google")}
              onApple={() => runOAuth("apple")}
              availability={availability}
            />
            {oauthError ? (
              <p className="mt-3 font-mono text-xs uppercase text-foul">{oauthError}</p>
            ) : null}
            <div className="mb-2 mt-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-ink/15" />
              <span
                className="font-mono-bold text-[9px] uppercase text-ink-60"
                style={{ letterSpacing: 2 }}
              >
                or use your email
              </span>
              <span className="h-px flex-1 bg-ink/15" />
            </div>
          </div>

          <div className="px-5">
            <p
              className="mb-3 mt-2 font-mono-bold text-[10px] uppercase text-signal"
              style={{ letterSpacing: 2 }}
            >
              Email · Step 1
            </p>
            <h1
              className="font-display text-ink"
              style={{ fontSize: 40, lineHeight: "46px", letterSpacing: -1.5 }}
            >
              ENTER YOUR
              <br />
              <span className="text-signal">EMAIL.</span>
            </h1>
            <p className="mb-6 mt-3 text-ink-80" style={{ fontSize: 14, lineHeight: "20px" }}>
              We&apos;ll email you a 6-digit code. No passwords. New here? The same code creates
              your account — and it&apos;s the same account as the Refee app.
            </p>

            {isDevelopment && supabaseHost ? (
              <p
                className="mb-4 font-mono text-[9px] uppercase text-ink-40"
                style={{ letterSpacing: 1.2 }}
              >
                DEV · API {supabaseHost}
                {isLocalSupabaseUrl(supabaseUrl)
                  ? " · LOCAL — CODES ARRIVE AT http://127.0.0.1:54324"
                  : " · HOSTED"}
              </p>
            ) : null}

            <label className="field-label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={oauthBusy}
              autoFocus
              className="w-full border-[1.5px] border-ink bg-chalk px-4 py-3.5 font-mono text-ink outline-none placeholder:text-ink-40"
              style={{ fontSize: 14 }}
            />

            {error && (
              <p className="mt-3 font-mono text-xs uppercase text-foul" role="alert">
                {error}
              </p>
            )}

            <p
              className="mt-4 font-mono text-[9px] uppercase text-ink-60"
              style={{ letterSpacing: 1.4 }}
            >
              By continuing you agree to Refee&apos;s{" "}
              <a href="/terms" className="underline">terms</a>{" "}&amp;{" "}
              <a href="/privacy" className="underline">privacy policy</a>.
            </p>
          </div>
        </div>

        <div className="action-bar sticky bottom-0">
          <button
            type="submit"
            disabled={!canSubmit || sending || oauthBusy}
            className={`flex w-full items-center justify-center gap-2 py-4 ${
              canSubmit && !sending && !oauthBusy
                ? "bg-ink text-paper hover:opacity-80"
                : "cursor-not-allowed bg-ink-20 text-ink-40"
            }`}
          >
            {sending ? (
              <Spinner />
            ) : (
              <>
                <span className="font-mono-bold" style={{ fontSize: 12, letterSpacing: 2.5 }}>
                  EMAIL ME A CODE
                </span>
                <span className="font-mono-bold text-base">→</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
