import { supabase } from "../client";
import { sendPush } from "../push/send";

// ── Types ────────────────────────────────────────────────────────────────────

export type RosterStatus = "invited" | "requested" | "accepted" | "declined" | "removed";

export type RosterMemberRow = {
  roster_id: string;
  assignor_id: string;
  ref_id: string;
  status: RosterStatus;
  invited_at: string;
  responded_at: string | null;
  display_name: string;
  first_name: string;
  last_initial: string;
  avatar_url: string | null;
  city: string;
  state: string;
  rating: number;
  rating_count: number;
  is_available: boolean;
};

export type RosterInviteRow = {
  roster_id: string;
  status: RosterStatus;
  invited_at: string;
  assignor_id: string;
  assignor_name: string;
  assignor_city: string | null;
  assignor_state: string | null;
};

export type RefSearchResult = {
  id: string;
  display_name: string;
  first_name: string;
  last_initial: string;
  avatar_url: string | null;
  city: string;
  state: string;
  rating: number;
  rating_count: number;
};

export type TournamentInviteRow = {
  id: string;
  name: string;
  venue_city: string;
  venue_state: string;
  timezone: string;
  starts_on: string;
  ends_on: string;
  total_games: number | null;
  pay_per_game: number | null;
  assignor_status: string;
  assignor_fee: number | null;
  assignor_fee_type: "flat" | "percentage";
  assignor_fee_pct: number | null;
  hirer: { org_name: string } | { org_name: string }[] | null;
};

export type MyProposalRow = {
  id: string;
  tournament_id: string;
  status: string;
  fee_type: "flat" | "percentage";
  fee_amount: number | null;
  fee_pct: number | null;
  message: string | null;
  invited_at: string | null;
  submitted_at: string | null;
};

// ── Becoming an assignor ───────────────────────────────────────────────────

/**
 * Adds 'assignor' as an additional role for an existing user (referee or
 * director adding it on from their profile). Does NOT touch primary_role —
 * use setPrimaryRoleAssignor for the dedicated onboarding flow.
 */
export async function addAssignorRole(userId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "assignor" }, { onConflict: "user_id,role" });
  return { error: error ? new Error(error.message) : null };
}

export async function addRefereeRole(userId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "referee" }, { onConflict: "user_id,role" });
  return { error: error ? new Error(error.message) : null };
}

export async function fetchMyRoles(userId: string): Promise<{ roles: string[]; error: Error | null }> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) return { roles: [], error: new Error(error.message) };
  return { roles: (data ?? []).map((r) => r.role as string), error: null };
}

/** Dedicated assignor onboarding — creates the public profile with primary_role = 'assignor'. */
export async function createAssignorProfile(
  userId: string,
  args: {
    firstName: string;
    lastInitial: string;
    city: string;
    state: string;
    dateOfBirth: string;
    legalFirstName: string;
    legalLastName: string;
    /** Headshot uploaded during sign-up; required for a new profile (0057). */
    avatarUrl?: string;
  }
): Promise<{ error: Error | null }> {
  // Refee is 18+. This goes first so someone too young is turned away
  // before any profile row exists — the database refuses it (0043).
  const { error: ageError } = await supabase.from("private_profiles").upsert({
    id: userId,
    date_of_birth: args.dateOfBirth,
    // The full legal name, kept privately. Profiles only ever show a
    // first name and last initial; this is what Didit checks the ID against.
    legal_first_name: args.legalFirstName,
    legal_last_name: args.legalLastName,
  });
  if (ageError) return { error: new Error(ageError.message) };

  const { error } = await supabase.from("public_profiles").upsert({
    id: userId,
    first_name: args.firstName,
    last_initial: args.lastInitial,
    city: args.city,
    state: args.state,
    primary_role: "assignor",
    ...(args.avatarUrl ? { avatar_url: args.avatarUrl } : {}),
  });
  if (error) return { error: new Error(error.message) };

  const { error: roleErr } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "assignor" }, { onConflict: "user_id,role" });
  return { error: roleErr ? new Error(roleErr.message) : null };
}

// ── Roster ───────────────────────────────────────────────────────────────────

