"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/AppButton";
import { supabase } from "@/lib/supabase";
import { cancelTournament } from "@/lib/director/queries";

/**
 * Cancels every game still open in an event (rain-out, venue lost), then the
 * event. Shared by the director's and the assignor's tournament pages.
 */
export function CancelTournamentButton({
  tournamentId,
  status,
  onCancelled,
}: {
  tournamentId: string;
  status: string | undefined;
  onCancelled: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (status === "cancelled" || status === "completed") return null;

  const cancel = async () => {
    if (busy) return;
    if (
      !window.confirm(
        "Cancel the whole event?\n\nEvery game that hasn't been played is cancelled, and its referees and applicants are told. Games already played stay completed. Late-cancel fees apply per game as usual."
      )
    )
      return;
    setBusy(true);
    setMessage(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setBusy(false);
      setMessage("Sign in again to cancel this event.");
      return;
    }
    const { error, gamesCancelled } = await cancelTournament(tournamentId, session.user.id);
    setBusy(false);
    if (error) {
      setMessage(`Could not cancel the event: ${error.message}`);
      return;
    }
    setMessage(gamesCancelled === 1 ? "Event cancelled. 1 game was cancelled." : `Event cancelled. ${gamesCancelled} games were cancelled.`);
    onCancelled();
  };

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => void cancel()}
        disabled={busy}
        className="w-full border-[1.5px] border-foul py-3.5 font-mono-bold text-[10px] uppercase text-foul hover:bg-foul/5 disabled:opacity-40"
        style={{ letterSpacing: 1.5 }}
      >
        {busy ? <Spinner /> : "Cancel entire event"}
      </button>
      {message ? (
        <p role="status" className="mt-2 font-mono text-[10px] uppercase leading-4 text-ink-60" style={{ letterSpacing: 1 }}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
