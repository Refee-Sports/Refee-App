"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cleanCode, confirmEmailChange, EMAIL_CODE_LENGTH, requestEmailChange } from "@/lib/auth/emailCode";

/** Shows the account's email and moves it to a new address with a 6-digit code. */
export function ChangeEmail() {
  const [current, setCurrent] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "enter" | "code">("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setCurrent(data.user?.email ?? null));
  }, []);

  const send = async () => {
    setBusy(true);
    setError(null);
    const result = await requestEmailChange(email);
    setBusy(false);
    if (result.error) setError(result.error.message);
    else setStep("code");
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = await confirmEmailChange(email, code);
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    const { data } = await supabase.auth.getUser();
    setCurrent(data.user?.email ?? email);
    setStep("idle");
    setEmail("");
    setCode("");
    setDone(true);
  };

  return (
    <section className="mt-8 border border-ink bg-chalk p-5">
      <h2 className="font-mono-bold text-xs uppercase">Email</h2>
      <p className="mt-3 font-mono text-sm">{current ?? "No email on this account"}</p>
      {done ? <p className="mt-2 text-sm text-court-ink">Email updated. Use it next time you sign in with a code.</p> : null}

      {step === "idle" ? (
        <button
          type="button"
          onClick={() => {
            setStep("enter");
            setDone(false);
          }}
          className="mt-4 border border-ink px-4 py-3 font-mono-bold text-[10px] uppercase"
        >
          Change email
        </button>
      ) : null}

      {step === "enter" ? (
        <div className="mt-4">
          <label className="block font-mono-bold text-[10px] uppercase" htmlFor="new-email">
            New email
          </label>
          <input
            id="new-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full border border-ink bg-paper px-3 py-3 font-mono text-sm outline-none focus:border-signal"
          />
          <p className="mt-2 text-xs leading-5 text-ink-60">
            We&apos;ll send a code to the new address. Your old address gets a notice once the change goes through.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={busy || !email}
              onClick={() => void send()}
              className="bg-ink px-4 py-3 font-mono-bold text-[10px] uppercase text-paper disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send code"}
            </button>
            <button type="button" onClick={() => setStep("idle")} className="px-2 font-mono-bold text-[10px] uppercase underline">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {step === "code" ? (
        <div className="mt-4">
          <label className="block font-mono-bold text-[10px] uppercase" htmlFor="email-code">
            Code sent to {email.trim().toLowerCase()}
          </label>
          <input
            id="email-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(cleanCode(event.target.value))}
            className="mt-2 w-40 border border-ink bg-paper px-3 py-3 font-mono text-lg tracking-[0.3em] outline-none focus:border-signal"
          />
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={busy || code.length !== EMAIL_CODE_LENGTH}
              onClick={() => void confirm()}
              className="bg-ink px-4 py-3 font-mono-bold text-[10px] uppercase text-paper disabled:opacity-40"
            >
              {busy ? "Checking…" : "Confirm new email"}
            </button>
            <button type="button" onClick={() => setStep("enter")} className="px-2 font-mono-bold text-[10px] uppercase underline">
              Use a different email
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-4 border border-foul bg-foul/10 p-3 text-sm text-foul-ink">{error}</p> : null}
    </section>
  );
}
