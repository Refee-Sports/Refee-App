import { supabase } from "../client";
import { geocodeAddress } from "../geo/geocode";
import { sendPush } from "../push/send";

// ── Types ────────────────────────────────────────────────────────────────────

export type HirerRow = {
  id: string;
  user_id: string;
  org_name: string;
  org_type: string;
  contact_first_name: string | null;
  contact_last_initial: string | null;
  city: string | null;
  state: string | null;
  is_verified: boolean;
};

export type TournamentRow = {
  id: string;
  hirer_id: string;
  name: string;
  description: string | null;
  sport_id: string;
  starts_on: string;
  ends_on: string;
  venue_name: string | null;
  venue_city: string;
  venue_state: string;
  timezone: string;
  venue_address: string | null;
  venue_zip: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  /** Courts or gyms at the venue; games pick one. */
  courts: string[];
  arrival_notes: string | null;
  status: string;
  staffing_model: string;
  pay_per_game: number | null;
  ruleset: string | null;
  ruleset_modifications: string | null;
  game_format: "quarters" | "halves" | null;
  period_minutes: number | null;
  uniform_requirements: string | null;
  created_at: string;
  updated_at: string;
};

export type DirectorGameRow = {
  id: string;
  hirer_id: string;
  tournament_id: string | null;
  title: string;
  home_team: string | null;
  away_team: string | null;
  level: string;
  age_group: string | null;
  gender: string | null;
  ruleset: string | null;
  starts_at: string;
  duration_minutes: number | null;
  venue_name: string;
  venue_city: string;
  venue_state: string;
  venue_address?: string | null;
  venue_zip?: string | null;
  venue_lat?: number | null;
  venue_lng?: number | null;
  court?: string | null;
  arrival_notes?: string | null;
  team_level?: string | null;
  /** IANA zone of the venue; every time for this game is shown in it. */
  timezone?: string | null;
  /** Wall-clock start at the venue, e.g. "2026-09-20T13:30:00". */
  starts_local?: string | null;
  pay_per_game: number;
  crew_size: number;
  status: string;
  auto_accept: boolean;
  uniform_requirements: string | null;
  hirer_note: string | null;
  payment_status?: string | null;
  payment_refund_status?: "none" | "partial" | "full";
  refunded_amount_cents?: number;
  payment_dispute_status?: "none" | "open" | "won" | "lost";
  payment_issue_requires_review?: boolean;
  payment_review_reason?: "refund" | "dispute" | null;
  completed_at?: string | null;
  payout_window_hours?: number | null;
  /** Refs confirmed on the crew (accepted, needs_reconfirm or completed). */
  confirmedCount?: number;
  /** payout_status of each ref who worked the game (completed assignments). */
  refPayouts?: string[];
  /** Charged at creation (games created after prepay went live). */
  prepay_required?: boolean;
  prepaid_crew_cents?: number | null;
  prepaid_fee_cents?: number | null;
  prepaid_at?: string | null;
};

export type ApplicantRow = {
  id: string;
  ref_id: string;
  status: string;
  applied_at: string;
  responded_at: string | null;
  profile: {
    first_name: string;
    last_initial: string;
    display_name: string;
    avatar_url: string | null;
    rating: number;
    city: string;
    state: string;
  } | null;
};

export type RefereePublicView = {
  id: string;
  first_name: string;
  last_initial: string;
  display_name: string;
  avatar_url: string | null;
  city: string;
  state: string;
  rating: number;
  rating_count: number;
  certifications: Array<{ org_name: string; license_number: string | null }>;
  levels: Array<{ level_id: string }>;
};

// ── Hirer profile ────────────────────────────────────────────────────────────