/** Search referees by name/city to invite onto a roster. Excludes the caller. */
export async function searchReferees(
  query: string,
  excludeUserId: string
): Promise<{ results: RefSearchResult[]; error: Error | null }> {
  const q = query.trim();
  if (q.length < 2) return { results: [], error: null };

  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, display_name, first_name, last_initial, avatar_url, city, state, rating, rating_count")
    .or(`first_name.ilike.%${q}%,city.ilike.%${q}%`)
    .neq("id", excludeUserId)
    .limit(20);

  if (error) return { results: [], error: new Error(error.message) };
  return { results: (data ?? []) as RefSearchResult[], error: null };
}

export async function inviteToRoster(
  assignorId: string,
  refId: string
): Promise<{ error: Error | null }> {
  void assignorId; // The RPC derives the assignor from the authenticated JWT.
  const { error } = await supabase.rpc("invite_existing_ref_to_roster", { p_ref_id: refId });
  return { error: error ? new Error(error.message) : null };
}

export async function removeFromRoster(rosterId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("remove_ref_from_roster", { p_roster_id: rosterId });
  return { error: error ? new Error(error.message) : null };
}

/** The assignor's view of their own roster (all statuses, most recent first). */
export async function fetchMyRoster(
  assignorId: string
): Promise<{ members: RosterMemberRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("assignor_roster_members")
    .select("*")
    .eq("assignor_id", assignorId)
    .order("invited_at", { ascending: false });

  if (error) return { members: [], error: new Error(error.message) };
  return { members: (data ?? []) as RosterMemberRow[], error: null };
}

/** A referee's pending roster invites, with the inviting assignor's public info. */
export async function fetchMyRosterInvites(
  refId: string
): Promise<{ invites: RosterInviteRow[]; error: Error | null }> {
  // Email invites sent before this person signed up become real invites now.
  await supabase.rpc("claim_roster_invites");
  const { data, error } = await supabase
    .from("assignor_rosters")
    .select("id, status, invited_at, assignor_id, assignor:public_profiles!assignor_rosters_assignor_id_fkey(display_name, city, state)")
    .eq("ref_id", refId)
    .eq("status", "invited")
    .order("invited_at", { ascending: false });

  if (error) return { invites: [], error: new Error(error.message) };

  const invites: RosterInviteRow[] = (data ?? []).map((row: any) => {
    const assignor = Array.isArray(row.assignor) ? row.assignor[0] : row.assignor;
    return {
      roster_id: row.id,
      status: row.status,
      invited_at: row.invited_at,
      assignor_id: row.assignor_id,
      assignor_name: assignor?.display_name ?? "An assignor",
      assignor_city: assignor?.city ?? null,
      assignor_state: assignor?.state ?? null,
    };
  });

  return { invites, error: null };
}

// ── Growing a roster: email, CSV, QR / code ─────────────────────────────────

export type EmailInviteResult = {
  email: string;
  result: "invited" | "pending" | "invalid" | "self" | "already_on_roster";
  user_id?: string;
};

/** Splits pasted text or a CSV into unique lowercase email addresses. */
export function parseEmails(raw: string): string[] {
  const found = raw.match(/[^\s,;<>"']+@[^\s,;<>"']+\.[^\s,;<>"']+/g) ?? [];
  return [...new Set(found.map((e) => e.trim().toLowerCase()))];
}

/**
 * Invites people by email. Anyone already on Refee gets a roster invite now;
 * everyone else is remembered and invited the first time they sign in with
 * that address. Returns one result per address.
 */
export async function inviteToRosterByEmail(
  emails: string[]
): Promise<{ results: EmailInviteResult[]; error: Error | null }> {
  const { data, error } = await supabase.rpc("invite_to_roster_by_email", { p_emails: emails });
  if (error) return { results: [], error: new Error(error.message) };
  return { results: (data ?? []) as unknown as EmailInviteResult[], error: null };
}

/** The assignor's join code (the QR code encodes a link that carries it). */
export async function fetchMyRosterInviteCode(): Promise<{ code: string | null; error: Error | null }> {
  const { data, error } = await supabase.rpc("my_roster_invite_code");
  return { code: (data as string | null) ?? null, error: error ? new Error(error.message) : null };
}

