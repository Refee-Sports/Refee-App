import { supabase } from "../client";
import { invokeErrorMessage } from "../payments/queries";

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

// ── Accounts ────────────────────────────────────────────────────────────────

export type AccountRow = UserSearchRow & {
  roles: string[];
  deactivated: boolean;
  total_count: number;
};

export type AccountDetail = {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  legal_first_name: string | null;
  legal_last_name: string | null;
  legal_name: string | null;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  primary_role: string | null;
  roles: string[];
  city: string | null;
  state: string | null;
  home_zip: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  organizations: { id: string; org_name: string; org_type: string | null; city: string | null; state: string | null }[];
  identity: {
    status: string;
    reason: string | null;
    decided_at: string | null;
    verified_at: string | null;
    session_id: string | null;
  };
  payout_account: { status: string | null; connected: boolean };
  suspension: { suspended_at: string | null; reason: string | null };
  deactivated: boolean;
  is_staff: boolean;
  badges: {
    is_verified: boolean;
    is_active: boolean;
    rating: number | null;
    rating_count: number | null;
    games_called_total: number | null;
  };
  work: { assignments: number; accepted: number; unpaid_owed: number; games_posted: number };
  recent_staff_actions: { action: string; detail: Record<string, unknown>; at: string; by: string | null }[];
};

/** Fields staff can change for someone (admin_update_profile, 0074). */
export const EDITABLE_FIELDS = [
  "first_name",
  "legal_first_name",
  "legal_last_name",
  "date_of_birth",
  "phone",
  "city",
  "state",
  "home_zip",
  "org_name",
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];
export type ProfileForm = Partial<Record<EditableField, string | null>>;
export type ProfileChanges = Partial<Record<EditableField, string | null>>;

/** Where each field starts in the edit form. */
export function profileFormFrom(d: AccountDetail): Record<EditableField, string> {
  return {
    first_name: d.first_name ?? "",
    legal_first_name: d.legal_first_name ?? "",
    legal_last_name: d.legal_last_name ?? "",
    date_of_birth: d.date_of_birth ?? "",
    phone: d.phone ?? "",
    city: d.city ?? "",
    state: (d.state ?? "").trim(),
    home_zip: d.home_zip ?? "",
    org_name: d.organizations?.[0]?.org_name ?? "",
  };
}

/**
 * Only what staff actually changed, trimmed: a blank field means "remove it",
 * and states are upper-cased so "tx" over "TX" isn't a change.
 */
export function profileChanges(before: AccountDetail, form: ProfileForm): ProfileChanges {
  const start = profileFormFrom(before);
  const out: ProfileChanges = {};
  for (const key of EDITABLE_FIELDS) {
    if (!(key in form)) continue;
    let next = (form[key] ?? "").trim();
    if (key === "state") next = next.toUpperCase();
    const prev = key === "state" ? start[key].toUpperCase() : start[key];
    if (next !== prev) out[key] = next === "" ? null : next;
  }
  return out;
}

