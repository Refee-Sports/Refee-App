"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchMyLegalIdentity, updateLegalIdentity, type LegalIdentity as Identity } from "@/lib/profile/account";
import { dateOfBirthError, latestAdultBirthDate } from "@refee/core/identity/age";

/**
 * The legal name and birthday the ID check matches against. Both are open until
 * the check starts. Once verified, the name can still change once every 60 days
 * (a badly scanned ID, a nickname, a marriage) and the birthday is fixed (0068).
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

  const dobError = !identity.dobLocked && dob ? dateOfBirthError(dob) : null;
  const namesEditable = !identity.namesLocked && !identity.nextNameChangeAt;
  const nextChange = identity.nextNameChangeAt
    ? new Date(identity.nextNameChangeAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : null;
  const note = identity.namesLocked
    ? "Your ID is being reviewed, so these can't change until it's decided."
    : nextChange
      ? `Your ID is verified. You can change your name again on ${nextChange}. Your date of birth can only be changed by support.`
      : identity.verified
        ? "Your ID is verified. You can change your name once every 60 days. Your date of birth can only be changed by support."
        : "Private. Your ID check is matched against these, so they must match your ID exactly.";

  const save = async () => {
    if (!userId || saving) return;
    setSaving(true);
    setMessage(null);
    const { error } = await updateLegalIdentity(userId, {
      legalFirstName: first,
      legalLastName: last,
      dateOfBirth: identity.dobLocked ? identity.dateOfBirth : dob,
    });
    setSaving(false);
    setMessage(error ? { ok: false, text: error.message } : { ok: true, text: "Saved." });
    if (!error) {
      // A verified rename starts the 60-day wait; show it.
      const { identity: fresh } = await fetchMyLegalIdentity(userId);
      if (fresh) setIdentity(fresh);
    }
  };

  return (
    <section className="mt-8 border border-ink bg-chalk p-5">
      <h2 className="font-mono-bold text-xs uppercase">Legal name &amp; date of birth</h2>
      <p className="mt-2 text-xs leading-5 text-ink-60">{note}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono-bold text-[10px] uppercase">Legal first name</span>
          <input
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            readOnly={!namesEditable}
            autoComplete="given-name"
            className={`mt-2 w-full border border-ink px-3 py-3 font-mono text-sm outline-none focus:border-signal ${namesEditable ? "bg-paper" : "bg-chalk text-ink-60"}`}
          />
        </label>
        <label className="block">
          <span className="font-mono-bold text-[10px] uppercase">Legal last name</span>
          <input
            value={last}
            onChange={(e) => setLast(e.target.value)}
            readOnly={!namesEditable}
            autoComplete="family-name"
            className={`mt-2 w-full border border-ink px-3 py-3 font-mono text-sm outline-none focus:border-signal ${namesEditable ? "bg-paper" : "bg-chalk text-ink-60"}`}
          />
        </label>
        <label className="block">
          <span className="font-mono-bold text-[10px] uppercase">Date of birth</span>
          <input
            type="date"
            value={dob}
            max={latestAdultBirthDate()}
            onChange={(e) => setDob(e.target.value)}
            readOnly={identity.dobLocked}
            autoComplete="bday"
            className={`mt-2 w-full border border-ink px-3 py-3 font-mono text-sm outline-none focus:border-signal ${identity.dobLocked ? "bg-chalk text-ink-60" : "bg-paper"}`}
          />
          {dobError ? <span className="mt-2 block text-xs text-foul-ink">{dobError}</span> : null}
        </label>
        {namesEditable || !identity.dobLocked ? (
          <div className="flex items-end">
            <button
              type="button"
              disabled={saving || (!identity.dobLocked && (!dob || !!dobError))}
              onClick={() => void save()}
              className="bg-ink px-4 py-3 font-mono-bold text-[10px] uppercase text-paper disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        ) : null}
      </div>

      {message ? <p className={`mt-3 text-sm ${message.ok ? "text-court-ink" : "text-foul-ink"}`}>{message.text}</p> : null}
    </section>
  );
}
