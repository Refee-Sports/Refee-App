"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useState } from "react";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/AppButton";
import { RateRefereeModal } from "@/components/ratings/RateRefereeModal";
import { StripePaymentModal } from "@/components/payments/StripePaymentModal";
import { useFocusEffect } from "@/hooks/useFocusEffect";
import {
  approveApplicant,
  cancelGame,
  CANCEL_FEE_WINDOW_HOURS,
  completeGame,
  declineApplicantForGame,
  fetchExistingRating,
  fetchGameApplicants,
  fetchGameById,
  fetchGameRatedRefIds,
  fetchMyHirerId,
  setGameAutoAccept,
  submitRefereeRating,
  type ApplicantRow,
  type CategoryRatings,
  type DirectorGameRow,
} from "@/lib/director/queries";
import {
  fetchCrewThread,
  getOrCreateDM,
  postCrewNote,
  type CrewThread,
} from "@/lib/messages/queries";
import { hasSeenLatest, seenCount } from "@/lib/messages/receipts";
import { supabase } from "@/lib/supabase";
import { confirmCrewPayout, runAutoPay, startCrewPayment, type PayCrewQuote } from "@/lib/payments/queries";

const TZ = "America/Chicago";

function fmtDatetime(iso: string) {
  const d = new Date(iso);
  const date = d
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: TZ,
    })
    .toUpperCase();
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  });
  return `${date} · ${time}`;
}