export async function fetchMyHirerProfile(userId: string) {
  return supabase
    .from("hirers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
}

export async function fetchMyHirerId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("hirers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function createDirectorProfile(
  userId: string,
  args: {
    contactFirstName: string;
    contactLastInitial: string;
    orgName: string;
    orgType: string;
    city: string;
    state: string;
  }
): Promise<{ hirerId: string | null; error: Error | null }> {
  const { error: profileError } = await supabase.from("public_profiles").upsert({
    id: userId,
    first_name: args.contactFirstName,
    last_initial: args.contactLastInitial,
    city: args.city,
    state: args.state,
    primary_role: "director",
  });
  if (profileError) return { hirerId: null, error: new Error(profileError.message) };

  const { data, error: hirerError } = await supabase
    .from("hirers")
    .insert({
      user_id: userId,
      org_name: args.orgName,
      org_type: args.orgType,
      city: args.city,
      state: args.state,
      contact_first_name: args.contactFirstName,
      contact_last_initial: args.contactLastInitial,
    })
    .select("id")
    .single();

  if (hirerError) return { hirerId: null, error: new Error(hirerError.message) };
  return { hirerId: data.id, error: null };
}

// ── Tournaments ──────────────────────────────────────────────────────────────

export async function fetchMyTournaments(
  userId: string
): Promise<{ tournaments: TournamentRow[]; error: Error | null }> {
  const hirerId = await fetchMyHirerId(userId);
  if (!hirerId) return { tournaments: [], error: null };

  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("hirer_id", hirerId)
    .order("starts_on", { ascending: false });

  if (error) return { tournaments: [], error: new Error(error.message) };
  return { tournaments: (data ?? []) as TournamentRow[], error: null };
}

export async function fetchTournamentById(
  id: string
): Promise<{ tournament: TournamentRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return { tournament: null, error: new Error(error.message) };
  return { tournament: data as TournamentRow | null, error: null };
}

export async function createTournament(
  hirerId: string,
  args: {
    name: string;
    description?: string;
    startsOn: string;
    endsOn: string;
    venueName?: string;
    venueCity: string;
    venueState: string;
    /** IANA zone for the schedule. When omitted, the database takes it from the venue's pin or state. */
    timezone?: string;
    venueAddress?: string;
    venueZip?: string;
    /** Courts or gyms at the venue, e.g. ["Main floor", "Aux gym · Court 2"]. */
    courts?: string[];
    arrivalNotes?: string;
    ruleset?: string;
    rulesetModifications?: string;
    gameFormat?: "quarters" | "halves";
    periodMinutes?: number;
    uniformRequirements?: string;
    /** Default pay per game; games added to the tournament start with it. */
    payPerGame?: number | null;
  }
): Promise<{ tournamentId: string | null; error: Error | null }> {
  const coords = args.venueAddress?.trim()
    ? await geocodeAddress(venueQuery({ ...args, venueCity: args.venueCity, venueState: args.venueState }))
    : null;
  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      hirer_id: hirerId,
      name: args.name,
      description: args.description || null,
      sport_id: "basketball",
      starts_on: args.startsOn,
      ends_on: args.endsOn,
      venue_name: args.venueName || null,
      venue_city: args.venueCity,
      venue_state: args.venueState,
      ...(args.timezone || coords?.timezone ? { timezone: args.timezone || coords?.timezone } : {}),
      ...(args.venueAddress !== undefined
        ? { venue_address: args.venueAddress.trim() || null, venue_zip: args.venueZip?.trim() || null,
            venue_lat: coords?.lat ?? null, venue_lng: coords?.lng ?? null }
        : {}),
      ...(args.courts !== undefined ? { courts: args.courts } : {}),
      ...(args.arrivalNotes !== undefined ? { arrival_notes: args.arrivalNotes.trim() || null } : {}),
      ruleset: args.ruleset || null,
      ruleset_modifications: args.rulesetModifications || null,
      game_format: args.gameFormat ?? null,
      period_minutes: args.periodMinutes ?? null,
      uniform_requirements: args.uniformRequirements || null,
      pay_per_game: args.payPerGame ?? null,
      staffing_model: "direct",
      status: "open",
    })
    .select("id")
    .single();

  if (error) return { tournamentId: null, error: new Error(error.message) };
  return { tournamentId: data.id, error: null };
}

