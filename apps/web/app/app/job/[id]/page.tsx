"use client";

import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/AppButton";
import { JobDetailActionBar } from "@/components/job/JobDetailActionBar";
import {
  JobDetailCrew,
  JobDetailGames,
  JobDetailHero,
  JobDetailHirerNote,
  JobDetailMapCard,
  JobDetailScheduleCard,
  JobDetailSpecs,
  JobDetailTelemetry,
} from "@/components/job/JobDetailParts";
import { useJobAssignment } from "@/hooks/useJobAssignment";
import { useJobDetail } from "@/hooks/useJobsFeed";
import { supabase } from "@/lib/supabase";
import { getOrCreateCrewConversation } from "@/lib/messages/queries";
import { isLateWithdrawal, withdrawFromJob } from "@/lib/jobs/queries";

/** Port of refee-mobile/refee/app/(app)/job/[id].tsx. */
export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);

  const { job, loading, error } = useJobDetail(id);
  const {
    status: assignmentStatus,
    crewMembers,
    loading: assignmentLoading,
    actionLoading,
    error: assignmentError,
    accept,
    decline,
    canMutate,
  } = useJobAssignment(id);

  const handleAccept = async () => {
    setActionError(null);
    if (!canMutate) {
      setActionError(assignmentError ?? "You can't accept this job right now.");
      return;
    }
    const { error: acceptError } = await accept();
    if (acceptError) {
      setActionError(acceptError.message);
      return;
    }
    router.replace("/app/home");
  };

  const handleMessageCrew = async () => {
    setActionError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const { conversationId, error: convoErr } = await getOrCreateCrewConversation(
      session.user.id,
      id
    );
    if (convoErr || !conversationId) {
      setActionError(convoErr?.message ?? "Could not open crew chat");
      return;
    }
    router.push(`/app/conversation/${conversationId}`);
  };

  const handleWithdraw = async () => {
    if (!job) return;
    setActionError(null);
    const late = job.startsAtIso ? isLateWithdrawal(job.startsAtIso) : false;
    const message = late
      ? "Withdraw from this game?\n\n⚠ Tip-off is less than 24 hours away. Withdrawing now counts against your reliability record."
      : "Withdraw from this game?\n\nYou're more than 24 hours out, so this won't affect your rating. The slot reopens for other refs.";
    if (!window.confirm(message)) return;

    const { error: wErr } = await withdrawFromJob(supabase, id);
    if (wErr) {
      setActionError(wErr.message);
      return;
    }
    router.replace("/app/home");
  };

  const handleDecline = async () => {
    setActionError(null);
    if (!canMutate) {
      setActionError(assignmentError ?? "You can't decline this job right now.");
      return;
    }
    if (!window.confirm("Decline this job?\n\nYou can still browse other open assignments.")) {
      return;
    }
    const { error: declineError } = await decline();
    if (declineError) {
      setActionError(declineError.message);
      return;
    }
    router.back();
  };

  if (loading || assignmentLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-paper text-signal">
        <Spinner className="h-6 w-6" />
        <span
          className="mt-4 font-mono-bold text-[10px] uppercase text-ink-60"
          style={{ letterSpacing: 2 }}
        >
          Loading…
        </span>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="app-canvas bg-paper px-5 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="mb-6 flex h-9 w-9 items-center justify-center border border-ink bg-chalk text-ink"
        >
          <Icon name="chevron-left" size={20} />
        </button>
        <h1
          className="font-display uppercase text-ink"
          style={{ fontSize: 22, letterSpacing: -0.5 }}
        >
          Job not found
        </h1>
        <p className="mt-3 font-mono text-xs uppercase text-ink-60">
          {error ?? `No job for id ${id}.`}
        </p>
      </div>
    );
  }

  return (
    <div className="app-canvas bg-paper">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-1 sm:px-0 lg:pt-5">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="chevron-left" size={20} />
        </button>
        <div className="flex flex-1 flex-col items-center px-2">
          <span
            className="font-mono-bold text-[9px] uppercase text-ink-60"
            style={{ letterSpacing: 1.8 }}
          >
            Job detail
          </span>
          <span
            className="mt-0.5 font-mono-bold text-[11px] uppercase text-ink"
            style={{ letterSpacing: 1 }}
          >
            JOB{job.jobCode}
          </span>
        </div>
        <span className="h-9 w-9" />
      </div>

      <JobDetailTelemetry job={job} />
      <div className="px-5 sm:px-0">
        <ZebraRule variant="signal" thin noMargin />
      </div>

      <div className="flex-1 px-5 pb-6 pt-3 sm:px-0">
        {/* The game itself on the left; crew and specs alongside on desktop. */}
        <div className="split-grid">
          <div className="min-w-0">
            <JobDetailHero job={job} />
            <JobDetailScheduleCard job={job} />
            <JobDetailMapCard job={job} />
          </div>
          <div className="min-w-0">
            <JobDetailCrew
              job={job}
              assignmentStatus={assignmentStatus}
              crewMembers={crewMembers}
            />
            <JobDetailGames job={job} />
            <JobDetailSpecs job={job} />
            {job.hirerNote ? <JobDetailHirerNote note={job.hirerNote} /> : null}
          </div>
        </div>
      </div>

      <JobDetailActionBar
        assignmentStatus={assignmentStatus}
        error={actionError}
        actionLoading={actionLoading}
        canMutate={canMutate}
        onDecline={() => void handleDecline()}
        onAccept={() => void handleAccept()}
        onMessageCrew={() => void handleMessageCrew()}
        onWithdraw={() => void handleWithdraw()}
      />
    </div>
  );
}