export async function rotateRosterInviteCode(): Promise<{ code: string | null; error: Error | null }> {
  const { data, error } = await supabase.rpc("rotate_roster_invite_code");
  return { code: (data as string | null) ?? null, error: error ? new Error(error.message) : null };
}

export type RosterCodePreview = {
  assignor_id: string;
  display_name: string;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
};

export async function previewRosterInviteCode(
  code: string
): Promise<{ preview: RosterCodePreview | null; error: Error | null }> {
  const { data, error } = await supabase.rpc("preview_roster_invite_code", { p_code: code });
  if (error) return { preview: null, error: new Error(error.message) };
  const row = (data as RosterCodePreview[] | null)?.[0] ?? null;
  return { preview: row, error: null };
}

export async function joinRosterByCode(code: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("join_roster_by_code", { p_code: code });
  return { error: error ? new Error(error.message) : null };
}

/** The link the QR code carries. Opens the web join page, which hands off to the app. */
export function rosterInviteLink(code: string, origin = "https://refee.app"): string {
  return `${origin}/join/${encodeURIComponent(code)}`;
}

/** Pulls the code out of a scanned link, a refee:// link, or a typed code. */
export function extractRosterCode(input: string): string | null {
  const trimmed = input.trim();
  const fromLink = trimmed.match(/\/join\/([A-Za-z0-9]+)/);
  const candidate = (fromLink?.[1] ?? trimmed).toUpperCase();
  return /^[A-Z0-9]{6,12}$/.test(candidate) ? candidate : null;
}

/**
 * Emails the people who don't have a Refee account yet (needs RESEND_API_KEY on
 * the backend). Returns `configured: false` when email isn't set up, so the
 * screen can say the message wasn't sent instead of implying it was.
 */
export async function sendRosterEmailInvites(
  emails: string[]
): Promise<{ sent: number; configured: boolean; error: Error | null }> {
  if (emails.length === 0) return { sent: 0, configured: true, error: null };
  const { data, error } = await supabase.functions.invoke("send-roster-invites", {
    body: { emails },
  });
  if (error) return { sent: 0, configured: true, error: new Error(error.message) };
  const result = (data ?? {}) as { sent?: number; configured?: boolean };
  return { sent: result.sent ?? 0, configured: result.configured !== false, error: null };
}

// ── Roster announcements (one-way) ──────────────────────────────────────────

const PUSH_BATCH = 200;

/**
 * Sends a one-way announcement to everyone on the roster and returns who was
 * reached so the caller can push them. Referees cannot reply.
 */
export async function sendRosterBlast(
  body: string
): Promise<{ recipientIds: string[]; error: Error | null }> {
  const { data, error } = await supabase.rpc("post_roster_blast", { p_body: body });
  if (error) return { recipientIds: [], error: new Error(error.message) };
  const result = data as { recipient_ids?: string[]; conversation_id?: string } | null;
  const ids = (result?.recipient_ids ?? []) as string[];

  // Push is best-effort. send-push only reaches people on the caller's roster
  // and takes at most 200 recipients per call.
  const preview = body.trim().length > 100 ? `${body.trim().slice(0, 97)}...` : body.trim();
  for (let i = 0; i < ids.length; i += PUSH_BATCH) {
    void sendPush(ids.slice(i, i + PUSH_BATCH), "Roster announcement", preview, {
      type: "message",
      conversationId: result?.conversation_id,
    });
  }
  return { recipientIds: ids, error: null };
}

// ── The referee's side: which rosters am I on? ──────────────────────────────

export type MyRosterRow = {
  roster_id: string;
  assignor_id: string;
  assignor_name: string;
  assignor_city: string | null;
  assignor_state: string | null;
  assignor_avatar: string | null;
  joined_at: string | null;
};

