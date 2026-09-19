import { supabase } from "../client";

// Identity verification, shared by both apps. Starting a check and deciding it
// both happen in the backend (start-id-verification and didit-webhook); the
// apps only ever ask where to send someone and what the answer was.

export type IdentityStatus =
  | "unstarted"
  | "in_progress"
  | "in_review"
  | "approved"
  | "declined"
  | "expired"
  | "abandoned";

export type IdentityState = {
  status: IdentityStatus;
  /** Why the last check ended the way it did, when Didit said. */
  reason: string | null;
  decidedAt: string | null;
};

/**
 * How a profile shows verification, everywhere it appears. Anyone not yet
 * verified reads as pending — whether they haven't started, are with a
 * reviewer, or need another try — because other people only ever see the
 * public yes/no, never the private reason.
 */
export function verificationLabel(isVerified: boolean | null | undefined): string {
  return isVerified ? "VERIFIED" : "PENDING VERIFICATION";
}

/** Only an approved identity unlocks working, staffing and posting games. */
export function isVerified(status: IdentityStatus): boolean {
  return status === "approved";
}

/**
 * The work a verified ID unlocks, in each role's own terms. Referees take games,
 * directors post them, assignors staff them — so "working games" is only true
 * for one of the three. Anything unrecognised reads as a referee, the most
 * common role.
 */
export function lockedWork(role: string | null | undefined): string {
  switch (role) {
    case "director":
      return "create games";
    case "assignor":
      return "assign games";
    default:
      return "accept games";
  }
}

/** Said before someone skips verification, so the cost is clear up front. */
export function skipVerificationWarning(role: string | null | undefined): string {
  return `Until your ID is verified, you won't be able to ${lockedWork(role)}. You can still look around, and verify any time from your home screen.`;
}

/** What to tell someone who can't act yet, or null once they can. */
export function verificationBlocker(
  status: IdentityStatus,
  role?: string | null
): string | null {
  switch (status) {
    case "approved":
      return null;
    case "in_review":
      return "We're checking your ID. This usually takes a few minutes.";
    case "in_progress":
      return `Finish verifying your ID to ${lockedWork(role)}.`;
    case "declined":
      return "We couldn't verify your ID. You can try again.";
    case "expired":
    case "abandoned":
      return "Your ID check didn't finish. Start it again to continue.";
    default:
      return `Verify your ID to ${lockedWork(role)}.`;
  }
}

export async function fetchMyIdentityStatus(userId: string): Promise<IdentityState> {
  const { data } = await supabase
    .from("private_profiles")
    .select("identity_status, identity_last_reason, identity_decision_at")
    .eq("id", userId)
    .maybeSingle();

  // No row yet means nobody has started a check for this account.
  return {
    status: (data?.identity_status as IdentityStatus) ?? "unstarted",
    reason: data?.identity_last_reason ?? null,
    decidedAt: data?.identity_decision_at ?? null,
  };
}

export type VerificationStart = {
  /** Didit's hosted page, or null when there's nothing for the person to do. */
  url: string | null;
  status: IdentityStatus;
  error: Error | null;
};

/**
 * Starts or resumes the check and returns where to send the person. The apps
 * open this URL — web redirects, mobile opens a browser — and Didit sends them
 * back to the callback when they're done.
 */
export async function startIdentityVerification(): Promise<VerificationStart> {
  const { data, error } = await supabase.functions.invoke("start-id-verification", { body: {} });
  if (error) {
    // The function answers with { error } — surface that text, not "non-2xx".
    const context = (error as { context?: Response }).context;
    let message = error.message;
    try {
      const payload = context ? await context.json() : null;
      if (payload?.error) message = payload.error;
    } catch {
      /* keep the generic message */
    }
    return { url: null, status: "unstarted", error: new Error(message) };
  }

  const payload = data as { url?: string | null; status?: string } | null;
  return {
    url: payload?.url ?? null,
    status: (payload?.status as IdentityStatus) ?? "unstarted",
    error: null,
  };
}
