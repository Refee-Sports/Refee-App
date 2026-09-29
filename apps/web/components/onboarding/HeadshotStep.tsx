"use client";

import { useEffect, useRef, useState } from "react";
import { headshotFileError } from "@/lib/profile/avatar";

/**
 * The sign-up step that asks for a headshot. The parent keeps "next" disabled
 * until a valid file is chosen, and the database refuses a new profile without
 * one — so this is a real requirement.
 */
export function HeadshotStep({
  file,
  onChange,
  who = "Organizers and officials",
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  /** Who will see the photo, capitalised, for the explanatory line. */
  who?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onPick = (picked: File | null) => {
    if (!picked) return;
    const problem = headshotFileError(picked);
    setError(problem);
    onChange(problem ? null : picked);
  };

  return (
    <div>
      <h1
        className="font-display text-ink"
        style={{ fontSize: 40, lineHeight: "46px", letterSpacing: -1.5 }}
      >
        ADD YOUR
        <br />
        <span className="text-signal">HEADSHOT.</span>
      </h1>
      <p className="mb-6 mt-3 text-ink-80" style={{ fontSize: 14, lineHeight: "20px" }}>
        A headshot is required to join Refee. {who} see it on your profile, so use a clear, recent
        photo of your face — no logos, sunglasses or group shots.
      </p>

      <div className="mb-6 flex flex-col items-center">
        <div
          className={`flex h-44 w-44 items-center justify-center overflow-hidden bg-chalk ${
            file ? "border-2 border-ink" : "border-2 border-dashed border-ink-40"
          }`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your headshot preview" className="h-full w-full object-cover" />
          ) : (
            <span className="font-mono text-[11px] uppercase text-ink-40">No photo yet</span>
          )}
        </div>
        {file ? (
          <p className="mt-3 font-mono-bold text-[10px] uppercase text-court" style={{ letterSpacing: 1.5 }}>
            ✓ Looks good
          </p>
        ) : (
          <p className="mt-3 font-mono-bold text-[10px] uppercase text-foul" style={{ letterSpacing: 1.5 }}>
            Photo required to continue
          </p>
        )}
        {error ? (
          <p className="mt-2 font-mono text-[10px] uppercase text-foul" style={{ letterSpacing: 1 }}>
            {error}
          </p>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        className="hidden"
        data-testid="headshot-input"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full border border-ink bg-ink py-3.5 font-mono-bold text-[11px] uppercase text-paper hover:opacity-80"
        style={{ letterSpacing: 1.5 }}
      >
        {file ? "Choose a different photo" : "Take or choose a photo"}
      </button>
    </div>
  );
}
