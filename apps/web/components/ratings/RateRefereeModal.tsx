"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/AppButton";
import type { CategoryRatings } from "@/lib/director/queries";

const CATEGORIES: { key: keyof CategoryRatings; label: string; hint: string }[] = [
  { key: "onTime", label: "ON TIME", hint: "Arrived ready before tip-off?" },
  { key: "professionalism", label: "PROFESSIONALISM", hint: "Uniform, conduct, communication" },
  { key: "gameManagement", label: "GAME MANAGEMENT", hint: "Kept the game under control?" },
];

/** Port of the app's components/ratings/RateRefereeModal. */
export function RateRefereeModal({
  refName,
  submitting,
  onSubmit,
  onClose,
}: {
  refName: string;
  submitting: boolean;
  onSubmit: (scores: CategoryRatings, comment: string) => void;
  onClose: () => void;
}) {
  const [scores, setScores] = useState<CategoryRatings>({
    onTime: 0,
    professionalism: 0,
    gameManagement: 0,
  });
  const [comment, setComment] = useState("");

  const complete =
    scores.onTime > 0 && scores.professionalism > 0 && scores.gameManagement > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto border-t-2 border-ink bg-paper px-5 pb-10 pt-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <span
            className="font-mono-bold text-[10px] uppercase text-ink-60"
            style={{ letterSpacing: 2 }}
          >
            Rate referee
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 font-mono-bold text-base text-ink hover:opacity-70"
          >
            ✕
          </button>
        </div>
        <h2
          className="mb-5 font-display uppercase text-ink"
          style={{ fontSize: 24, letterSpacing: -1 }}
        >
          {refName.toUpperCase()}
        </h2>

        {CATEGORIES.map((cat) => (
          <div key={cat.key} className="mb-4">
            <span
              className="block font-mono-bold text-[10px] uppercase text-ink"
              style={{ letterSpacing: 2 }}
            >
              {cat.label}
            </span>
            <span
              className="mb-2 block font-mono text-[9px] uppercase text-ink-40"
              style={{ letterSpacing: 1 }}
            >
              {cat.hint}
            </span>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => {
                const active = scores[cat.key] >= n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${cat.label}: ${n} of 5`}
                    onClick={() => setScores((s) => ({ ...s, [cat.key]: n }))}
                    className={`flex flex-1 items-center justify-center border py-3 hover:opacity-70 ${
                      active ? "border-ink bg-ink" : "border-ink-20 bg-chalk"
                    }`}
                  >
                    <span
                      className={`font-display ${active ? "text-hi-vis" : "text-ink-40"}`}
                      style={{ fontSize: 16 }}
                    >
                      {n}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="OPTIONAL COMMENT..."
          aria-label="Optional comment"
          className="mb-4 w-full border border-ink-20 bg-chalk px-3 py-2.5 font-mono text-[12px] text-ink outline-none placeholder:text-ink-40"
          style={{ minHeight: 60, letterSpacing: 0.5 }}
        />

        <button
          type="button"
          onClick={() => complete && onSubmit(scores, comment)}
          disabled={!complete || submitting}
          className={`flex w-full items-center justify-center border border-ink py-4 ${
            complete ? "bg-signal text-paper" : "bg-chalk text-ink-40"
          } disabled:cursor-not-allowed`}
        >
          {submitting ? (
            <Spinner />
          ) : (
            <span className="font-mono-bold text-[11px] uppercase" style={{ letterSpacing: 2 }}>
              Submit rating
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