export async function updateTournamentStatus(
  id: string,
  status: "open" | "staffed" | "completed" | "cancelled"
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("tournaments")
    .update({ status })
    .eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

// ── Games ────────────────────────────────────────────────────────────────────

const CONFIRMED_STATUSES = new Set(["accepted", "needs_reconfirm", "completed"]);

/**
 * Folds each game's embedded job_assignments into the two numbers the list
 * screens need — how full the crew is, and whether the refs who worked it were
 * paid — and drops the raw embed.
 */
function withStaffing(rows: unknown[]): DirectorGameRow[] {
  return (rows as Array<Record<string, unknown>>).map(({ job_assignments, ...job }) => {
    const list = (job_assignments ?? []) as Array<{ status: string; payout_status: string | null }>;
    return {
      ...(job as unknown as DirectorGameRow),
      confirmedCount: list.filter((a) => CONFIRMED_STATUSES.has(a.status)).length,
      refPayouts: list
        .filter((a) => a.status === "completed")
        .map((a) => a.payout_status ?? "pending"),
    };
  });
}

export async function fetchTournamentGames(
  tournamentId: string
): Promise<{ games: DirectorGameRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*, job_assignments(status, payout_status)")
    .eq("tournament_id", tournamentId)
    .order("starts_at", { ascending: true });

  if (error) return { games: [], error: new Error(error.message) };
  return { games: withStaffing(data ?? []), error: null };
}

export type CreateGameArgs = {
  homeTeam: string;
  awayTeam: string;
  level: string;
  crewSize: 2 | 3;
  payPerGame: number;
  startsAt: string;
  durationMinutes?: number;
  venueName: string;
  venueCity: string;
  venueState: string;
  /** Street line, e.g. "1 South Ave". Geocoded with city/state/ZIP for the map pin. */
  venueAddress?: string;
  venueZip?: string;
  /** Which court or gym at the venue. */
  court?: string;
  /** Entrance, parking, doors time, check-in (max 280). */
  arrivalNotes?: string;
  /** High school only: varsity | jv | freshman. */
  teamLevel?: string;
  /** IANA zone override; normally taken from the venue's map pin. */
  timezone?: string;
  uniformRequirements?: string;
  hirerNote?: string;
  autoAccept?: boolean;
  ageGroup?: string;
  gender?: string;
  ruleset?: string;
  gameFormat?: "quarters" | "halves";
  periodMinutes?: number;
  rulesetModifications?: string;
};

/** What the geocoder gets: the full street address when there is one, else the city. */
function venueQuery(v: { venueAddress?: string; venueZip?: string; venueCity: string; venueState: string }): string {
  const street = v.venueAddress?.trim();
  const zip = v.venueZip?.trim();
  return street
    ? `${street}, ${v.venueCity}, ${v.venueState}${zip ? ` ${zip}` : ""}, USA`
    : `${v.venueCity}, ${v.venueState}, USA`;
}

/**
 * Creates a game. Pass tournamentId = null for a standalone single game.
 * `startsAt` is the wall-clock time at the venue ("2026-09-20T13:30:00"); the
 * database turns it into the right instant in the venue's time zone.
 */
export async function createGame(
  hirerId: string,
  tournamentId: string | null,
  args: CreateGameArgs
): Promise<{ gameId: string | null; error: Error | null }> {
  // Geocode the venue for distance-based feed filtering (best-effort).
  const coords = await geocodeAddress(venueQuery(args));

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      hirer_id: hirerId,
      tournament_id: tournamentId,
      sport_id: "basketball",
      title: `${args.homeTeam} vs ${args.awayTeam}`,
      home_team: args.homeTeam,
      away_team: args.awayTeam,
      level: args.level,
      crew_size: args.crewSize,
      pay_per_game: args.payPerGame,
      starts_at: args.startsAt,
      starts_local: args.startsAt,
      timezone: args.timezone || coords?.timezone || null,
      duration_minutes: args.durationMinutes ?? null,
      venue_name: args.venueName,
      venue_city: args.venueCity,
      venue_state: args.venueState,
      venue_address: args.venueAddress?.trim() || null,
      venue_zip: args.venueZip?.trim() || null,
      court: args.court?.trim() || null,
      arrival_notes: args.arrivalNotes?.trim() || null,
      team_level: args.teamLevel || null,
      venue_lat: coords?.lat ?? null,
      venue_lng: coords?.lng ?? null,
      uniform_requirements: args.uniformRequirements || null,
      hirer_note: args.hirerNote || null,
      auto_accept: args.autoAccept ?? false,
      age_group: args.ageGroup || null,
      gender: args.gender || null,
      ruleset: args.ruleset || null,
      ruleset_modifications: args.rulesetModifications || null,
      game_format: args.gameFormat ?? null,
      period_minutes: args.periodMinutes ?? null,
      job_type: tournamentId ? "tournament" : "single",
      status: "open",
      num_games: 1,
    })
    .select("id")
    .single();

  if (error) return { gameId: null, error: new Error(error.message) };
  return { gameId: data.id, error: null };
}

export async function fetchGameById(
  id: string
): Promise<{ game: DirectorGameRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return { game: null, error: new Error(error.message) };
  return { game: data as DirectorGameRow | null, error: null };
}

/**
 * Switches a game between auto-accepting referees and manual approval.
 * Only affects applications that arrive after the change — respond_to_job
 * reads auto_accept when a ref applies.
 */
export async function setGameAutoAccept(
  gameId: string,
  autoAccept: boolean
): Promise<{ error: Error | null }> {
  const { data, error } = await supabase
    .from("jobs")
    .update({ auto_accept: autoAccept })
    .eq("id", gameId)
    .select("id");
  if (error) return { error: new Error(error.message) };
  // An update that matches no row is not an error in Postgres, so check the
  // row came back rather than reporting a save that never happened.
  if (!data || data.length === 0) {
    return { error: new Error("Couldn't update this game's acceptance setting.") };
  }
  return { error: null };
}

// ── Applicant management ─────────────────────────────────────────────────────

export async function fetchGameApplicants(
  jobId: string
): Promise<{ applicants: ApplicantRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("job_assignments")
    .select(
      "id, ref_id, status, applied_at, responded_at, public_profiles(first_name, last_initial, display_name, avatar_url, rating, city, state)"
    )
    .eq("job_id", jobId)
    .order("applied_at", { ascending: true });

  if (error) return { applicants: [], error: new Error(error.message) };

  const applicants: ApplicantRow[] = (data ?? []).map((row: any) => ({
    id: row.id,
    ref_id: row.ref_id,
    status: row.status,
    applied_at: row.applied_at,
    responded_at: row.responded_at,
    profile: Array.isArray(row.public_profiles)
      ? (row.public_profiles[0] ?? null)
      : row.public_profiles,
  }));

  return { applicants, error: null };
}

