"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchMyLegalIdentity, updateLegalIdentity, type LegalIdentity as Identity } from "@/lib/profile/account";
import { dateOfBirthError, latestAdultBirthDate } from "@refee/core/identity/age";

/**
 * The legal name and birthday the ID check matches against. Editable until the
 * check is under way, so a typo can be fixed; read-only after (0067).
 */
export function LegalIdentity() {
  const [userId, setUserId] = useState<string | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [dob, setDob] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      const { identity: found } = await fetchMyLegalIdentity(session.user.id);
      if (!found) return;
      setIdentity(found);
      setFirst(found.legalFirstName);
      setLast(found.legalLastName);
      setDob(found.dateOfBirth);
    })();
  }, []);

  if (!identity) return null;

  const dobError = dob ? dateOfBirthError(dob) : null;

  const save = async () => {
    if (!userId || saving) return;
    setSaving(true);
    setMessage(null);
    const { error } = await updateLegalIdentity(userId, { legalFirstName: first, legalLastName: last, dateOfBirth: dob });
    setSaving(false);
    setMessage(error ? { ok: false, text: error.message } : { ok: true, text: "Saved." });
  };

  return (
    <section className="mt-8 border border-ink bg-chalk p-5">
      <h2 className="font-mono-bold text-xs uppercase">Legal name &amp; date of birth</h2>
      <p className="mt-2 text-xs leading-5 text-ink-60">
        {identity.locked
          ? "These match your verified ID, so they can't be changed here. Contact support if something is wrong."
          : "Private. Your ID check is matched against these, so they must match your ID exactly."}
      </p>

      {identity.locked ? (
        <p className="mt-4 font-mono text-sm">
          {identity.legalFirstName} {identity.legalLastName}
          <br />
          {identity.dateOfBirth}
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono-bold text-[10px] uppercase">Legal first name</span>
            <input
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              autoComplete="given-name"
              className="mt-2 w-full border border-ink bg-paper px-3 py-3 font-mono text-sm outline-none focus:border-signal"
            />
          </label>
          <label className="block">
            <span className="font-mono-bold text-[10px] uppercase">Legal last name</span>
            <input
              value={last}
              onChange={(e) => setLast(e.target.value)}
              autoComplete="family-name"
              className="mt-2 w-full border border-ink bg-paper px-3 py-3 font-mono text-sm outline-none focus:border-signal"
            />
          </label>
          <label className="block">
            <span className="font-mono-bold text-[10px] uppercase">Date of birth</span>
            <input
              type="date"
              value={dob}
              max={latestAdultBirthDate()}
              onChange={(e) => setDob(e.target.value)}
              autoComplete="bday"
              className="mt-2 w-full border border-ink bg-paper px-3 py-3 font-mono text-sm outline-none focus:border-signal"
            />
            {dobError ? <span className="mt-2 block text-xs text-foul">{dobError}</span> : null}
          </label>
          <div className="flex items-end">
            <button
              type="button"
              disabled={saving || !dob || !!dobError}
              onClick={() => void save()}
              className="bg-ink px-4 py-3 font-mono-bold text-[10px] uppercase text-paper disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {message ? <p className={`mt-3 text-sm ${message.ok ? "text-court" : "text-foul"}`}>{message.text}</p> : null}
    </section>
  );
}