/** Port of refee-mobile/refee/app/(director)/game/[id].tsx. */
export default function DirectorGameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [game, setGame] = useState<DirectorGameRow | null>(null);
  const [applicants, setApplicants] = useState<ApplicantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ratingTarget, setRatingTarget] = useState<ApplicantRow | null>(null);
  const [ratedRefIds, setRatedRefIds] = useState<Set<string>>(new Set());
  const [submittingRating, setSubmittingRating] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payQuote, setPayQuote] = useState<PayCrewQuote | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [postingNote, setPostingNote] = useState(false);
  const [crewThread, setCrewThread] = useState<CrewThread | null>(null);
  const [savingAccept, setSavingAccept] = useState(false);

  const reload = useCallback(async () => {
    const [{ game: g, error: gErr }, { applicants: apps, error: aErr }] = await Promise.all([
      fetchGameById(id),
      fetchGameApplicants(id),
    ]);
    setGame(g);
    setApplicants(apps);
    setError(gErr?.message ?? aErr?.message ?? null);
    setLoading(false);

    // Which refs have I already rated for this game?
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const hirerId = await fetchMyHirerId(session.user.id);
      if (hirerId) setRatedRefIds(await fetchGameRatedRefIds(id, hirerId));
    }

    const { thread } = await fetchCrewThread(id);
    if (thread) setCrewThread(thread);
  }, [id]);

  const load = useCallback(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  useFocusEffect(load);

  const submitCrewNote = async () => {
    const body = noteText.trim();
    if (!body) return;
    setPostingNote(true);
    const { error: err } = await postCrewNote(id, body);
    setPostingNote(false);
    if (err) {
      setNotice(`Couldn't send: ${err.message}`);
      return;
    }
    setNoteOpen(false);
    setNoteText("");
    const { thread } = await fetchCrewThread(id);
    if (thread) setCrewThread(thread);
  };

  const handleMessageRef = async (refId: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const { conversationId, error: err } = await getOrCreateDM(session.user.id, refId);
    if (err || !conversationId) {
      setNotice(err?.message ?? "Could not open chat");
      return;
    }
    router.push(`/director/conversation/${conversationId}`);
  };

  const handleSubmitRating = async (scores: CategoryRatings, comment: string) => {
    if (!ratingTarget) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    setSubmittingRating(true);
    const hirerId = await fetchMyHirerId(session.user.id);
    if (!hirerId) {
      setSubmittingRating(false);
      setNotice("Hirer profile not found");
      return;
    }
    const already = await fetchExistingRating(id, ratingTarget.ref_id, hirerId);
    if (already) {
      setSubmittingRating(false);
      setRatingTarget(null);
      setNotice("You've already rated this referee for this game.");
      return;
    }
    const { error: err } = await submitRefereeRating(
      id,
      ratingTarget.ref_id,
      hirerId,
      scores,
      comment
    );
    setSubmittingRating(false);
    if (err) {
      setNotice(err.message);
      return;
    }
    setRatedRefIds((s) => new Set(s).add(ratingTarget.ref_id));
    setRatingTarget(null);
  };

  const handleCompleteGame = async () => {
    if (
      !window.confirm(
        "Mark game as completed?\n\nConfirmed referees will have their full pay locked in, and you'll be able to rate them."
      )
    ) {
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const { error: err } = await completeGame(id, session.user.id);
    if (err) {
      setNotice(err.message);
      return;
    }

    // Auto-pay if a card is on file; otherwise PAY CREW stays visible.
    const { result } = await runAutoPay(id);
    if (result && result.paid.length > 0) {
      const p = result.paid[0];
      setNotice(
        p.held > 0
          ? `Crew paid automatically — $${p.total} charged. ${p.transferred} referee${
              p.transferred !== 1 ? "s" : ""
            } paid instantly; ${p.held} pending payout setup.`
          : `Crew paid automatically — $${p.total} charged and all ${p.transferred} referee${
              p.transferred !== 1 ? "s" : ""
            } paid.`
      );
    } else if (result?.reason === "no_card") {
      setNotice(
        "Game completed. Tip: save a card so crews get paid automatically. For now, use PAY CREW."
      );
    } else if (result && result.skipped.length > 0) {
      setNotice(`Auto-pay failed: ${result.skipped[0].reason}. Use PAY CREW to pay manually.`);
    }
    await reload();
  };

  const handleCancelGame = async () => {
    if (!game) return;
    const msToStart = new Date(game.starts_at).getTime() - Date.now();
    const lateCancel = msToStart < CANCEL_FEE_WINDOW_HOURS * 3_600_000;
    const message = lateCancel
      ? `Cancel this game?\n\nYou're inside ${CANCEL_FEE_WINDOW_HOURS} hour${
          CANCEL_FEE_WINDOW_HOURS !== 1 ? "s" : ""
        } of tip-off. Confirmed referees will be owed a 50% cancellation fee.`
      : "Cancel this game?\n\nConfirmed referees will be notified. No cancellation fees apply.";
    if (!window.confirm(message)) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const { error: err, feePaid, feeAmount } = await cancelGame(id, session.user.id);
    if (err) {
      setNotice(err.message);
      return;
    }
    if (feePaid) {
      setNotice(`Game cancelled. Each confirmed referee is owed a $${feeAmount} cancellation fee.`);
    }
    await reload();
  };

  /** Opens the Stripe Elements sheet — the web counterpart of PaymentSheet. */
  const handlePayCrew = async () => {
    if (paying) return;
    setPaying(true);
    setNotice(null);
    const { quote, error: qErr } = await startCrewPayment(id);
    setPaying(false);
    if (qErr || !quote) {
      setNotice(qErr?.message ?? "Cannot start payment.");
      return;
    }
    setPayQuote(quote);
  };

  const handlePaymentSuccess = async () => {
    setPayQuote(null);
    const { transferred, held, error: payoutErr } = await confirmCrewPayout(id);
    if (payoutErr) {
      setNotice(`Payment received, payout pending: ${payoutErr.message}`);
      await reload();
      return;
    }
    setNotice(
      held > 0
        ? `${transferred} referee${
            transferred !== 1 ? "s" : ""
          } paid instantly. ${held} haven't set up payouts yet — their share is held and releases automatically once they onboard.`
        : `All ${transferred} referee${transferred !== 1 ? "s" : ""} paid.`
    );
    await reload();
  };

  const handleApprove = async (refId: string) => {
    setActioning(refId);
    const { error: err } = await approveApplicant(id, refId);
    if (err) setNotice(err.message);
    else {
      setApplicants((prev) =>
        prev.map((a) => (a.ref_id === refId ? { ...a, status: "accepted" } : a))
      );
    }
    setActioning(null);
  };

  const handleAutoAccept = async (next: boolean) => {
    if (!game || next === !!game.auto_accept) return;
    setSavingAccept(true);
    const { error: err } = await setGameAutoAccept(id, next);
    setSavingAccept(false);
    if (err) {
      setNotice(err.message);
      return;
    }
    setGame({ ...game, auto_accept: next });
  };

  const handleDecline = async (refId: string) => {
    if (
      !window.confirm(
        "Decline this referee?\n\nThey'll be notified that this slot is no longer available."
      )
    ) {
      return;
    }
    setActioning(refId);
    const { error: err } = await declineApplicantForGame(id, refId);
    if (err) setNotice(err.message);
    else {
      setApplicants((prev) =>
        prev.map((a) => (a.ref_id === refId ? { ...a, status: "declined" } : a))
      );
    }
    setActioning(null);
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper text-signal">
        <Spinner />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper px-6">
        <p className="font-mono-bold uppercase text-ink" style={{ letterSpacing: 1 }}>
          {error ?? "Game not found."}
        </p>
      </div>
    );
  }

  const pending = applicants.filter((a) => a.status === "pending");
  const accepted = applicants.filter(
    (a) => a.status === "accepted" || a.status === "needs_reconfirm" || a.status === "completed"
  );
  const declined = applicants.filter((a) => a.status === "declined");
  const slotsLeft = Math.max(0, game.crew_size - accepted.length);
  const gameStarted = new Date(game.starts_at) <= new Date();
  const isCompleted = game.status === "completed";
  const isCancelled = game.status === "cancelled";
  const isClosed = isCompleted || isCancelled;
  const unratedCount = accepted.filter((a) => !ratedRefIds.has(a.ref_id)).length;
  const isPaid = game.payment_status === "paid";
  const showPayCrew = isClosed && !isPaid && accepted.length > 0;

  return (
    <div className="app-canvas bg-paper pb-10">
      {/* Back / edit */}
      <div className="flex items-center gap-3 px-5 py-3 sm:px-0 lg:pt-5">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 shrink-0 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <span
          className="flex-1 font-mono-bold text-[10px] uppercase text-ink-60"
          style={{ letterSpacing: 2 }}
        >
          Game detail
        </span>
        <Link
          href={`/director/game/create?editId=${id}`}
          className="flex h-9 shrink-0 items-center gap-1.5 border border-ink bg-chalk px-3 text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="edit-2" size={12} />
          <span className="font-mono-bold text-[9px] uppercase" style={{ letterSpacing: 1.5 }}>
            Edit
          </span>
        </Link>
      </div>

      {/* Hero */}
      <div className="px-5 pb-3">
        <h1
          className="font-display uppercase text-ink"
          style={{ fontSize: 26, lineHeight: "24px", letterSpacing: -1 }}
        >
          {game.title.toUpperCase()}
        </h1>
        <p
          className="mt-1.5 font-mono text-[10px] uppercase text-ink-60"
          style={{ letterSpacing: 1.5 }}
        >
          {fmtDatetime(game.starts_at)}
        </p>
        <p className="font-mono text-[10px] uppercase text-ink-60" style={{ letterSpacing: 1.5 }}>
          {game.venue_name.toUpperCase()} · {game.venue_city.toUpperCase()}, {game.venue_state}
        </p>
      </div>
      <div className="mb-4 px-5">
        <ZebraRule thin noMargin />
      </div>

      {notice ? (
        <div className="mx-5 mb-4 flex items-start justify-between gap-3 border border-signal bg-signal/10 px-4 py-3">
          <p className="flex-1 font-mono text-[10px] uppercase text-ink-80" style={{ letterSpacing: 1 }}>
            {notice}
          </p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="text-ink-60"
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      ) : null}

      {/* Specs */}
      <div className="mx-5 mb-4 flex border border-ink bg-chalk">
        <SpecCell label="Refs needed" value={String(game.crew_size)} />
        <span className="w-px bg-ink" />
        <SpecCell label="Slots left" value={String(slotsLeft)} />
        <span className="w-px bg-ink" />
        <SpecCell label="Pay / ref" value={`$${game.pay_per_game}`} />
      </div>

      {isCancelled && (
        <div className="mx-5 mb-4 border border-foul bg-foul/10 px-4 py-3">
          <p
            className="font-mono-bold text-[11px] uppercase text-foul"
            style={{ letterSpacing: 1.5 }}
          >
            ✕ Game cancelled
          </p>
        </div>
      )}

      {/* Operations on the left, crew on the right once there is room. */}
      <div className="split-grid">
        <div className="min-w-0">

      {/* Post-game rating prompt */}
      {isCompleted && unratedCount > 0 && (
        <div className="mx-5 mb-4 border border-ink bg-hi-vis px-4 py-3.5">
          <p
            className="font-mono-bold text-[11px] uppercase text-ink"
            style={{ letterSpacing: 1.5 }}
          >
            ✓ Game completed — rate your crew
          </p>
          <p className="mt-1 font-mono text-[9px] uppercase text-ink" style={{ letterSpacing: 1 }}>
            {unratedCount} REFEREE{unratedCount !== 1 ? "S" : ""} AWAITING YOUR RATING BELOW
          </p>
        </div>
      )}
      {isCompleted && unratedCount === 0 && accepted.length > 0 && (
        <div className="mx-5 mb-4 flex items-center gap-3 border border-court/30 bg-court/10 px-4 py-3.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-court text-paper">
            <Icon name="check" size={15} />
          </span>
          <span className="flex-1">
            <span
              className="block font-mono-bold text-[11px] uppercase text-court"
              style={{ letterSpacing: 1.2 }}
            >
              Completed
            </span>
            <span
              className="mt-0.5 block font-mono text-[9px] uppercase text-ink-60"
              style={{ letterSpacing: 1 }}
            >
              All referees rated
            </span>
          </span>
        </div>
      )}

      {/* Pay crew */}
      {showPayCrew && (
        <div className="mx-5 mb-4">
          <button
            type="button"
            onClick={handlePayCrew}
            disabled={paying}
            className="flex w-full items-center justify-center gap-2 bg-signal py-4 text-paper hover:opacity-80 disabled:opacity-60"
          >
            {paying ? (
              <Spinner />
            ) : (
              <>
                <Icon name="dollar-sign" size={14} />
                <span
                  className="font-mono-bold text-[11px] uppercase"
                  style={{ letterSpacing: 2 }}
                >
                  Pay crew
                </span>
              </>
            )}
          </button>
          <p
            className="mt-1.5 text-center font-mono text-[8px] uppercase text-ink-40"
            style={{ letterSpacing: 1 }}
          >
            Card payment · refs paid via Stripe · +5% platform fee
          </p>
        </div>
      )}
      {isClosed && isPaid && (
        <div className="mx-5 mb-4 flex items-center gap-3 bg-court px-4 py-3.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paper/20 text-paper">
            <Icon name="check" size={15} />
          </span>
          <span className="flex-1">
            <span
              className="block font-mono-bold text-[11px] uppercase text-paper"
              style={{ letterSpacing: 1.2 }}
            >
              Crew paid
            </span>
            <span
              className="mt-0.5 block font-mono text-[9px] uppercase text-paper/80"
              style={{ letterSpacing: 1 }}
            >
              Sent to referees via Stripe
            </span>
          </span>
        </div>
      )}

      {/* Message crew */}
      {accepted.length > 0 && (
        <div className="mx-5 mb-4">
          <button
            type="button"
            onClick={() => {
              setNoteText("");
              setNoteOpen(true);
            }}
            className="flex w-full items-center justify-center gap-2 border border-ink bg-ink py-3.5 text-hi-vis hover:opacity-80"
          >
            <Icon name="send" size={14} />
            <span
              className="font-mono-bold text-[10px] uppercase text-paper"
              style={{ letterSpacing: 2 }}
            >
              Send a crew message
            </span>
          </button>
          <p
            className="mt-1.5 text-center font-mono text-[8px] uppercase text-ink-40"
            style={{ letterSpacing: 1 }}
          >
            Only confirmed crew can view
          </p>
        </div>
      )}

      {/* Sent crew messages + read receipts (director-only view) */}
      {crewThread && crewThread.messages.length > 0 && (
        <div className="mx-5 mb-4 border border-ink-20 bg-chalk">
          <div className="flex items-center justify-between border-b border-ink-20 px-3.5 py-2.5">
            <span
              className="font-mono-bold text-[9px] uppercase text-ink-60"
              style={{ letterSpacing: 1.4 }}
            >
              Crew messages
            </span>
            <span
              className="font-mono-bold text-[9px] uppercase text-court"
              style={{ letterSpacing: 1.2 }}
            >
              ✓ SEEN {seenCount(crewThread.receipts, crewThread.lastMessageAt)}/
              {crewThread.receipts.length}
            </span>
          </div>

          {crewThread.messages.map((m) => (
            <div key={m.id} className="border-b border-ink-20 px-3.5 py-2.5">
              <p className="whitespace-pre-wrap font-mono text-[12px] text-ink">{m.body}</p>
              <span
                className="mt-1 block font-mono text-[8px] uppercase text-ink-40"
                style={{ letterSpacing: 1 }}
              >
                {new Date(m.createdAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: TZ,
                })}
              </span>
            </div>
          ))}

          <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-3.5 py-2.5">
            {crewThread.receipts.map((r) => {
              const seen = hasSeenLatest(r.lastReadAt, crewThread.lastMessageAt);
              return (
                <span key={r.refId} className="flex items-center gap-1">
                  <span className={seen ? "text-court" : "text-ink-40"}>
                    <Icon name={seen ? "check-circle" : "circle"} size={11} />
                  </span>
                  <span
                    className={`font-mono-bold text-[9px] uppercase ${
                      seen ? "text-ink" : "text-ink-60"
                    }`}
                    style={{ letterSpacing: 0.8 }}
                  >
                    {r.displayName}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Lifecycle actions */}
      {!isClosed && (
        <div className="mx-5 mb-4 flex flex-col gap-2">
          {gameStarted && (
            <button
              type="button"
              onClick={handleCompleteGame}
              className="flex items-center justify-center gap-2 bg-court py-3.5 text-paper hover:opacity-80"
            >
              <Icon name="check-circle" size={14} />
              <span className="font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 2 }}>
                Mark game completed
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCancelGame}
            className="border border-foul py-3 text-center text-foul hover:bg-foul hover:text-paper"
          >
            <span className="font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 2 }}>
              Cancel game
            </span>
          </button>
        </div>
      )}

      {/* Acceptance — switchable here, without the full edit form */}
      {!isClosed && (
        <div className="mx-5 mb-4 border border-ink bg-chalk">
          <div className="border-b border-ink-20 px-4 py-2.5">
            <span
              className="font-mono-bold text-[9px] uppercase text-ink-60"
              style={{ letterSpacing: 2 }}
            >
              Referee acceptance
            </span>
          </div>
          <div className="flex" role="radiogroup" aria-label="Referee acceptance">
            {(
              [
                [true, "Auto-accept", "Refs are confirmed the moment they apply"],
                [false, "Manual approval", "You approve each ref in Approvals"],
              ] as const
            ).map(([value, label, hint], idx) => {
              const selected = !!game.auto_accept === value;
              return (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={savingAccept}
                  onClick={() => void handleAutoAccept(value)}
                  className={`flex-1 px-4 py-3 text-left disabled:opacity-60 ${
                    idx === 0 ? "border-r border-ink-20" : ""
                  } ${selected ? "bg-ink text-paper" : "text-ink hover:bg-paper"}`}
                >
                  <span
                    className="block font-mono-bold text-[11px] uppercase"
                    style={{ letterSpacing: 1.5 }}
                  >
                    {selected ? "● " : "○ "}
                    {label}
                  </span>
                  <span
                    className={`mt-0.5 block font-mono text-[9px] ${
                      selected ? "text-paper/70" : "text-ink-60"
                    }`}
                    style={{ letterSpacing: 0.5 }}
                  >
                    {hint}
                  </span>
                </button>
              );
            })}
          </div>
          {game.auto_accept && pending.length > 0 ? (
            <p
              className="border-t border-ink-20 px-4 py-2 font-mono text-[9px] uppercase text-ink-60"
              style={{ letterSpacing: 1 }}
            >
              Applies to new applications — the {pending.length} already waiting still need an
              answer below.
            </p>
          ) : null}
        </div>
      )}

      {/* Details */}
      {(game.uniform_requirements || game.hirer_note) && (
        <div className="mx-5 mb-4 border border-ink-20 bg-chalk">
          {game.uniform_requirements && (
            <>
              <DetailRow icon="user" label="Uniform" value={game.uniform_requirements} />
              {game.hirer_note && <span className="block h-px bg-ink-20" />}
            </>
          )}
          {game.hirer_note && (
            <DetailRow icon="file-text" label="Notes" value={game.hirer_note} />
          )}
        </div>
      )}

        </div>

        <div className="min-w-0">

      {/* Applicants */}
      <ApplicantSection
        title={`PENDING · ${pending.length}`}
        accentColor="#F59E0B"
        empty="No pending applications."
        count={pending.length}
      >
        {pending.map((a) => (
          <ApplicantCard
            key={a.id}
            applicant={a}
            onApprove={() => handleApprove(a.ref_id)}
            onDecline={() => handleDecline(a.ref_id)}
            actioning={actioning === a.ref_id}
            showActions
          />
        ))}
      </ApplicantSection>

      <ApplicantSection
        title={`ACCEPTED · ${accepted.length}`}
        accentColor="#00A85C"
        empty="No accepted referees yet."
        count={accepted.length}
      >
        {accepted.map((a) => (
          <ApplicantCard
            key={a.id}
            applicant={a}
            actioning={false}
            showActions={false}
            onMessage={() => handleMessageRef(a.ref_id)}
            onRate={
              gameStarted && !ratedRefIds.has(a.ref_id) ? () => setRatingTarget(a) : undefined
            }
            rated={ratedRefIds.has(a.ref_id)}
          />
        ))}
      </ApplicantSection>

      {declined.length > 0 && (
        <ApplicantSection
          title={`DECLINED · ${declined.length}`}
          accentColor="rgba(8,17,28,0.30)"
          empty=""
          count={declined.length}
        >
          {declined.map((a) => (
            <ApplicantCard key={a.id} applicant={a} actioning={false} showActions={false} />
          ))}
        </ApplicantSection>
      )}

        </div>
      </div>

      {ratingTarget && (
        <RateRefereeModal
          refName={
            ratingTarget.profile
              ? `${ratingTarget.profile.first_name} ${ratingTarget.profile.last_initial}.`
              : "Referee"
          }
          submitting={submittingRating}
          onSubmit={handleSubmitRating}
          onClose={() => setRatingTarget(null)}
        />
      )}

      {payQuote && (
        <StripePaymentModal
          clientSecret={payQuote.clientSecret}
          mode="payment"
          title="Pay crew"
          summary={[
            { label: `Crew (${payQuote.refCount} refs)`, value: `$${payQuote.crewTotal}` },
            { label: "Platform fee", value: `$${payQuote.platformFee}` },
            { label: "Total", value: `$${payQuote.total}` },
          ]}
          submitLabel={`PAY $${payQuote.total}`}
          onCancel={() => setPayQuote(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {noteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center"
          onClick={() => setNoteOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-[480px] border-t-2 border-ink bg-paper px-5 pb-8 pt-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="font-display uppercase text-ink"
              style={{ fontSize: 20, letterSpacing: -0.5 }}
            >
              Send a crew message
            </h2>
            <p
              className="mb-3 mt-1 font-mono text-[9px] uppercase text-ink-60"
              style={{ letterSpacing: 1 }}
            >
              Note — crew messages can only be viewed by confirmed refs
            </p>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Arrive 30 min early, park behind the gym…"
              maxLength={4000}
              autoFocus
              aria-label="Crew message"
              className="w-full border border-ink bg-chalk px-3 py-3 font-mono text-[13px] text-ink outline-none placeholder:text-ink-40"
              style={{ minHeight: 90 }}
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setNoteOpen(false)}
                className="flex-1 border border-ink py-3.5 text-center text-ink hover:bg-ink hover:text-paper"
              >
                <span
                  className="font-mono-bold text-[10px] uppercase"
                  style={{ letterSpacing: 2 }}
                >
                  Cancel
                </span>
              </button>
              <button
                type="button"
                onClick={submitCrewNote}
                disabled={postingNote || noteText.trim().length === 0}
                className={`flex flex-1 items-center justify-center gap-2 py-3.5 ${
                  postingNote || noteText.trim().length === 0
                    ? "cursor-not-allowed bg-ink-20 text-ink-40"
                    : "bg-signal text-paper hover:opacity-80"
                }`}
              >
                {postingNote ? (
                  <Spinner />
                ) : (
                  <>
                    <Icon name="send" size={13} />
                    <span
                      className="font-mono-bold text-[10px] uppercase"
                      style={{ letterSpacing: 2 }}
                    >
                      Send
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SpecCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col items-center px-3 py-3">
      <span
        className="mb-0.5 font-mono text-[8px] uppercase text-ink-40"
        style={{ letterSpacing: 2 }}
      >
        {label}
      </span>
      <span className="font-display text-ink" style={{ fontSize: 22, letterSpacing: -0.5 }}>
        {value}
      </span>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-px shrink-0 text-ink-60">
        <Icon name={icon} size={14} />
      </span>
      <div className="flex-1">
        <span
          className="mb-0.5 block font-mono-bold text-[9px] uppercase text-ink-40"
          style={{ letterSpacing: 2 }}
        >
          {label}
        </span>
        <span className="block font-mono text-[11px] text-ink" style={{ lineHeight: "16px" }}>
          {value}
        </span>
      </div>
    </div>
  );
}

function ApplicantSection({
  title,
  accentColor,
  empty,
  count,
  children,
}: {
  title: string;
  accentColor: string;
  empty: string;
  count: number;
  children?: React.ReactNode;
}) {
  return (
    <section className="mx-5 mb-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
        <h2
          className="font-mono-bold text-[10px] uppercase text-ink"
          style={{ letterSpacing: 2 }}
        >
          {title}
        </h2>
      </div>
      {count === 0 ? (
        <p
          className="px-1 font-mono text-[10px] uppercase text-ink-40"
          style={{ letterSpacing: 1 }}
        >
          {empty}
        </p>
      ) : (
        <div className="flex flex-col gap-2">{children}</div>
      )}
    </section>
  );
}

function ApplicantCard({
  applicant,
  onApprove,
  onDecline,
  actioning,
  showActions,
  onMessage,
  onRate,
  rated,
}: {
  applicant: ApplicantRow;
  onApprove?: () => void;
  onDecline?: () => void;
  actioning: boolean;
  showActions: boolean;
  onMessage?: () => void;
  onRate?: () => void;
  rated?: boolean;
}) {
  const p = applicant.profile;
  const initials = p ? `${p.first_name[0] ?? "?"}${p.last_initial}`.toUpperCase() : "??";
  const displayName = p ? `${p.first_name} ${p.last_initial}.`.toUpperCase() : "UNKNOWN REF";

  const statusColor: Record<string, string> = {
    pending: "#F59E0B",
    accepted: "#00A85C",
    declined: "rgba(8,17,28,0.36)",
    needs_reconfirm: "#E53E3E",
    completed: "#00A85C",
    cancelled: "rgba(8,17,28,0.36)",
  };

  const statusLabel: Record<string, string> = {
    needs_reconfirm: "AWAITING RE-CONFIRM",
    completed: "WORKED ✓",
  };

  return (
    <div className="border border-ink bg-chalk">
      <Link
        href={`/director/referee/${applicant.ref_id}`}
        className="flex items-center gap-3 px-4 py-3.5 hover:opacity-80"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-ink">
          <span className="font-mono-bold text-xs text-paper">{initials}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="block font-mono-bold text-[12px] uppercase text-ink"
            style={{ letterSpacing: 0.5 }}
          >
            {displayName}
          </span>
          {p && (
            <span
              className="block font-mono text-[9px] uppercase text-ink-60"
              style={{ letterSpacing: 1 }}
            >
              {p.city.toUpperCase()}, {p.state} · ★ {p.rating.toFixed(2)}
            </span>
          )}
        </span>
        <span
          className="shrink-0 font-mono-bold text-[9px] uppercase"
          style={{ letterSpacing: 1.5, color: statusColor[applicant.status] ?? "#08111C" }}
        >
          {statusLabel[applicant.status] ?? applicant.status.toUpperCase()}
        </span>
      </Link>

      {showActions && (
        <div className="flex border-t border-ink-20">
          <button
            type="button"
            onClick={onDecline}
            disabled={actioning}
            className="flex-1 border-r border-ink-20 py-2.5 text-center hover:opacity-70 disabled:opacity-40"
          >
            <span
              className="font-mono-bold text-[10px] uppercase text-foul"
              style={{ letterSpacing: 1.5 }}
            >
              Decline
            </span>
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={actioning}
            className="flex flex-1 items-center justify-center bg-court py-2.5 text-paper hover:opacity-70 disabled:opacity-40"
          >
            {actioning ? (
              <Spinner />
            ) : (
              <span
                className="font-mono-bold text-[10px] uppercase"
                style={{ letterSpacing: 1.5 }}
              >
                Accept ✓
              </span>
            )}
          </button>
        </div>
      )}

      {!showActions && (onMessage || onRate || rated) && (
        <div className="flex border-t border-ink-20">
          {onMessage && (
            <button
              type="button"
              onClick={onMessage}
              className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-signal hover:opacity-70"
            >
              <Icon name="message-square" size={11} />
              <span
                className="font-mono-bold text-[10px] uppercase"
                style={{ letterSpacing: 1.5 }}
              >
                Message
              </span>
            </button>
          )}
          {onRate && (
            <button
              type="button"
              onClick={onRate}
              className="flex flex-1 items-center justify-center gap-1.5 border-l border-ink-20 bg-ink py-2.5 text-hi-vis hover:opacity-70"
            >
              <Icon name="star" size={11} />
              <span
                className="font-mono-bold text-[10px] uppercase text-paper"
                style={{ letterSpacing: 1.5 }}
              >
                Rate
              </span>
            </button>
          )}
          {rated && (
            <span className="flex flex-1 items-center justify-center gap-1.5 border-l border-ink-20 py-2.5 text-court">
              <span className="text-[10px]">✓</span>
              <span
                className="font-mono-bold text-[10px] uppercase"
                style={{ letterSpacing: 1.5 }}
              >
                Rated
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
