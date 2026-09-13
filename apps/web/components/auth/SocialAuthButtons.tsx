"use client";

import { Spinner } from "@/components/ui/AppButton";
import type { OAuthProvider, ProviderAvailability } from "@/lib/oauth";

type Props = {
  variant: "welcome" | "sign-in";
  loading: OAuthProvider | null;
  onGoogle: () => void;
  onApple: () => void;
  /**
   * Which providers this Supabase project has credentials for. Omit (or leave
   * a provider `null`) while it's still unknown — the button stays enabled.
   */
  availability?: ProviderAvailability;
};

/** Port of the app's components/auth/SocialAuthButtons. */
export function SocialAuthButtons({
  variant,
  loading,
  onGoogle,
  onApple,
  availability,
}: Props) {
  const busy = loading !== null;
  const onWelcome = variant === "welcome";
  const googleBorder = onWelcome ? "border border-paper/25" : "border border-ink/25";
  const noteColor = onWelcome ? "text-paper/45" : "text-ink-40";

  const unavailable = (p: OAuthProvider) => availability?.[p] === false;
  const anyUnavailable = unavailable("google") || unavailable("apple");

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={onGoogle}
        disabled={busy}
        aria-describedby={unavailable("google") ? "social-auth-note" : undefined}
        className={`flex items-center justify-center gap-2 bg-chalk py-4 text-ink disabled:opacity-60 ${googleBorder} hover:opacity-80 ${
          unavailable("google") ? "opacity-50" : ""
        }`}
      >
        {loading === "google" ? (
          <Spinner />
        ) : (
          <span
            className="font-mono-bold uppercase"
            style={{ fontSize: 11, letterSpacing: 2 }}
          >
            Continue with Google
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onApple}
        disabled={busy}
        aria-describedby={unavailable("apple") ? "social-auth-note" : undefined}
        className={`flex items-center justify-center gap-2 bg-black py-4 text-white hover:opacity-80 disabled:opacity-60 ${
          unavailable("apple") ? "opacity-50" : ""
        }`}
      >
        {loading === "apple" ? (
          <Spinner />
        ) : (
          <span
            className="font-mono-bold uppercase"
            style={{ fontSize: 11, letterSpacing: 2 }}
          >
            Continue with Apple
          </span>
        )}
      </button>

      {anyUnavailable ? (
        <p
          id="social-auth-note"
          className={`font-mono text-[9px] uppercase ${noteColor}`}
          style={{ letterSpacing: 1.2 }}
        >
          {unavailable("google") && unavailable("apple")
            ? "Social sign-in not configured here — use phone"
            : `${unavailable("google") ? "Google" : "Apple"} sign-in not configured here — use phone`}
        </p>
      ) : null}
    </div>
  );
}