/** Every account, or a search over them, a page at a time. */
export async function listAccounts(opts: {
  query?: string;
  role?: string | null;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AccountRow[]; total: number; error: Error | null }> {
  const { data, error } = await supabase.rpc("admin_list_accounts", {
    p_query: opts.query?.trim() || null,
    p_role: opts.role ?? null,
    p_limit: opts.limit ?? 50,
    p_offset: opts.offset ?? 0,
  });
  if (error) return { rows: [], total: 0, error: new Error(error.message) };
  const rows = (data ?? []) as AccountRow[];
  return { rows, total: Number(rows[0]?.total_count ?? 0), error: null };
}

export async function fetchAccount(
  userId: string
): Promise<{ account: AccountDetail | null; error: Error | null }> {
  const { data, error } = await supabase.rpc("admin_user_detail", { p_user: userId });
  if (error) return { account: null, error: new Error(error.message) };
  return { account: (data ?? null) as AccountDetail | null, error: null };
}

/** Saves staff's edits. Returns {field: {from, to}} for what changed. */
export async function updateProfile(
  userId: string,
  changes: ProfileChanges,
  reason?: string | null
): Promise<{ changed: Record<string, { from: unknown; to: unknown }>; error: Error | null }> {
  const { data, error } = await supabase.rpc("admin_update_profile", {
    p_user: userId,
    p_changes: changes,
    p_reason: reason ?? null,
  });
  if (error) return { changed: {}, error: new Error(error.message) };
  return { changed: (data ?? {}) as Record<string, { from: unknown; to: unknown }>, error: null };
}

// ── Money ───────────────────────────────────────────────────────────────────

export type RefereeLedgerLine = {
  assignment_id: string;
  job_id: string;
  title: string | null;
  org_name: string | null;
  starts_at: string | null;
  job_status: string | null;
  role: string | null;
  status: string | null;
  amount_due: number | null;
  payout_status: string | null;
  paid_at: string | null;
  stripe_transfer_id: string | null;
};

export type DirectorChargeLine = {
  job_id: string;
  title: string | null;
  starts_at: string | null;
  status: string | null;
  pay_total: number | null;
  payment_status: string | null;
  prepaid_at: string | null;
  prepaid_crew_cents: number | null;
  prepaid_fee_cents: number | null;
  refunded_amount_cents: number | null;
  dispute_status: string | null;
  requires_review: boolean | null;
  review_reason: string | null;
  payment_intent_id: string | null;
  stripe_charge_id: string | null;
  crew_owed: number;
};

export type AccountFinances = {
  payout_account: { status: string | null; connected: boolean; stripe_account_id: string | null } | null;
  referee: {
    paid_total: number;
    pending_total: number;
    processing_total: number;
    failed_total: number;
    lines: RefereeLedgerLine[];
  } | null;
  director: {
    org_names: string[];
    charged_cents: number;
    fees_cents: number;
    refunded_cents: number;
    disputes: number;
    needs_review: number;
    crew_owed: number;
    jobs: DirectorChargeLine[];
  } | null;
};

export async function fetchUserFinances(
  userId: string
): Promise<{ finances: AccountFinances | null; error: Error | null }> {
  const { data, error } = await supabase.rpc("admin_user_finances", { p_user: userId });
  if (error) return { finances: null, error: new Error(error.message) };
  return { finances: (data ?? null) as AccountFinances | null, error: null };
}

// ── Sign-in actions (admin-account edge function) ───────────────────────────

export type AdminAccountAction = "view_as" | "deactivate" | "reactivate";

/**
 * View as, deactivate, reactivate. These need the auth admin API, so they go
 * through the admin-account edge function, which checks staff membership the
 * same way the database functions do.
 */
export async function adminAccountAction(
  action: AdminAccountAction,
  userId: string,
  reason?: string | null
): Promise<{ tokenHash: string | null; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke("admin-account", {
    body: { action, userId, reason: reason ?? null },
  });
  if (error) return { tokenHash: null, error: new Error(await invokeErrorMessage(error)) };
  if (data?.error) return { tokenHash: null, error: new Error(String(data.error)) };
  return { tokenHash: (data?.tokenHash as string | undefined) ?? null, error: null };
}

/**
 * The page that signs in as someone. The token rides in the fragment, which
 * browsers never send to a server, so it can't end up in a request log.
 */
export function viewAsUrl(origin: string, tokenHash: string): string {
  return `${origin.replace(/\/$/, "")}/auth/view-as#token_hash=${encodeURIComponent(tokenHash)}`;
}

// ── Metrics ─────────────────────────────────────────────────────────────────

const VERIFICATION_ORDER = ["approved", "in_review", "in_progress", "declined", "expired", "abandoned", "unstarted"];

/** Verification statuses as shares of everyone, for a stacked bar. */
export function verificationBreakdown(
  counts: Record<string, number>
): { status: string; count: number; pct: number }[] {
  const entries = Object.entries(counts).filter(([, n]) => Number(n) > 0);
  const total = entries.reduce((sum, [, n]) => sum + Number(n), 0);
  if (total === 0) return [];
  const rank = (s: string) => {
    const i = VERIFICATION_ORDER.indexOf(s);
    return i === -1 ? VERIFICATION_ORDER.length : i;
  };
  return entries
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([status, n]) => ({ status, count: Number(n), pct: Math.round((Number(n) / total) * 100) }));
}
