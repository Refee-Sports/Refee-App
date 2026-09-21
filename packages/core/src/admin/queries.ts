import { supabase } from "../client";

// The staff tools. Every one of these is a call into a security-definer
// function that checks membership of public.admins for itself (0050/0051) —
// the client never decides who is staff, it only asks and is refused or not.
// So there is nothing here to bypass: hiding the nav link is a courtesy, not
// the access control.

export type IdentityQueueRow = {
  user_id: string;
  display_name: string | null;
  legal_name: string | null;
  primary_role: string | null;
  identity_status: string;
  identity_last_reason: string | null;
  identity_decision_at: string | null;
  date_of_birth: string | null;
  suspended_at: string | null;
  created_at: string;
};

export type UserSearchRow = {
  user_id: string;
  display_name: string | null;
  legal_name: string | null;
  phone: string | null;
  email: string | null;
  primary_role: string | null;
  city: string | null;
  state: string | null;
  identity_status: string;
  suspended_at: string | null;
  created_at: string;
};

export type PaymentIssueRow = {
  job_id: string;
  title: string | null;
  org_name: string | null;
  starts_at: string | null;
  job_status: string | null;
  payment_status: string | null;
  dispute_status: string | null;
  refund_status: string | null;
  requires_review: boolean | null;
  review_reason: string | null;
  crew_owed: number | null;
  last_event_at: string | null;
};

export type AdminMetrics = {
  users: {
    total: number;
    referees: number;
    directors: number;
    assignors: number;
    new_7d: number;
  };
  verification: Record<string, number>;
  suspended: number;
  games: {
    open: number;
    upcoming: number;
    completed_30d: number;
    unfilled_next_7d: number;
  };
  money: { owed_to_crew: number; paid_30d: number; needs_review: number };
};

/**
 * Whether this session is staff.
 *
 * Only decides what to render. The functions below refuse a non-admin on their
 * own, so a person who forces their way onto the page finds every panel empty.
 */
export async function amIStaff(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase.rpc("is_admin", { p_user: userId });
  if (error) return false;
  return data === true;
}

/** Verifications waiting on a person. Defaults to in-review and declined. */
export async function fetchIdentityQueue(
  status?: string
): Promise<{ rows: IdentityQueueRow[]; error: Error | null }> {
  const { data, error } = await supabase.rpc("admin_identity_queue", {
    p_status: status ?? null,
  });
  if (error) return { rows: [], error: new Error(error.message) };
  return { rows: (data ?? []) as IdentityQueueRow[], error: null };
}

/** A human decision on someone's identity. Moves the badges with it. */
export async function setIdentityStatus(
  userId: string,
  status: string,
  reason?: string | null
): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("admin_set_identity_status", {
    p_user: userId,
    p_status: status,
    p_reason: reason ?? null,
  });
  return { error: error ? new Error(error.message) : null };
}

export async function searchUsers(
  query: string
): Promise<{ rows: UserSearchRow[]; error: Error | null }> {
  const { data, error } = await supabase.rpc("admin_user_search", { p_query: query });
  if (error) return { rows: [], error: new Error(error.message) };
  return { rows: (data ?? []) as UserSearchRow[], error: null };
}

export async function fetchUserDetail(
  userId: string
): Promise<{ detail: Record<string, unknown> | null; error: Error | null }> {
  const { data, error } = await supabase.rpc("admin_user_detail", { p_user: userId });
  if (error) return { detail: null, error: new Error(error.message) };
  return { detail: (data ?? null) as Record<string, unknown> | null, error: null };
}

/**
 * Stop an account working, or let it work again.
 *
 * Never a delete — an account is referenced by games, payments and ratings, so
 * removing it would take other people's history with it.
 */
export async function setSuspended(
  userId: string,
  suspended: boolean,
  reason?: string | null
): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("admin_set_suspended", {
    p_user: userId,
    p_suspended: suspended,
    p_reason: reason ?? null,
  });
  return { error: error ? new Error(error.message) : null };
}

export async function fetchPaymentIssues(): Promise<{
  rows: PaymentIssueRow[];
  error: Error | null;
}> {
  const { data, error } = await supabase.rpc("admin_payment_issues");
  if (error) return { rows: [], error: new Error(error.message) };
  return { rows: (data ?? []) as PaymentIssueRow[], error: null };
}

/**
 * Marks a payment issue as dealt with. The money itself moves through Stripe
 * and the payout functions — this only clears the flag that listed it.
 */
export async function clearPaymentReview(
  jobId: string,
  note?: string | null
): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("admin_clear_payment_review", {
    p_job: jobId,
    p_note: note ?? null,
  });
  return { error: error ? new Error(error.message) : null };
}

export async function fetchAdminMetrics(): Promise<{
  metrics: AdminMetrics | null;
  error: Error | null;
}> {
  const { data, error } = await supabase.rpc("admin_metrics");
  if (error) return { metrics: null, error: new Error(error.message) };
  return { metrics: (data ?? null) as AdminMetrics | null, error: null };
}

/** How a verification status reads in the staff tools. */
export function statusLabel(status: string): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "declined":
      return "Declined";
    case "in_review":
      return "In review";
    case "in_progress":
      return "In progress";
    case "unstarted":
      return "Not started";
    case "expired":
      return "Expired";
    case "abandoned":
      return "Abandoned";
    default:
      return status;
  }
}