/** Every roster (organization) a referee is currently on. */
export async function fetchMyRosters(
  refId: string
): Promise<{ rosters: MyRosterRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("assignor_rosters")
    .select(
      "id, assignor_id, responded_at, assignor:public_profiles!assignor_rosters_assignor_id_fkey(display_name, city, state, avatar_url)"
    )
    .eq("ref_id", refId)
    .eq("status", "accepted")
    .order("responded_at", { ascending: false });
  if (error) return { rosters: [], error: new Error(error.message) };

  const rosters: MyRosterRow[] = (data ?? []).map((row: any) => {
    const assignor = Array.isArray(row.assignor) ? row.assignor[0] : row.assignor;
    return {
      roster_id: row.id,
      assignor_id: row.assignor_id,
      assignor_name: assignor?.display_name ?? "An assignor",
      assignor_city: assignor?.city ?? null,
      assignor_state: assignor?.state ?? null,
      assignor_avatar: assignor?.avatar_url ?? null,
      joined_at: row.responded_at ?? null,
    };
  });
  return { rosters, error: null };
}

/** A referee leaves a roster, or withdraws from a pending invite. */
export async function leaveRoster(rosterId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("leave_roster", { p_roster_id: rosterId });
  return { error: error ? new Error(error.message) : null };
}

/** All rosters a referee currently belongs to (accepted only) — used to scope self-assign visibility. */
export async function fetchMyAcceptedAssignorIds(
  refId: string
): Promise<{ assignorIds: string[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("assignor_rosters")
    .select("assignor_id")
    .eq("ref_id", refId)
    .eq("status", "accepted");
  if (error) return { assignorIds: [], error: new Error(error.message) };
  return { assignorIds: (data ?? []).map((r) => r.assignor_id as string), error: null };
}

export async function respondToRosterInvite(
  rosterId: string,
  accept: boolean
): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("respond_to_roster_invite", {
    p_roster_id: rosterId,
    p_accept: accept,
  });
  return { error: error ? new Error(error.message) : null };
}

// ── Tournament invites / proposals ──────────────────────────────────────────

export async function fetchTournamentInvites(
  assignorId: string
): Promise<{ invites: TournamentInviteRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("tournaments")
    .select(
      "id, name, venue_city, venue_state, timezone, starts_on, ends_on, total_games, pay_per_game, assignor_status, assignor_fee, assignor_fee_type, assignor_fee_pct, hirer:hirers(org_name)"
    )
    .eq("assignor_id", assignorId)
    .in("assignor_status", ["inviting", "reviewing"])
    .order("starts_on", { ascending: true });

  if (error) return { invites: [], error: new Error(error.message) };
  return { invites: (data ?? []) as unknown as TournamentInviteRow[], error: null };
}

export async function fetchMyAssignedTournaments(
  assignorId: string
): Promise<{ tournaments: TournamentInviteRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("tournaments")
    .select(
      "id, name, venue_city, venue_state, timezone, starts_on, ends_on, total_games, pay_per_game, assignor_status, assignor_fee, assignor_fee_type, assignor_fee_pct, hirer:hirers(org_name)"
    )
    .eq("assignor_id", assignorId)
    .eq("assignor_status", "accepted")
    .order("starts_on", { ascending: true });

  if (error) return { tournaments: [], error: new Error(error.message) };
  return { tournaments: (data ?? []) as unknown as TournamentInviteRow[], error: null };
}

export async function fetchAssignorTournament(
  tournamentId: string,
  assignorId: string
): Promise<{ tournament: TournamentInviteRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("tournaments")
    .select(
      "id, name, venue_city, venue_state, timezone, starts_on, ends_on, total_games, pay_per_game, assignor_status, assignor_fee, assignor_fee_type, assignor_fee_pct, hirer:hirers(org_name)"
    )
    .eq("id", tournamentId)
    .eq("assignor_id", assignorId)
    .maybeSingle();

  if (error) return { tournament: null, error: new Error(error.message) };
  return { tournament: data as unknown as TournamentInviteRow | null, error: null };
}

export async function fetchMyProposal(
  tournamentId: string,
  assignorId: string
): Promise<{ proposal: MyProposalRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("assignor_proposals")
    .select("id, tournament_id, status, fee_type, fee_amount, fee_pct, message, invited_at, submitted_at")
    .eq("tournament_id", tournamentId)
    .eq("assignor_id", assignorId)
    .maybeSingle();
  if (error) return { proposal: null, error: new Error(error.message) };
  return { proposal: data as MyProposalRow | null, error: null };
}

