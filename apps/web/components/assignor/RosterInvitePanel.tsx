"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/AppButton";
import { QrSvg } from "@/components/assignor/QrSvg";
import {
  fetchMyRosterInviteCode,
  inviteToRosterByEmail,
  parseEmails,
  rosterInviteLink,
  rotateRosterInviteCode,
  sendRosterBlast,
  sendRosterEmailInvites,
  type EmailInviteResult,
} from "@/lib/assignor/queries";
import { readEmailFile, siteOrigin } from "@/lib/roster/files";

const RESULT_LABEL: Record<EmailInviteResult["result"], string> = {
  invited: "Invited — already on Refee",
  pending: "Will be invited when they sign up",
  invalid: "Not a valid email",
  self: "That's you",
  already_on_roster: "Already on your roster",
};

const MAX_BLAST = 1000;

/**
 * How an assignor grows and talks to their roster: a QR code / join link,
 * invites by email (typed or CSV), and one-way announcements.
 */
export function RosterInvitePanel({ onChanged }: { onChanged?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [text, setText] = useState("");
  const [inviting, setInviting] = useState(false);
  const [results, setResults] = useState<EmailInviteResult[] | null>(null);
  const [emailNote, setEmailNote] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [blast, setBlast] = useState("");
  const [sending, setSending] = useState(false);
  const [blastNote, setBlastNote] = useState<string | null>(null);
  const [blastError, setBlastError] = useState<string | null>(null);

  const loadCode = useCallback(async () => {
    const { code: c, error } = await fetchMyRosterInviteCode();
    setCode(c);
    setCodeError(error?.message ?? null);
  }, []);

  useEffect(() => {
    void loadCode();
  }, [loadCode]);

  const link = code ? rosterInviteLink(code, siteOrigin()) : null;
  const emails = parseEmails(text);

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", link);
    }
  };

  const rotate = async () => {
    if (
      !window.confirm(
        "Make a new code?\n\nThe current QR code and code stop working. Referees already on your roster stay on it."
      )
    ) {
      return;
    }
    const { code: c, error } = await rotateRosterInviteCode();
    if (error) setCodeError(error.message);
    else setCode(c);
  };

  const importFile = async (file: File | null) => {
    if (!file) return;
    setEmailError(null);
    try {
      const found = parseEmails(await readEmailFile(file));
      if (found.length === 0) {
        setEmailError("That file doesn't contain any email addresses.");
        return;
      }
      setText((current) => [...new Set([...parseEmails(current), ...found])].join("\n"));
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "Couldn't read that file.");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const invite = async () => {
    if (emails.length === 0 || inviting) return;
    setInviting(true);
    setEmailError(null);
    setEmailNote(null);
    const { results: r, error } = await inviteToRosterByEmail(emails);
    if (error) {
      setInviting(false);
      setEmailError(error.message);
      return;
    }
    setResults(r);
    setText("");
    onChanged?.();

    const pending = r.filter((x) => x.result === "pending").map((x) => x.email);
    if (pending.length > 0) {
      await fetchMyRosterInviteCode(); // make sure the code the email links to exists
      const mail = await sendRosterEmailInvites(pending);
      if (mail.error) setEmailNote("Their invites are saved, but the emails couldn't be sent. Share your QR link with them.");
      else if (!mail.configured) setEmailNote("Their invites are saved, but email sending isn't set up yet. Share your QR link with them.");
      else setEmailNote(`Emailed ${mail.sent} ${mail.sent === 1 ? "person" : "people"} who aren't on Refee yet.`);
    }
    setInviting(false);
  };

  const announce = async () => {
    if (blast.trim().length === 0 || sending) return;
    if (
      !window.confirm(
        "Send to your whole roster?\n\nEvery referee on your roster gets this as a notification. They can read it but can't reply."
      )
    ) {
      return;
    }
    setSending(true);
    setBlastError(null);
    setBlastNote(null);
    const { recipientIds, error } = await sendRosterBlast(blast);
    setSending(false);
    if (error) {
      setBlastError(error.message);
      return;
    }
    setBlast("");
    setBlastNote(`Sent to ${recipientIds.length} ${recipientIds.length === 1 ? "referee" : "referees"}.`);
  };

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-3">
      {/* QR / code */}
      <section className="border border-ink bg-chalk p-5">
        <h2 className="font-mono-bold text-[9px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
          Scan to join
        </h2>
        <div className="mt-3 flex flex-col items-center">
          {code && link ? (
            <>
              <QrSvg value={link} size={180} />
              <p className="mt-3 font-display text-ink" style={{ fontSize: 28, letterSpacing: 4 }}>
                {code}
              </p>
              <p className="mt-1 text-center font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
                Referees scan this or type the code in Refee. Anyone with it joins your roster.
              </p>
              <div className="mt-3 flex w-full gap-2">
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="flex-1 bg-ink py-2.5 font-mono-bold text-[10px] uppercase text-paper hover:opacity-80"
                  style={{ letterSpacing: 1.5 }}
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={() => void rotate()}
                  className="flex-1 border border-ink py-2.5 font-mono-bold text-[10px] uppercase text-ink hover:bg-ink hover:text-paper"
                  style={{ letterSpacing: 1.5 }}
                >
                  New code
                </button>
              </div>
            </>
          ) : codeError ? (
            <p className="font-mono text-[10px] uppercase text-foul">{codeError}</p>
          ) : (
            <span className="py-10 text-signal"><Spinner /></span>
          )}
        </div>
      </section>

      {/* Email */}
      <section className="border border-ink bg-chalk p-5">
        <h2 className="font-mono-bold text-[9px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
          Invite by email
        </h2>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResults(null);
          }}
          placeholder={"jordan@example.com\nsam@example.com"}
          aria-label="Email addresses to invite"
          rows={5}
          className="mt-3 w-full border border-ink bg-paper px-3 py-2 font-mono text-[12px] text-ink outline-none"
        />
        <p className="mt-1 font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
          Paste or type addresses, separated by commas or new lines.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            data-testid="email-csv-input"
            onChange={(e) => void importFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 border border-ink py-2.5 font-mono-bold text-[10px] uppercase text-ink hover:bg-ink hover:text-paper"
            style={{ letterSpacing: 1.5 }}
          >
            Import CSV
          </button>
          <button
            type="button"
            onClick={() => void invite()}
            disabled={emails.length === 0 || inviting}
            className={`flex flex-1 items-center justify-center py-2.5 font-mono-bold text-[10px] uppercase ${
              emails.length > 0 && !inviting ? "bg-ink text-paper hover:opacity-80" : "cursor-not-allowed bg-ink-20 text-ink-40"
            }`}
            style={{ letterSpacing: 1.5 }}
          >
            {inviting ? <Spinner /> : emails.length > 0 ? `Invite ${emails.length}` : "Invite"}
          </button>
        </div>
        {emailError ? <p className="mt-2 font-mono text-[10px] uppercase text-foul" role="alert">{emailError}</p> : null}
        {results ? (
          <ul className="mt-3 max-h-48 overflow-auto border border-ink-20">
            {results.map((r) => (
              <li key={r.email} className="border-b border-ink-20 px-3 py-2 last:border-b-0">
                <span className="block truncate font-mono-bold text-[10px] text-ink">{r.email}</span>
                <span
                  className={`block font-mono text-[8px] uppercase ${r.result === "invalid" || r.result === "self" ? "text-foul" : "text-ink-60"}`}
                  style={{ letterSpacing: 1 }}
                >
                  {RESULT_LABEL[r.result]}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {emailNote ? <p className="mt-2 font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>{emailNote}</p> : null}
      </section>

      {/* Announcement */}
      <section className="border border-ink bg-chalk p-5">
        <h2 className="font-mono-bold text-[9px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
          Announce to your roster
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-ink-80">
          A one-way notification to every referee on your roster. They see it in their inbox and can&apos;t reply.
        </p>
        <textarea
          value={blast}
          onChange={(e) => setBlast(e.target.value.slice(0, MAX_BLAST))}
          placeholder="What do your referees need to know?"
          aria-label="Announcement"
          rows={5}
          className="mt-3 w-full border border-ink bg-paper px-3 py-2 text-[14px] text-ink outline-none"
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
            {blast.length} / {MAX_BLAST}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void announce()}
          disabled={blast.trim().length === 0 || sending}
          className={`mt-2 flex w-full items-center justify-center py-2.5 font-mono-bold text-[10px] uppercase ${
            blast.trim().length > 0 && !sending ? "bg-ink text-paper hover:opacity-80" : "cursor-not-allowed bg-ink-20 text-ink-40"
          }`}
          style={{ letterSpacing: 1.5 }}
        >
          {sending ? <Spinner /> : "Send announcement"}
        </button>
        {blastError ? <p className="mt-2 font-mono text-[10px] uppercase text-foul" role="alert">{blastError}</p> : null}
        {blastNote ? <p className="mt-2 font-mono text-[10px] uppercase text-court">{blastNote}</p> : null}
      </section>
    </div>
  );
}
