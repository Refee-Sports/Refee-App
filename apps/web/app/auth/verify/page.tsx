"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Spinner } from "@/components/ui/AppButton";
import { supabase } from "@/lib/supabase";

const CODE_LENGTH = 6;

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <VerifyInner />
    </Suspense>
  );
}

/** Port of refee-mobile/refee/app/(auth)/verify.tsx. */
function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const phone = params.get("phone") ?? "";
  const formattedPhone = params.get("formattedPhone") ?? "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [resendDisabled, setResendDisabled] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const startCountdown = useCallback(() => {
    setSecondsLeft(60);
    setResendDisabled(true);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!resendDisabled) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setResendDisabled(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendDisabled]);

  const handleVerify = useCallback(
    async (otpCode: string) => {
      setLoading(true);
      setError(null);

      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token: otpCode,
        type: "sms",
      });

      setLoading(false);

      if (verifyError) {
        setError("That code didn't work. Try again.");
        setCode("");
        inputRef.current?.focus();
        return;
      }
      // RouteGate routes to onboarding or the right app automatically.
    },
    [phone]
  );

  // Auto-submit when 6 digits are entered
  useEffect(() => {
    if (code.length === CODE_LENGTH) void handleVerify(code);
  }, [code, handleVerify]);

  const handleResend = async () => {
    startCountdown();
    await supabase.auth.signInWithOtp({ phone });
  };

  // Mask phone for display: (512) ••• 8429
  const maskedPhone = formattedPhone
    ? `(${formattedPhone.slice(1, 4)}) ••• ${formattedPhone.slice(-4)}`
    : phone;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <ScreenHeader
        backHref="/auth/sign-in"
        title={
          <>
            <span className="text-ink">02</span> / 08
          </>
        }
      />

      <div className="flex-1 px-5 pb-6">
        <p
          className="mb-3 mt-4 font-mono-bold text-[10px] uppercase text-signal"
          style={{ letterSpacing: 2 }}
        >
          Verify · Step 2
        </p>
        <h1
          className="font-display text-ink"
          style={{ fontSize: 40, lineHeight: "46px", letterSpacing: -1.5 }}
        >
          CHECK YOUR
          <br />
          <span className="text-signal">PHONE.</span>
        </h1>
        <p className="mb-7 mt-3 text-ink-80" style={{ fontSize: 14, lineHeight: "20px" }}>
          We sent a 6-digit code to{" "}
          <span className="font-body-bold text-ink">+1 {maskedPhone}</span>.
        </p>

        {/* OTP cells — a hidden input captures typing/paste, cells are visual */}
        <div className="relative">
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            aria-label="Verification code"
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          />
          <div className="flex justify-between gap-1.5">
            {Array.from({ length: CODE_LENGTH }).map((_, i) => {
              const filled = !!code[i];
              const active = i === code.length;
              return (
                <div
                  key={i}
                  className={`flex aspect-square flex-1 items-center justify-center border-[1.5px] border-ink ${
                    filled ? "bg-ink" : "bg-chalk"
                  }`}
                >
                  <span
                    className={`font-display ${filled ? "text-paper" : "text-ink"}`}
                    style={{ fontSize: 26, letterSpacing: -1 }}
                  >
                    {code[i] ?? (active ? "_" : "")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <p className="mt-3 text-center font-mono text-xs uppercase text-foul">{error}</p>
        )}

        {/* Resend row */}
        <div className="mt-6 flex items-center justify-between border-b border-t border-ink-20 py-3">
          {resendDisabled ? (
            <span
              className="font-mono-bold text-[11px] uppercase text-ink-60"
              style={{ letterSpacing: 1.5 }}
            >
              Resend in{" "}
              <span className="text-ink">0:{secondsLeft.toString().padStart(2, "0")}</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="font-mono-bold text-[11px] uppercase text-signal underline"
              style={{ letterSpacing: 1.5 }}
            >
              Resend code
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push("/auth/sign-in")}
            className="font-mono-bold text-[11px] uppercase text-signal underline"
            style={{ letterSpacing: 1.5 }}
          >
            Wrong number?
          </button>
        </div>

        {/* Why-phone-first explainer */}
        <div className="mt-6 flex gap-2.5 border border-dashed border-ink-40 p-3.5">
          <span className="font-mono text-base text-signal">▸</span>
          <div className="flex-1">
            <p
              className="mb-1 font-mono-bold text-[9px] uppercase text-ink"
              style={{ letterSpacing: 2 }}
            >
              Why phone first?
            </p>
            <p className="text-[11px] text-ink-80" style={{ lineHeight: "16px" }}>
              No passwords. We text you a code each time you sign in on a new
              device. Refs verify each other are real humans.
            </p>
          </div>
        </div>

        {loading && (
          <div className="mt-6 flex flex-col items-center text-signal">
            <Spinner />
            <span
              className="mt-2 font-mono-bold text-[10px] uppercase text-ink-60"
              style={{ letterSpacing: 2 }}
            >
              Verifying...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