/** Assignor submits (or updates) their fee + message on an invite. */
export async function submitProposal(
  tournamentId: string,
  assignorId: string,
  args: { feeType: "flat" | "percentage"; feeAmount?: number; feePct?: number; message?: string }
): Promise<{ error: Error | null }> {
  void assignorId;
  const { error } = await supabase.rpc("submit_assignor_proposal", {
    p_tournament_id: tournamentId,
    p_fee_type: args.feeType,
    p_fee_amount: args.feeType === "flat" ? args.feeAmount ?? null : null,
    p_fee_pct: args.feeType === "percentage" ? args.feePct ?? null : null,
    p_message: args.message ?? null,
  });
  return { error: error ? new Error(error.message) : null };
}

export async function withdrawProposal(
  tournamentId: string,
  assignorId: string
): Promise<{ error: Error | null }> {
  void assignorId;
  const { error } = await supabase.rpc("withdraw_assignor_proposal", {
    p_tournament_id: tournamentId,
  });
  return { error: error ? new Error(error.message) : null };
}

// ── Staffing games inside an assigned tournament ────────────────────────────

export type AssignorGameRow = {
  id: string;
  title: string;
  home_team: string | null;
  away_team: string | null;
  starts_at: string;
  timezone?: string | null;
  venue_name: string;
  crew_size: number;
  pay_per_game: number;
  status: string;
  assignor_staffing_mode: "assignor_direct" | "self_assign" | null;
  tournament_id?: string | null;
};

export async function fetchAssignorTournamentGames(
  tournamentId: string
): Promise<{ games: AssignorGameRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, home_team, away_team, starts_at, timezone, venue_name, crew_size, pay_per_game, status, assignor_staffing_mode, tournament_id")
    .eq("tournament_id", tournamentId)
    .order("starts_at", { ascending: true });

  if (error) return { games: [], error: new Error(error.message) };
  return { games: (data ?? []) as AssignorGameRow[], error: null };
}

export async function fetchAssignorGame(
  jobId: string
): Promise<{ game: AssignorGameRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, home_team, away_team, starts_at, timezone, venue_name, crew_size, pay_per_game, status, assignor_staffing_mode, tournament_id")
    .eq("id", jobId)
    .maybeSingle();

  if (error) return { game: null, error: new Error(error.message) };
  return { game: data as AssignorGameRow | null, error: null };
}

export async function setGameStaffingMode(
  jobId: string,
  mode: "assignor_direct" | "self_assign"
): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("set_assignor_staffing_mode", {
    p_job_id: jobId,
    p_mode: mode,
  });
  return { error: error ? new Error(error.message) : null };
}

/** Assignor offers a game to a roster referee. The referee must accept it. */
export async function directAssignRefToGame(
  jobId: string,
  refId: string,
  role: "crew_chief" | "official" | "official_2" = "official"
): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("offer_ref_to_game", {
    p_job_id: jobId,
    p_ref_id: refId,
    p_role: role,
  });
  return { error: error ? new Error(error.message) : null };
}

export async function removeRefFromGame(assignmentId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("remove_ref_from_assignor_game", {
    p_assignment_id: assignmentId,
  });
  return { error: error ? new Error(error.message) : null };
}

export async function fetchGameCrew(
  jobId: string
): Promise<{ crew: Array<{ id: string; ref_id: string; role: string; status: string; display_name: string }>; error: Error | null }> {
  const { data, error } = await supabase
    .from("job_assignments")
    .select("id, ref_id, role, status, profile:public_profiles(display_name)")
    .eq("job_id", jobId)
    .in("status", ["offered", "accepted", "pending", "needs_reconfirm"]);

  if (error) return { crew: [], error: new Error(error.message) };
  const crew = (data ?? []).map((row: any) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    return {
      id: row.id,
      ref_id: row.ref_id,
      role: row.role,
      status: row.status,
      display_name: profile?.display_name ?? "Unknown",
    };
  });
  return { crew, error: null };
}