export type PendingApproval = {
  assignmentId: string;
  refId: string;
  appliedAt: string;
  profile: ApplicantRow["profile"];
  job: {
    id: string;
    title: string;
    startsAt: string;
    timeZone: string | null;
    venueCity: string;
    venueState: string;
    payPerGame: number;
    crewSize: number;
    tournamentName: string | null;
    acceptedCount: number;
  };
};

/**
 * Every referee waiting on this director, across all of their games — single
 * games and tournament games alike — so approvals can be worked from one list
 * instead of opening each game in turn.
 *
 * Leaves out applications the director can't act on anyway, which the
 * director_respond_to_application RPC would reject: games that have started or
 * closed, and tournament games staffed by an accepted assignor.
 */
export async function fetchPendingApprovals(
  userId: string
): Promise<{ approvals: PendingApproval[]; error: Error | null }> {
  const hirerId = await fetchMyHirerId(userId);
  if (!hirerId) return { approvals: [], error: null };

  const { data, error } = await supabase
    .from("job_assignments")
    .select(
      "id, ref_id, applied_at, public_profiles(first_name, last_initial, display_name, avatar_url, rating, city, state), jobs!inner(id, title, starts_at, timezone, venue_city, venue_state, pay_per_game, crew_size, status, hirer_id, tournaments(name, assignor_id, assignor_status))"
    )
    .eq("status", "pending")
    .eq("jobs.hirer_id", hirerId)
    .order("applied_at", { ascending: true });

  if (error) return { approvals: [], error: new Error(error.message) };

  const now = Date.now();
  const one = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

  const actionable = (data ?? []).filter((row: any) => {
    const job = one<any>(row.jobs);
    if (!job) return false;
    if (job.status === "completed" || job.status === "cancelled") return false;
    if (new Date(job.starts_at).getTime() <= now) return false;
    const t = one<any>(job.tournaments);
    return !(t?.assignor_id && t?.assignor_status === "accepted");
  });

  // How full each crew already is, so the list can say "2 / 3 confirmed".
  const jobIds = [...new Set(actionable.map((row: any) => one<any>(row.jobs).id as string))];
  const acceptedByJob = new Map<string, number>();
  if (jobIds.length > 0) {
    const { data: accepted } = await supabase
      .from("job_assignments")
      .select("job_id")
      .in("job_id", jobIds)
      .in("status", ["accepted", "needs_reconfirm"]);
    for (const a of accepted ?? []) {
      acceptedByJob.set(a.job_id, (acceptedByJob.get(a.job_id) ?? 0) + 1);
    }
  }

  const approvals: PendingApproval[] = actionable
    .map((row: any) => {
      const job = one<any>(row.jobs);
      return {
        assignmentId: row.id,
        refId: row.ref_id,
        appliedAt: row.applied_at,
        profile: one<any>(row.public_profiles),
        job: {
          id: job.id,
          title: job.title,
          startsAt: job.starts_at,
          timeZone: job.timezone ?? null,
          venueCity: job.venue_city,
          venueState: job.venue_state,
          payPerGame: job.pay_per_game,
          crewSize: job.crew_size ?? 1,
          tournamentName: one<any>(job.tournaments)?.name ?? null,
          acceptedCount: acceptedByJob.get(job.id) ?? 0,
        },
      };
    })
    // Soonest game first; within a game, first come first served.
    .sort(
      (a, b) =>
        new Date(a.job.startsAt).getTime() - new Date(b.job.startsAt).getTime() ||
        new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime()
    );

  return { approvals, error: null };
}

export async function approveApplicant(
  jobId: string,
  refId: string
): Promise<{ error: Error | null }> {
  // job_assignments has no UPDATE policy — a direct write here matches zero
  // rows and reports no error, so the button looked like it worked and never
  // did. The security-definer RPC is the sanctioned path, and it also checks
  // crew size and schedule conflicts.
  const { error } = await supabase.rpc("director_respond_to_application", {
    p_job_id: jobId,
    p_ref_id: refId,
    p_accept: true,
  });
  // director_respond_to_application also flips the game to 'staffed' once
  // the crew is full.
  if (error) return { error: new Error(error.message) };

  // Notify the ref they're confirmed
  const { data: job } = await supabase.from("jobs").select("title").eq("id", jobId).maybeSingle();
  void sendPush(
    [refId],
    "You're confirmed! ✓",
    `You've been accepted for ${job?.title ?? "a game"}.`,
    { type: "accepted", jobId }
  );
  return { error: null };
}

/** Standalone (non-tournament) games created by this director. */
export async function fetchStandaloneGames(
  userId: string
): Promise<{ games: DirectorGameRow[]; error: Error | null }> {
  const hirerId = await fetchMyHirerId(userId);
  if (!hirerId) return { games: [], error: null };

  const { data, error } = await supabase
    .from("jobs")
    .select("*, job_assignments(status, payout_status)")
    .eq("hirer_id", hirerId)
    .is("tournament_id", null)
    .order("starts_at", { ascending: true });

  if (error) return { games: [], error: new Error(error.message) };
  return { games: withStaffing(data ?? []), error: null };
}

