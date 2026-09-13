"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { Spinner } from "@/components/ui/AppButton";
import {
  fetchOAuthProviderAvailability,
  signInWithAppleOAuth,
  signInWithGoogleOAuth,
  type ProviderAvailability,
} from "@/lib/oauth";
import {
  canReceiveSmsLocally,
  getSupabaseConfig,
  isLocalSupabaseUrl,
} from "@/lib/supabase-config";
import { getSupabaseSetupError, supabase } from "@/lib/supabase";
import { isDevelopment } from "@/lib/env";

/**
 * Phone-first auth — port of refee-mobile/refee/app/(auth)/sign-in.tsx.
 * No passwords; Supabase Auth handles the SMS OTP, and because web points at
 * the same project, the same phone number is the same account as in the app.
 */
export default function SignInPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
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
  const [error, setError] = useState<string | null>(null);

  const { url: supabaseUrl } = getSupabaseConfig();
  const supabaseHost = supabaseUrl.replace(/^https?:\/\//, "");

  // Format phone as the user types: (512) 555-8429
  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const isValidPhone = phone.replace(/\D/g, "").length === 10;
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
    if (!isValidPhone) return;
    setPhoneLoading(true);
    setError(null);

    const setupErr = getSupabaseSetupError();
    if (setupErr) {
      setPhoneLoading(false);
      setError(setupErr);
      return;
    }

    const e164 = "+1" + phone.replace(/\D/g, "");

    // Local Supabase accepts any number and returns 200, but only actually
    // delivers a code to its test numbers. Say so here rather than sending
    // someone to the verify screen to wait for an SMS that never went out.
    if (isLocalSupabaseUrl(supabaseUrl) && !canReceiveSmsLocally(e164)) {
      setPhoneLoading(false);
      setError(
        "This is the local Supabase stack, which has no SMS provider — a real number can't receive a code here. Use (555) 555-0100 with code 123456, or point NEXT_PUBLIC_SUPABASE_URL at the hosted project to use your own number."
      );
      return;
    }

    // Drop a stale JWT so the OTP attaches to the phone user, not a ghost account.
    await supabase.auth.signOut();
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: e164 });

    setPhoneLoading(false);

    if (otpError) {
      const raw = otpError.message ?? "";
      const networkLike = /network request failed|failed to fetch|fetch/i.test(raw);
      const unsupportedProvider = /unsupported phone provider/i.test(raw);
      const isLocalSupabase = isLocalSupabaseUrl(supabaseUrl);
      setError(
        networkLike
          ? "Can't reach Supabase. Confirm NEXT_PUBLIC_SUPABASE_URL is your project URL and you're online, then reload."
          : unsupportedProvider && isLocalSupabase
            ? "Local Supabase phone auth is off. Run supabase start with phone auth enabled, then use (555) 555-0100 and OTP 123456."
            : unsupportedProvider
              ? "Supabase needs an SMS provider. Dashboard → Authentication → Phone + Twilio."
              : raw
      );
      return;
    }

    router.push(
      `/auth/verify?phone=${encodeURIComponent(e164)}&formattedPhone=${encodeURIComponent(phone)}`
    );
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
                or phone
              </span>
              <span className="h-px flex-1 bg-ink/15" />
            </div>
          </div>

          <div className="px-5">
            <p
              className="mb-3 mt-2 font-mono-bold text-[10px] uppercase text-signal"
              style={{ letterSpacing: 2 }}
            >
              Phone · Step 1
            </p>
            <h1
              className="font-display text-ink"
              style={{ fontSize: 40, lineHeight: "46px", letterSpacing: -1.5 }}
            >
              ENTER YOUR
              <br />
              <span className="text-signal">NUMBER.</span>
            </h1>
            <p className="mb-6 mt-3 text-ink-80" style={{ fontSize: 14, lineHeight: "20px" }}>
              We&apos;ll text you a 6-digit code. No passwords. You sign in the same
              way on every new device — and it&apos;s the same account as the Refee app.
            </p>

            {isDevelopment && supabaseHost ? (
              <p
                className="mb-4 font-mono text-[9px] uppercase text-ink-40"
                style={{ letterSpacing: 1.2 }}
              >
                DEV · API {supabaseHost}
                {isLocalSupabaseUrl(supabaseUrl) ? " · LOCAL" : " · HOSTED"}
              </p>
            ) : null}

            <label className="field-label" htmlFor="phone">
              Phone number
            </label>
            <div className="flex border-[1.5px] border-ink">
              <span className="flex items-center bg-ink px-4">
                <span
                  className="font-mono-bold text-base text-paper"
                  style={{ letterSpacing: 0.5 }}
                >
                  +1
                </span>
              </span>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(512) 555-8429"
                disabled={oauthBusy}
                maxLength={14}
                autoFocus
                className="min-w-0 flex-1 bg-chalk px-4 py-3.5 font-mono text-ink outline-none placeholder:text-ink-40"
                style={{ fontSize: 14 }}
              />
            </div>

            {error && <p className="mt-3 font-mono text-xs uppercase text-foul">{error}</p>}

            <p
              className="mt-4 font-mono text-[9px] uppercase text-ink-60"
              style={{ letterSpacing: 1.4 }}
            >
              By continuing you agree to Refee&apos;s terms &amp; privacy policy.
            </p>
          </div>
        </div>

        {/* Sticky bottom action */}
        <div className="action-bar sticky bottom-0">
          <button
            type="submit"
            disabled={!isValidPhone || phoneLoading || oauthBusy}
            className={`flex w-full items-center justify-center gap-2 py-4 ${
              isValidPhone && !phoneLoading && !oauthBusy
                ? "bg-ink text-paper hover:opacity-80"
                : "cursor-not-allowed bg-ink-20 text-ink-40"
            }`}
          >
            {phoneLoading ? (
              <Spinner />
            ) : (
              <>
                <span className="font-mono-bold" style={{ fontSize: 12, letterSpacing: 2.5 }}>
                  SEND CODE
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
