"use client";

import { ZebraRule } from "@/components/ui/ZebraRule";
import { Spinner } from "@/components/ui/AppButton";
import type { AssignmentStatus } from "@/lib/jobs/queries";

type Props = {
  assignmentStatus: AssignmentStatus;
  /** Shown inside the bar — the buttons are pinned to the bottom of the
   *  viewport, so an error rendered up in the page content is easy to miss. */
  error?: string | null;
  actionLoading: boolean;
  canMutate: boolean;
  onDecline: () => void;
  onAccept: () => void;
  onMessageCrew?: () => void;
  onWithdraw?: () => void;
  /** Shown only around tip-off; reports a delay in minutes to the organizers. */
  onRunningLate?: (minutes: number) => void;
};

// Action-button states: lift on hover (pointer devices only), push in on press.
const ACT =
  "rounded-md transition-[transform,box-shadow,background-color] duration-[120ms] ease-out hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard active:translate-x-0 active:translate-y-0 active:scale-[0.97] active:shadow-none active:duration-0 focus-visible:outline-none focus-visible:shadow-ring-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:active:scale-100 motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0";

/** Port of the app's JobDetailActionBar — one bar per assignment state. */
export function JobDetailActionBar({
  assignmentStatus,
  error,
  actionLoading,
  canMutate,
  onDecline,
  onAccept,
  onMessageCrew,
  onWithdraw,
  onRunningLate,
}: Props) {
  const shell = "sticky bottom-0 z-10 border-t-[1.5px] border-ink bg-paper px-4 pt-3";
  const shellStyle = { paddingBottom: "calc(12px + env(safe-area-inset-bottom))" };

  if (assignmentStatus === "accepted") {
    return (
      <div className={shell} style={shellStyle}>
        <div className="-mt-[1.5px]">
          <ZebraRule variant="signal" thin noMargin />
        </div>
        {error ? (
          <p
            className="mt-3 border border-foul bg-foul/10 px-3 py-2 font-mono text-[10px] uppercase text-foul"
            style={{ letterSpacing: 1 }}
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex gap-2.5">
          <div className="flex flex-1 items-center justify-center border border-court bg-court/15 py-4">
            <span
              className="font-mono-bold text-xs uppercase text-court"
              style={{ letterSpacing: 2 }}
            >
              Accepted · On crew
            </span>
          </div>
          {onMessageCrew && (
            <button
              type="button"
              onClick={onMessageCrew}
              className="flex items-center justify-center bg-ink px-5 hover:opacity-80"
            >
              <span
                className="text-center font-mono-bold text-[10px] uppercase text-hi-vis"
                style={{ letterSpacing: 1.5 }}
              >
                MESSAGE
                <br />
                CREW
              </span>
            </button>
          )}
        </div>
        {onRunningLate && (
          <div className="mt-2 flex items-center gap-2">
            <span
              className="font-mono-bold text-[9px] uppercase text-ink-60"
              style={{ letterSpacing: 1.5 }}
            >
              Running late?
            </span>
            {[10, 15, 30].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onRunningLate(m)}
                disabled={actionLoading}
                className="flex-1 border border-ink bg-chalk py-2 hover:opacity-70 disabled:opacity-40"
              >
                <span className="font-mono-bold text-[10px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
                  {m} min
                </span>
              </button>
            ))}
          </div>
        )}
        {onWithdraw && (
          <button
            type="button"
            onClick={onWithdraw}
            className="mt-2 w-full py-2 text-center hover:opacity-70"
          >
            <span
              className="font-mono-bold text-[9px] uppercase text-ink-40 underline"
              style={{ letterSpacing: 1.5 }}
            >
              Withdraw from this game
            </span>
          </button>
        )}
      </div>
    );
  }

  if (assignmentStatus === "needs_reconfirm") {
    return (
      <div className={shell} style={shellStyle}>
        <div className="-mt-[1.5px]">
          <ZebraRule variant="signal" thin noMargin />
        </div>
        {error ? (
          <p
            className="mt-3 border border-foul bg-foul/10 px-3 py-2 font-mono text-[10px] uppercase text-foul"
            style={{ letterSpacing: 1 }}
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <p
          className="mb-2.5 mt-3 text-center font-mono-bold text-[10px] uppercase text-foul"
          style={{ letterSpacing: 1.5 }}
        >
          ⚠ The organizer changed the time, venue, or pay
        </p>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onDecline}
            disabled={actionLoading || !canMutate}
            className={`flex items-center justify-center border-[1.5px] border-foul-ink px-4 py-4 active:bg-ink/10 ${ACT}`}
          >
            <span
              className="font-mono-bold text-xs uppercase text-foul-ink"
              style={{ letterSpacing: 1.4 }}
            >
              Drop out
            </span>
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={actionLoading || !canMutate}
            className={`flex flex-1 items-center justify-center gap-2 border-[1.5px] border-court bg-court py-4 text-paper ${ACT}`}
          >
            {actionLoading ? (
              <Spinner />
            ) : (
              <span className="font-mono-bold text-xs uppercase" style={{ letterSpacing: 1.4 }}>
                Re-confirm my spot →
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (assignmentStatus === "pending") {
    return (
      <div className={shell} style={shellStyle}>
        <div className="-mt-[1.5px]">
          <ZebraRule variant="signal" thin noMargin />
        </div>
        {error ? (
          <p
            className="mt-3 border border-foul bg-foul/10 px-3 py-2 font-mono text-[10px] uppercase text-foul"
            style={{ letterSpacing: 1 }}
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex flex-col items-center justify-center border border-whistle bg-whistle/10 px-4 py-3.5">
          <span
            className="font-mono-bold text-xs uppercase text-ink"
            style={{ letterSpacing: 2 }}
          >
            Applied · awaiting approval
          </span>
          <span
            className="mt-1 text-center font-mono text-[9px] uppercase text-ink-60"
            style={{ letterSpacing: 1 }}
          >
            The organizer confirms the crew — you&apos;ll see it on your home screen
          </span>
        </div>
        {/* Retracting a pending application goes through respond_to_job, not
            withdraw_from_job — that one only handles confirmed spots. */}
        <button
          type="button"
          onClick={onDecline}
          disabled={actionLoading || !canMutate}
          className="mt-2 w-full py-2 text-center hover:opacity-70 disabled:opacity-40"
        >
          <span
            className="font-mono-bold text-[9px] uppercase text-ink-40 underline"
            style={{ letterSpacing: 1.5 }}
          >
            Withdraw this application
          </span>
        </button>
      </div>
    );
  }

  if (assignmentStatus === "declined") {
    return (
      <div className={shell} style={shellStyle}>
        <div className="-mt-[1.5px]">
          <ZebraRule variant="signal" thin noMargin />
        </div>
        {error ? (
          <p
            className="mt-3 border border-foul bg-foul/10 px-3 py-2 font-mono text-[10px] uppercase text-foul"
            style={{ letterSpacing: 1 }}
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex items-center justify-center border border-ink-20 py-4">
          <span
            className="font-mono-bold text-xs uppercase text-ink-60"
            style={{ letterSpacing: 2 }}
          >
            Declined
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={shell} style={shellStyle}>
      <div className="-mt-[1.5px]">
        <ZebraRule variant="signal" thin noMargin />
      </div>
      {error ? (
        <p
          className="mt-3 border border-foul bg-foul/10 px-3 py-2 font-mono text-[10px] uppercase text-foul"
          style={{ letterSpacing: 1 }}
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2.5">
        <button
          type="button"
          onClick={onDecline}
          disabled={actionLoading || !canMutate}
          className={`flex items-center justify-center border-[1.5px] border-ink px-4 py-4 active:bg-ink/10 ${ACT}`}
        >
          <span
            className="font-mono-bold text-xs uppercase text-ink"
            style={{ letterSpacing: 1.4 }}
          >
            Decline
          </span>
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={actionLoading || !canMutate}
          className={`flex flex-1 items-center justify-center gap-2 border-[1.5px] border-court bg-court py-4 text-paper ${ACT}`}
        >
          {actionLoading ? (
            <Spinner />
          ) : (
            <>
              <span className="font-mono-bold text-xs uppercase" style={{ letterSpacing: 1.4 }}>
                Accept job
              </span>
              <span className="font-mono-bold text-base">→</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
