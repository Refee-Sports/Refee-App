import { supabase } from "@/lib/supabase";

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
  status: string;
  staffing_model: string;
  pay_per_game: number | null;
  created_at: string;
  updated_at: string;
};

export type DirectorGameRow = {
  id: string;
  hirer_id: string;
  tournament_id: string | null;
  title: string;
  level: string;
  age_group: string | null;
  gender: string | null;
  ruleset: string | null;
  starts_at: string;
  duration_minutes: number | null;
  venue_name: string;
  venue_city: string;
  venue_state: string;
  pay_per_game: number;
  crew_size: number;
  status: string;
  auto_accept: boolean;
  uniform_requirements: string | null;
  hirer_note: string | null;
  payment_status?: string | null;
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
    ruleset?: string;
    rulesetModifications?: string;
  }
): Promise<{ tournamentId: string | null; error: Error | null }> {
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
      ruleset: args.ruleset || null,
      ruleset_modifications: args.rulesetModifications || null,
      staffing_model: "direct",
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return { tournamentId: null, error: new Error(error.message) };
  return { tournamentId: data.id, error: null };
}

export async function updateTournamentStatus(
  id: string,
  status: "draft" | "open" | "staffing" | "staffed" | "completed" | "cancelled"
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("tournaments")
    .update({ status })
    .eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

// ── Games ────────────────────────────────────────────────────────────────────

export async function fetchTournamentGames(
  tournamentId: string
): Promise<{ games: DirectorGameRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("starts_at", { ascending: true });

  if (error) return { games: [], error: new Error(error.message) };
  return { games: (data ?? []) as DirectorGameRow[], error: null };
}

export async function createGame(
  hirerId: string,
  tournamentId: string,
  args: {
    title: string;
    level: string;
    crewSize: 2 | 3;
    payPerGame: number;
    startsAt: string;
    durationMinutes?: number;
    venueName: string;
    venueCity: string;
    venueState: string;
    uniformRequirements?: string;
    hirerNote?: string;
    autoAccept?: boolean;
    ageGroup?: string;
    gender?: string;
    ruleset?: string;
    gameFormat?: "quarters" | "halves";
    periodMinutes?: number;
    rulesetModifications?: string;
  }
): Promise<{ gameId: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      hirer_id: hirerId,
      tournament_id: tournamentId,
      sport_id: "basketball",
      title: args.title,
      level: args.level,
      crew_size: args.crewSize,
      pay_per_game: args.payPerGame,
      starts_at: args.startsAt,
      duration_minutes: args.durationMinutes ?? null,
      venue_name: args.venueName,
      venue_city: args.venueCity,
      venue_state: args.venueState,
      uniform_requirements: args.uniformRequirements || null,
      hirer_note: args.hirerNote || null,
      auto_accept: args.autoAccept ?? false,
      age_group: args.ageGroup || null,
      gender: args.gender || null,
      ruleset: args.ruleset || null,
      ruleset_modifications: args.rulesetModifications || null,
      game_format: args.gameFormat ?? null,
      period_minutes: args.periodMinutes ?? null,
      job_type: "tournament",
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

export async function approveApplicant(
  jobId: string,
  refId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("job_assignments")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("job_id", jobId)
    .eq("ref_id", refId);
  return { error: error ? new Error(error.message) : null };
}

export async function declineApplicantForGame(
  jobId: string,
  refId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("job_assignments")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("job_id", jobId)
    .eq("ref_id", refId);
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
  title: string;
  level: string;
  crewSize: 2 | 3;
  payPerGame: number;
  startsAt: string;
  durationMinutes?: number;
  venueName: string;
  venueCity: string;
  venueState: string;
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
    .select("starts_at, venue_name, venue_city, venue_state, pay_per_game")
    .eq("id", gameId)
    .maybeSingle();
  if (beforeErr) return { error: new Error(beforeErr.message), refsNeedReconfirm: false };

  const { error } = await supabase
    .from("jobs")
    .update({
      title: args.title,
      level: args.level,
      crew_size: args.crewSize,
      pay_per_game: args.payPerGame,
      starts_at: args.startsAt,
      duration_minutes: args.durationMinutes ?? null,
      venue_name: args.venueName,
      venue_city: args.venueCity,
      venue_state: args.venueState,
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
    (new Date(before.starts_at).getTime() !== new Date(args.startsAt).getTime() ||
      before.venue_name !== args.venueName ||
      before.venue_city !== args.venueCity ||
      before.venue_state !== args.venueState ||
      before.pay_per_game !== args.payPerGame);

  if (!materialChange) return { error: null, refsNeedReconfirm: false };

  // Accepted refs must re-confirm
  const { data: flipped } = await supabase
    .from("job_assignments")
    .update({ status: "needs_reconfirm" })
    .eq("job_id", gameId)
    .eq("status", "accepted")
    .select("ref_id");

  const hadAccepted = (flipped ?? []).length > 0;

  // Post a system note to the crew thread if one exists
  if (hadAccepted) {
    const { data: convo } = await supabase
      .from("conversations")
      .select("id")
      .eq("job_id", gameId)
      .eq("kind", "game_crew")
      .maybeSingle();
    if (convo) {
      await supabase.from("messages").insert({
        conversation_id: convo.id,
        sender_id: editorUserId,
        body: `⚠ GAME DETAILS UPDATED — "${args.title}" changed (time, venue, or pay). Please re-confirm your spot from the job page.`,
      });
    }
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
    ruleset?: string;
    rulesetModifications?: string;
  }
): Promise<{ error: Error | null }> {
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
      ruleset: args.ruleset || null,
      ruleset_modifications: args.rulesetModifications || null,
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

async function postCrewNote(jobId: string, senderId: string, body: string) {
  const { data: convo } = await supabase
    .from("conversations")
    .select("id")
    .eq("job_id", jobId)
    .eq("kind", "game_crew")
    .maybeSingle();
  if (convo) {
    await supabase
      .from("messages")
      .insert({ conversation_id: convo.id, sender_id: senderId, body });
  }
}

/** Marks the game completed and locks in full pay for confirmed refs. */
export async function completeGame(
  gameId: string,
  directorUserId: string
): Promise<{ error: Error | null }> {
  const { data: job, error: jErr } = await supabase
    .from("jobs")
    .select("title, pay_per_game, num_games, status")
    .eq("id", gameId)
    .maybeSingle();
  if (jErr || !job) return { error: new Error(jErr?.message ?? "Game not found") };
  if (job.status === "completed" || job.status === "cancelled") {
    return { error: new Error("Game is already closed.") };
  }

  const { error: updErr } = await supabase
    .from("jobs")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", gameId);
  if (updErr) return { error: new Error(updErr.message) };

  const fullPay = job.pay_per_game * (job.num_games ?? 1);
  const { error: aErr } = await supabase
    .from("job_assignments")
    .update({ status: "completed", amount_due: fullPay })
    .eq("job_id", gameId)
    .in("status", ["accepted", "needs_reconfirm"]);
  if (aErr) return { error: new Error(aErr.message) };

  await postCrewNote(
    gameId,
    directorUserId,
    `✓ GAME COMPLETED — "${job.title}" is wrapped. Pay of $${fullPay} per ref is locked in. Thanks, crew!`
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
  const { data: job, error: jErr } = await supabase
    .from("jobs")
    .select("title, starts_at, pay_per_game, num_games, status")
    .eq("id", gameId)
    .maybeSingle();
  if (jErr || !job) {
    return { error: new Error(jErr?.message ?? "Game not found"), feePaid: false, feeAmount: 0 };
  }
  if (job.status === "completed" || job.status === "cancelled") {
    return { error: new Error("Game is already closed."), feePaid: false, feeAmount: 0 };
  }

  const msToStart = new Date(job.starts_at).getTime() - Date.now();
  const lateCancel = msToStart < CANCEL_FEE_WINDOW_HOURS * 3_600_000;
  const feeAmount = lateCancel
    ? Math.round(job.pay_per_game * (job.num_games ?? 1) * 0.5)
    : 0;

  const { error: updErr } = await supabase
    .from("jobs")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", gameId);
  if (updErr) return { error: new Error(updErr.message), feePaid: false, feeAmount: 0 };

  // Confirmed refs → cancelled with (possible) bust fee
  const { error: aErr } = await supabase
    .from("job_assignments")
    .update({ status: "cancelled", amount_due: feeAmount })
    .eq("job_id", gameId)
    .in("status", ["accepted", "needs_reconfirm"]);
  if (aErr) return { error: new Error(aErr.message), feePaid: false, feeAmount: 0 };

  // Pending applicants → cancelled, no fee
  await supabase
    .from("job_assignments")
    .update({ status: "cancelled", amount_due: 0 })
    .eq("job_id", gameId)
    .eq("status", "pending");

  await postCrewNote(
    gameId,
    directorUserId,
    lateCancel
      ? `✕ GAME CANCELLED — "${job.title}" was cancelled inside ${CANCEL_FEE_WINDOW_HOURS}h of tip-off. A 50% fee ($${feeAmount}) is owed to each confirmed ref.`
      : `✕ GAME CANCELLED — "${job.title}" was cancelled. No fees apply.`
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
