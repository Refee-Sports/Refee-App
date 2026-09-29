"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Spinner } from "@/components/ui/AppButton";
import { Icon } from "@/components/ui/Icon";
import { useFocusEffect } from "@/hooks/useFocusEffect";
import { supabase } from "@/lib/supabase";
import {
  backgroundCheckFileError,
  backgroundCheckLabel,
  backgroundCheckState,
  BACKGROUND_CHECK_MIME_TYPES,
  fetchMyBackgroundCheck,
  getBackgroundCheckUrl,
  removeBackgroundCheck,
  uploadBackgroundCheck,
  type BackgroundCheckRow,
} from "@/lib/referee/backgroundCheck";

const STATE_STYLE = {
  none: { box: "border-ink-20 bg-chalk", text: "text-ink-60", title: "No background check on file" },
  valid: { box: "border-court bg-court/10", text: "text-court", title: "Background check current" },
  expiring: { box: "border-ink bg-hivis", text: "text-ink", title: "Expiring soon" },
  expired: { box: "border-foul bg-foul/10", text: "text-foul", title: "Background check expired" },
} as const;

/**
 * Referees upload their background check (PDF or photo). It counts for one year
 * from the upload date. Directors and assignors see whether it's current —
 * never the document.
 */
export default function BackgroundCheckPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [check, setCheck] = useState<BackgroundCheckRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }
    setUserId(session.user.id);
    const result = await fetchMyBackgroundCheck(session.user.id);
    setCheck(result.check);
    setError(result.error?.message ?? null);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const onFile = async (file: File | null) => {
    if (!file || !userId) return;
    setError(null);
    const problem = backgroundCheckFileError({ size: file.size, mimeType: file.type });
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    const { check: saved, error: e } = await uploadBackgroundCheck(userId, {
      body: file,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    });
    if (e) {
      setBusy(false);
      setError(e.message);
      return;
    }
    // A replacement supersedes the old file: remove it so only one is kept.
    if (check && saved) await removeBackgroundCheck(check);
    setCheck(saved);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const view = async () => {
    if (!check) return;
    const { url, error: e } = await getBackgroundCheckUrl(check.file_path);
    if (e || !url) setError(e?.message ?? "Couldn't open the file.");
    else window.open(url, "_blank", "noopener,noreferrer");
  };

  const remove = async () => {
    if (!check) return;
    if (!window.confirm("Remove your background check?\n\nDirectors and assignors will no longer see one on your profile.")) return;
    const { error: e } = await removeBackgroundCheck(check);
    if (e) setError(e.message);
    else setCheck(null);
  };

  const state = backgroundCheckState(check?.expires_at);
  const style = STATE_STYLE[state];

  return (
    <div className="app-canvas bg-paper pb-10">
      <div className="flex items-center gap-3 px-5 pb-3 pt-4 sm:px-0 lg:pt-6">
        <Link
          href="/app/profile"
          aria-label="Back to profile"
          className="flex h-9 w-9 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="chevron-left" size={18} />
        </Link>
        <h1 className="font-display uppercase text-ink" style={{ fontSize: 28, letterSpacing: -1 }}>
          Background check<span className="text-signal">.</span>
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-signal"><Spinner /></div>
      ) : (
        <div className="px-5 sm:px-0 lg:max-w-xl">
          <p className="mb-5 text-[14px] leading-5 text-ink-80">
            Upload your background check (a PDF or a photo). It&apos;s good for one year from the day you upload it — after that
            you&apos;ll need to add a new one. Directors and assignors can see that you have a current check, but never the document.
          </p>

          <div className={`border px-4 py-4 ${style.box}`}>
            <p className={`font-mono-bold text-[10px] uppercase ${style.text}`} style={{ letterSpacing: 1.5 }}>
              {style.title}
            </p>
            {check ? (
              <>
                <p className="mt-2 font-display uppercase text-ink" style={{ fontSize: 20, letterSpacing: -0.5 }}>
                  {backgroundCheckLabel(check.expires_at)}
                </p>
                <p className="mt-1 truncate font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
                  {check.file_name ?? "Uploaded file"} · uploaded{" "}
                  {new Date(check.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </>
            ) : null}
          </div>

          {state === "expiring" || state === "expired" ? (
            <p className="mt-3 font-mono-bold text-[10px] uppercase text-foul" style={{ letterSpacing: 1.2 }}>
              {state === "expired"
                ? "Your check has expired. Upload a new one so assignors and directors see you as current."
                : "Upload a new one before this expires so there's no gap."}
            </p>
          ) : null}

          <input
            ref={fileRef}
            type="file"
            accept={BACKGROUND_CHECK_MIME_TYPES.join(",")}
            className="hidden"
            data-testid="background-check-input"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="mt-5 flex w-full items-center justify-center bg-ink py-4 font-mono-bold text-[12px] uppercase text-paper hover:opacity-80 disabled:opacity-60"
            style={{ letterSpacing: 2 }}
          >
            {busy ? <Spinner /> : check ? "Upload a new one" : "Upload background check"}
          </button>

          {check ? (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void view()}
                className="flex-1 border border-ink py-3 font-mono-bold text-[10px] uppercase text-ink hover:bg-ink hover:text-paper"
                style={{ letterSpacing: 1.5 }}
              >
                View my file
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                className="flex-1 border border-foul py-3 font-mono-bold text-[10px] uppercase text-foul hover:opacity-80"
                style={{ letterSpacing: 1.5 }}
              >
                Remove
              </button>
            </div>
          ) : null}

          {error ? <p className="mt-4 font-mono text-[10px] uppercase text-foul" role="alert">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
