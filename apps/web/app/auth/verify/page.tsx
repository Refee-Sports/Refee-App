"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Spinner } from "@/components/ui/AppButton";
import {
  EMAIL_CODE_LENGTH,
  cleanCode,
  maskEmail,
  sendEmailCode,
  verifyEmailCode,
} from "@/lib/auth/emailCode";

const RESEND_SECONDS = 60;

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <VerifyInner />
    </Suspense>
  );
}

function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const handleVerify = useCallback(
    async (entered: string) => {
      setLoading(true);
      setError(null);
      setNotice(null);
      const { error: verifyError } = await verifyEmailCode(email, entered);
      setLoading(false);
      if (verifyError) {
        setError(verifyError.message);
        setCode("");
        inputRef.current?.focus();
      }
      // RouteGate routes to onboarding or the right app automatically.
    },
    [email]
  );

  // Auto-submit when all digits are entered.
  useEffect(() => {
    if (code.length === EMAIL_CODE_LENGTH) void handleVerify(code);
  }, [code, handleVerify]);

  const handleResend = async () => {
    if (secondsLeft > 0) return;
    setError(null);
    const { error: sendError } = await sendEmailCode(email);
    if (sendError) {
      setError(sendError.message);
      return;
    }
    setNotice("New code sent.");
    setSecondsLeft(RESEND_SECONDS);
  };

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
          <span className="text-signal">EMAIL.</span>
        </h1>
        <p className="mb-7 mt-3 text-ink-80" style={{ fontSize: 14, lineHeight: "20px" }}>
          We sent a 6-digit code to <span className="font-body-bold text-ink">{maskEmail(email)}</span>.
          It can take a minute — check spam if it isn&apos;t there.
        </p>

        {/* Code cells — a hidden input captures typing/paste, cells are visual */}
        <div className="relative">
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(cleanCode(e.target.value))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={EMAIL_CODE_LENGTH + 4}
            aria-label="Verification code"
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          />
          <div className="flex justify-between gap-1.5">
            {Array.from({ length: EMAIL_CODE_LENGTH }).map((_, i) => {
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
          <p className="mt-3 text-center font-mono text-xs uppercase text-foul" role="alert">
            {error}
          </p>
        )}
        {notice && !error && (
          <p className="mt-3 text-center font-mono text-xs uppercase text-court">{notice}</p>
        )}

        <div className="mt-6 flex items-center justify-between border-b border-t border-ink-20 py-3">
          {secondsLeft > 0 ? (
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
            Wrong email?
          </button>
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