export async function declineApplicantForGame(
  jobId: string,
  refId: string
): Promise<{ error: Error | null }> {
  // Same reason as approveApplicant: direct updates are blocked by RLS.
  const { error } = await supabase.rpc("director_respond_to_application", {
    p_job_id: jobId,
    p_ref_id: refId,
    p_accept: false,
  });
  return { error: error ? new Error(error.message) : null };
}

// ── Referee public view (director sees limited info only) ────────────────────

export async function fetchRefereePublicView(
  refId: string
): Promise<{ ref: RefereePublicView | null; error: Error | null }> {
  const [profileRes, certsRes, levelsRes] = await Promise.all([
    supabase
      .from("public_profiles")
      .select("id, first_name, last_initial, display_name, avatar_url, city, state, rating, rating_count")
      .eq("id", refId)
      .maybeSingle(),
    supabase
      .from("certifications")
      .select("org_name, license_number")
      .eq("ref_id", refId),
    supabase.from("ref_levels").select("level_id").eq("ref_id", refId),
  ]);

  if (profileRes.error) return { ref: null, error: new Error(profileRes.error.message) };
  if (!profileRes.data) return { ref: null, error: null };

  return {
    ref: {
      ...(profileRes.data as any),
      certifications: (certsRes.data ?? []) as any,
      levels: (levelsRes.data ?? []) as any,
    },
    error: null,
  };
}

// ── Ratings ───────────────────────────────────────────────────────────────────

export type CategoryRatings = {
  onTime: number;
  professionalism: number;
  gameManagement: number;
};

export async function submitRefereeRating(
  jobId: string,
  refId: string,
  hirerId: string,
  scores: CategoryRatings,
  comment?: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("ratings").insert({
    job_id: jobId,
    ref_id: refId,
    hirer_id: hirerId,
    on_time: scores.onTime,
    professionalism: scores.professionalism,
    game_management: scores.gameManagement,
    rating: Math.round((scores.onTime + scores.professionalism + scores.gameManagement) / 3),
    comment: comment?.trim() || null,
  });
  return { error: error ? new Error(error.message) : null };
}

export async function fetchExistingRating(
  jobId: string,
  refId: string,
  hirerId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("ratings")
    .select("id")
    .eq("job_id", jobId)
    .eq("ref_id", refId)
    .eq("hirer_id", hirerId)
    .maybeSingle();
  return !!data;
}

// ── Editing games & tournaments ──────────────────────────────────────────────

export type GameUpdateArgs = {
  homeTeam: string;
  awayTeam: string;
  level: string;
  crewSize: 2 | 3;
  payPerGame: number;
  startsAt: string;
  durationMinutes?: number;
  venueName: string;
  venueCity: string;
  venueState: string;
  /** Street line, e.g. "1 South Ave". Geocoded with city/state/ZIP for the map pin. */
  venueAddress?: string;
  venueZip?: string;
  /** Which court or gym at the venue. */
  court?: string;
  /** Entrance, parking, doors time, check-in (max 280). */
  arrivalNotes?: string;
  /** High school only: varsity | jv | freshman. */
  teamLevel?: string;
  /** IANA zone override; normally taken from the venue's map pin. */
  timezone?: string;
  uniformRequirements?: string;
  hirerNote?: string;
  autoAccept?: boolean;
  ageGroup?: string;
  ruleset?: string;
  rulesetModifications?: string;
  gameFormat?: "quarters" | "halves";
  periodMinutes?: number;
};

/**
 * Updates a game. If time, venue, or pay changed, all accepted refs are
 * flipped to `needs_reconfirm` and a system note is posted to the crew
 * thread so they know to re-accept.
 */
