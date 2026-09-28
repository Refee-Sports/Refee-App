"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { supabase } from "@/lib/supabase";
import {
  deleteMyAccount,
  fetchLinkedAccountMethods,
  type AccountProvider,
  type LinkedAccountMethod,
} from "@/lib/account/queries";
import { linkOAuthIdentity } from "@/lib/oauth";

export default function AccountPage() {
  const router = useRouter();
  const [methods, setMethods] = useState<LinkedAccountMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<AccountProvider | "delete" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const result = await fetchLinkedAccountMethods();
      setLoading(false);
      if (result.error) setError(result.error.message);
      else setMethods(result.methods);
    })();
  }, []);

  const link = async (provider: "google" | "apple") => {
    setBusy(provider);
    setError(null);
    const result = await linkOAuthIdentity(provider);
    if (result.error) {
      setError(result.error.message);
      setBusy(null);
    }
  };

  const removeAccount = async () => {
    if (confirmation !== "DELETE") return;
    setBusy("delete");
    setError(null);
    const result = await deleteMyAccount(confirmation);
    if (result.error) {
      setError(result.error.message);
      setBusy(null);
      return;
    }
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/auth/welcome");
  };

  const linked = new Set(methods.map((method) => method.provider));

  return (
    <main className="min-h-screen bg-paper px-5 py-6 text-ink sm:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between border-b border-ink pb-4">
          <Wordmark className="text-[28px]" />
          <button type="button" onClick={() => router.back()} className="font-mono-bold text-[10px] uppercase underline">
            Back to profile
          </button>
        </div>

        <h1 className="mt-8 font-display text-4xl uppercase">
          Account &amp; sign-in<span className="text-signal">.</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-ink-70">
          Link more than one sign-in method to the same Refee profile. Start linking while signed in here—using a new provider from the welcome screen can create a separate account.
        </p>

        <section className="mt-8 border border-ink bg-chalk p-5">
          <h2 className="font-mono-bold text-xs uppercase">Linked methods</h2>
          <div className="mt-4 space-y-2">
            {loading ? <p className="text-sm text-ink-60">Loading…</p> : null}
            {methods.map((method) => (
              <div key={method.provider} className="flex items-center justify-between border-b border-ink-20 py-3 last:border-0">
                <span className="font-mono text-xs uppercase">{method.label}</span>
                <span className="font-mono-bold text-[10px] uppercase text-court">Linked ✓</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {!linked.has("google") ? (
              <button type="button" disabled={busy !== null} onClick={() => void link("google")} className="border border-ink px-4 py-3 font-mono-bold text-[10px] uppercase disabled:opacity-50">
                {busy === "google" ? "Linking…" : "Link Google"}
              </button>
            ) : null}
            {!linked.has("apple") ? (
              <button type="button" disabled={busy !== null} onClick={() => void link("apple")} className="border border-ink px-4 py-3 font-mono-bold text-[10px] uppercase disabled:opacity-50">
                {busy === "apple" ? "Linking…" : "Link Apple"}
              </button>
            ) : null}
          </div>
        </section>

        {error ? <p className="mt-4 border border-foul bg-foul/10 p-3 text-sm text-foul">{error}</p> : null}

        <section className="mt-10 border border-foul p-5">
          <h2 className="font-mono-bold text-xs uppercase text-foul">Delete account</h2>
          <p className="mt-3 text-sm leading-6 text-ink-70">
            This permanently removes your sign-in, profile, verification data, avatar, roles and device tokens. Historical transaction records may be retained in anonymized form. Active games or unresolved payments must be handled first.
          </p>
          <label className="mt-5 block font-mono-bold text-[10px] uppercase" htmlFor="delete-confirmation">
            Type DELETE to confirm
          </label>
          <input
            id="delete-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            className="mt-2 w-full border border-ink bg-paper px-3 py-3 font-mono text-sm outline-none focus:border-foul"
          />
          <button
            type="button"
            disabled={confirmation !== "DELETE" || busy !== null}
            onClick={() => void removeAccount()}
            className="mt-4 bg-foul px-5 py-3 font-mono-bold text-[10px] uppercase text-paper disabled:opacity-40"
          >
            {busy === "delete" ? "Deleting…" : "Permanently delete account"}
          </button>
        </section>
      </div>
    </main>
  );
}