export async function updateGame(
  gameId: string,
  editorUserId: string,
  args: GameUpdateArgs
): Promise<{ error: Error | null; refsNeedReconfirm: boolean }> {
  const { data: before, error: beforeErr } = await supabase
    .from("jobs")
    .select("starts_at, starts_local, venue_name, venue_city, venue_state, venue_address, venue_zip, pay_per_game")
    .eq("id", gameId)
    .maybeSingle();
  if (beforeErr) return { error: new Error(beforeErr.message), refsNeedReconfirm: false };

  // Re-geocode only if the location changed
  const locationChanged =
    !before ||
    before.venue_city !== args.venueCity ||
    before.venue_state !== args.venueState ||
    (args.venueAddress !== undefined && (before.venue_address ?? "") !== args.venueAddress.trim()) ||
    (args.venueZip !== undefined && (before.venue_zip ?? "") !== args.venueZip.trim());
  const coords = locationChanged
    ? await geocodeAddress(venueQuery(args))
    : null;

  const { error } = await supabase
    .from("jobs")
    .update({
      title: `${args.homeTeam} vs ${args.awayTeam}`,
      home_team: args.homeTeam,
      away_team: args.awayTeam,
      level: args.level,
      crew_size: args.crewSize,
      pay_per_game: args.payPerGame,
      starts_at: args.startsAt,
      starts_local: args.startsAt,
      ...(args.timezone
        ? { timezone: args.timezone }
        : locationChanged && coords?.timezone
          ? { timezone: coords.timezone }
          : {}),
      duration_minutes: args.durationMinutes ?? null,
      venue_name: args.venueName,
      venue_city: args.venueCity,
      venue_state: args.venueState,
      ...(args.venueAddress !== undefined ? { venue_address: args.venueAddress.trim() || null } : {}),
      ...(args.venueZip !== undefined ? { venue_zip: args.venueZip.trim() || null } : {}),
      ...(args.court !== undefined ? { court: args.court.trim() || null } : {}),
      ...(args.arrivalNotes !== undefined ? { arrival_notes: args.arrivalNotes.trim() || null } : {}),
      ...(args.teamLevel !== undefined ? { team_level: args.teamLevel || null } : {}),
      ...(locationChanged ? { venue_lat: coords?.lat ?? null, venue_lng: coords?.lng ?? null } : {}),
      uniform_requirements: args.uniformRequirements || null,
      hirer_note: args.hirerNote || null,
      auto_accept: args.autoAccept ?? false,
      age_group: args.ageGroup || null,
      ruleset: args.ruleset || null,
      ruleset_modifications: args.rulesetModifications || null,
      game_format: args.gameFormat ?? null,
      period_minutes: args.periodMinutes ?? null,
    })
    .eq("id", gameId);
  if (error) return { error: new Error(error.message), refsNeedReconfirm: false };

  const materialChange =
    !!before &&
    (String(before.starts_local ?? "").slice(0, 16) !== args.startsAt.slice(0, 16) ||
      before.venue_name !== args.venueName ||
      before.venue_city !== args.venueCity ||
      before.venue_state !== args.venueState ||
      before.pay_per_game !== args.payPerGame);

  if (!materialChange) return { error: null, refsNeedReconfirm: false };

  // Migration 0030 flips accepted refs transactionally from the database
  // trigger. Read the affected crew for push delivery and UI feedback.
  const { data: flipped } = await supabase
    .from("job_assignments")
    .select("ref_id")
    .eq("job_id", gameId)
    .eq("status", "needs_reconfirm");

  const hadAccepted = (flipped ?? []).length > 0;

  // Push the affected refs to re-confirm
  if (hadAccepted) {
    void sendPush(
      (flipped ?? []).map((f) => f.ref_id),
      "Game details changed ⚠",
      `"${args.homeTeam} vs ${args.awayTeam}" was updated — please re-confirm your spot.`,
      { type: "reconfirm", jobId: gameId }
    );
  }

  // Post a one-way director update. The RPC owns the read-only announcement
  // thread and keeps it separate from referee-to-referee crew chat.
  if (hadAccepted) {
    await supabase.rpc("post_crew_note", {
      p_job_id: gameId,
      p_body: `⚠ GAME DETAILS UPDATED — "${args.homeTeam} vs ${args.awayTeam}" changed (time, venue, or pay). Please re-confirm your spot from the job page.`,
    });
  }

  return { error: null, refsNeedReconfirm: hadAccepted };
}

export async function updateTournament(
  tournamentId: string,
  args: {
    name: string;
    description?: string;
    startsOn: string;
    endsOn: string;
    venueName?: string;
    venueCity: string;
    venueState: string;
    /** IANA zone for the schedule. When omitted, the database takes it from the venue's pin or state. */
    timezone?: string;
    venueAddress?: string;
    venueZip?: string;
    /** Courts or gyms at the venue, e.g. ["Main floor", "Aux gym · Court 2"]. */
    courts?: string[];
    arrivalNotes?: string;
    ruleset?: string;
    rulesetModifications?: string;
    gameFormat?: "quarters" | "halves";
    periodMinutes?: number;
    uniformRequirements?: string;
    /** Default pay per game; left unchanged when omitted. */
    payPerGame?: number | null;
  }
): Promise<{ error: Error | null }> {
  const coords = args.venueAddress?.trim()
    ? await geocodeAddress(venueQuery({ ...args, venueCity: args.venueCity, venueState: args.venueState }))
    : null;
  const { error } = await supabase
    .from("tournaments")
    .update({
      name: args.name,
      description: args.description || null,
      starts_on: args.startsOn,
      ends_on: args.endsOn,
      venue_name: args.venueName || null,
      venue_city: args.venueCity,
      venue_state: args.venueState,
      ...(args.timezone || coords?.timezone ? { timezone: args.timezone || coords?.timezone } : {}),
      ...(args.venueAddress !== undefined
        ? { venue_address: args.venueAddress.trim() || null, venue_zip: args.venueZip?.trim() || null,
            venue_lat: coords?.lat ?? null, venue_lng: coords?.lng ?? null }
        : {}),
      ...(args.courts !== undefined ? { courts: args.courts } : {}),
      ...(args.arrivalNotes !== undefined ? { arrival_notes: args.arrivalNotes.trim() || null } : {}),
      ruleset: args.ruleset || null,
      ruleset_modifications: args.rulesetModifications || null,
      game_format: args.gameFormat ?? null,
      period_minutes: args.periodMinutes ?? null,
      uniform_requirements: args.uniformRequirements || null,
      ...(args.payPerGame !== undefined ? { pay_per_game: args.payPerGame } : {}),
    })
    .eq("id", tournamentId);
  return { error: error ? new Error(error.message) : null };
}

/** Full game row for prefilling the edit/copy form. */
export async function fetchGameForEdit(gameId: string): Promise<{
  game: Record<string, any> | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", gameId)
    .maybeSingle();
  if (error) return { game: null, error: new Error(error.message) };
  return { game: data, error: null };
}

// ── Game lifecycle: complete + cancel ────────────────────────────────────────

/** Cancelling inside this window pays confirmed refs a 50% bust fee. */
export const CANCEL_FEE_WINDOW_HOURS = 1;

// One-way crew note via the security-definer RPC (migration 0021): the director
// posts without joining the thread, and it works whether or not the crew thread
// exists yet. senderId is unused now — the RPC posts as the authed caller.
async function postCrewNote(jobId: string, _senderId: string, body: string) {
  await supabase.rpc("post_crew_note", { p_job_id: jobId, p_body: body });
}

/** Marks the game completed and locks in full pay for confirmed refs. */
export async function completeGame(
  gameId: string,
  directorUserId: string
): Promise<{ error: Error | null }> {
  const { data, error } = await supabase.rpc("complete_game", { p_job_id: gameId });
  if (error) return { error: new Error(error.message) };
  const result = data as { title?: string; amount_due?: number } | null;
  const fullPay = result?.amount_due ?? 0;

  await postCrewNote(
    gameId,
    directorUserId,
    `✓ GAME COMPLETED — "${result?.title ?? "Game"}" is wrapped. Pay of $${fullPay} per ref is locked in. Thanks, crew!`
  );
  return { error: null };
}

/**
 * Cancels the game. Confirmed refs get a 50% bust fee if cancelled within
 * CANCEL_FEE_WINDOW_HOURS of tip-off (or after it); otherwise no pay.
 */
export async function cancelGame(
  gameId: string,
  directorUserId: string
): Promise<{ error: Error | null; feePaid: boolean; feeAmount: number }> {
  const { data, error } = await supabase.rpc("cancel_game", { p_job_id: gameId });
  if (error) return { error: new Error(error.message), feePaid: false, feeAmount: 0 };
  const result = data as {
    title?: string;
    fee_paid?: boolean;
    fee_amount?: number;
  } | null;
  const lateCancel = result?.fee_paid ?? false;
  const feeAmount = result?.fee_amount ?? 0;

  await postCrewNote(
    gameId,
    directorUserId,
    lateCancel
      ? `✕ GAME CANCELLED — "${result?.title ?? "Game"}" was cancelled inside ${CANCEL_FEE_WINDOW_HOURS}h of tip-off. A 50% fee ($${feeAmount}) is owed to each confirmed ref.`
      : `✕ GAME CANCELLED — "${result?.title ?? "Game"}" was cancelled. No fees apply.`
  );

  return { error: null, feePaid: lateCancel, feeAmount };
}

/** Which refs has this hirer already rated for this game? */
export async function fetchGameRatedRefIds(
  jobId: string,
  hirerId: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from("ratings")
    .select("ref_id")
    .eq("job_id", jobId)
    .eq("hirer_id", hirerId);
  return new Set((data ?? []).map((r) => r.ref_id));
}

// ── Completion nudge ─────────────────────────────────────────────────────────

export type NeedsCompletionRow = {
  id: string;
  title: string;
  startsAt: string;
  acceptedCount: number;
};

/**
 * Games that have already ended but aren't completed/cancelled yet — the
 * window before the 24h auto-sweep. Prompts the director to close them out
 * (and, with a card on file, auto-pay their crew).
 */
export async function fetchGamesNeedingCompletion(
  userId: string
): Promise<NeedsCompletionRow[]> {
  const hirerId = await fetchMyHirerId(userId);
  if (!hirerId) return [];

  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("jobs")
    .select("id, title, starts_at, duration_minutes, job_assignments(status)")
    .eq("hirer_id", hirerId)
    .not("status", "in", "(completed,cancelled)")
    .order("starts_at", { ascending: true });

  const now = Date.now();
  return (data ?? [])
    .map((j: any) => {
      const endMs =
        new Date(j.starts_at).getTime() + (j.duration_minutes ?? 120) * 60_000;
      const acceptedCount = (j.job_assignments ?? []).filter(
        (a: any) => a.status === "accepted" || a.status === "needs_reconfirm"
      ).length;
      return { id: j.id, title: j.title, startsAt: j.starts_at, endMs, acceptedCount };
    })
    .filter((j) => j.endMs < now)
    .map(({ endMs, ...rest }) => rest);
}

// ── Assignor staffing (tournaments) ──────────────────────────────────────────
// Director-side half of the assignor role: choose direct vs assignor-managed
// staffing, browse/invite assignors, and review their proposals.

export type AssignorBrowseRow = {
  id: string;
  display_name: string;
  city: string;
  state: string;
  rating: number;
  rating_count: number;
  is_pro_assignor: boolean;
  events_assigned: number;
  fill_rate_pct: number | null;
  avg_days_to_fill: number | null;
};

/** Browse available assignors (active_assignors view, migration 0004). */
export async function browseAssignors(): Promise<{ assignors: AssignorBrowseRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("active_assignors")
    .select("*")
    .order("is_pro_assignor", { ascending: false })
    .order("rating", { ascending: false });
  if (error) return { assignors: [], error: new Error(error.message) };
  return { assignors: (data ?? []) as AssignorBrowseRow[], error: null };
}

export async function setTournamentStaffingModel(
  tournamentId: string,
  model: "direct" | "assignor_managed"
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("tournaments")
    .update({ staffing_model: model })
    .eq("id", tournamentId);
  return { error: error ? new Error(error.message) : null };
}

/**
 * Invites an assignor to bid on staffing this tournament. Creates a proposal
 * row in 'invited' status with a suggested fee the assignor can counter
 * before submitting. Overwrites tournaments.assignor_id (single-assignor
 * model — inviting a new assignor supersedes any prior invite).
 */
export async function inviteAssignorToTournament(
  tournamentId: string,
  assignorId: string,
  suggested?: { feeType: "flat" | "percentage"; feeAmount?: number; feePct?: number }
): Promise<{ error: Error | null }> {
  const feeType = suggested?.feeType ?? "flat";
  const { error } = await supabase.rpc("director_invite_assignor", {
    p_tournament_id: tournamentId,
    p_assignor_id: assignorId,
    p_fee_type: feeType,
    p_fee_amount: feeType === "flat" ? suggested?.feeAmount ?? null : null,
    p_fee_pct: feeType === "percentage" ? suggested?.feePct ?? null : null,
  });
  return { error: error ? new Error(error.message) : null };
}

export type ProposalWithAssignorRow = {
  id: string;
  assignor_id: string;
  status: string;
  fee_type: "flat" | "percentage";
  fee_amount: number | null;
  fee_pct: number | null;
  message: string | null;
  submitted_at: string | null;
  assignor: { display_name: string; rating: number; rating_count: number } | { display_name: string; rating: number; rating_count: number }[] | null;
};

export async function fetchProposalsForTournament(
  tournamentId: string
): Promise<{ proposals: ProposalWithAssignorRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("assignor_proposals")
    .select("id, assignor_id, status, fee_type, fee_amount, fee_pct, message, submitted_at, assignor:public_profiles!assignor_proposals_assignor_id_fkey(display_name, rating, rating_count)")
    .eq("tournament_id", tournamentId)
    .order("submitted_at", { ascending: false });
  if (error) return { proposals: [], error: new Error(error.message) };
  return { proposals: (data ?? []) as unknown as ProposalWithAssignorRow[], error: null };
}

/** Accepts one assignor's proposal; the RPC locks the tournament to them and declines the rest. */
export async function acceptAssignorProposal(proposalId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("director_respond_to_assignor_proposal", {
    p_proposal_id: proposalId,
    p_accept: true,
  });
  return { error: error ? new Error(error.message) : null };
}

export async function declineAssignorProposal(proposalId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("director_respond_to_assignor_proposal", {
    p_proposal_id: proposalId,
    p_accept: false,
  });
  return { error: error ? new Error(error.message) : null };
}

// ── Deleting before a referee accepts ───────────────────────────────────────
// The delete-listing edge function checks who's asking and what's happened,
// refunds a booking charge in full, then removes the game or tournament.

async function deleteListing(
  body: { gameId: string } | { tournamentId: string }
): Promise<{ refundedCents: number; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke("delete-listing", { body });
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
    return { refundedCents: 0, error: new Error(message) };
  }
  return { refundedCents: Number((data as { refundedCents?: number } | null)?.refundedCents ?? 0), error: null };
}

/** Deletes a game nobody has accepted yet; any booking charge is refunded first. */
export function deleteGame(gameId: string) {
  return deleteListing({ gameId });
}

/** Deletes a tournament and all its games, if no referee has accepted any of them. */
export function deleteTournament(tournamentId: string) {
  return deleteListing({ tournamentId });
}
