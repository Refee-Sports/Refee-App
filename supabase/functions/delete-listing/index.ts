// Deletes a game, or a whole tournament, before any referee has accepted —
// for the director, or the tournament's accepted assignor.
//
// A game charged at booking is cancelled and refunded in full first, through
// the same settlement the payouts job runs (with no referee owed, it refunds
// everything), and only then removed. Stripe keeps the charge and refund, so
// each removal is logged in listing_deletions. Nothing is deleted unless every
// game in the request can be.
import { adminClient, getCaller, handleOptions, json } from "../_shared/util.ts";
import { settlePrepaidGame } from "../_shared/prepay-stripe.ts";
import { deletionBlocker, needsRefund } from "../_shared/deletion.ts";

const GAME_COLUMNS =
  "id, title, hirer_id, tournament_id, status, payment_status, payment_intent_id, refunded_amount_cents, payment_dispute_status, payment_issue_requires_review";
const ACCEPTED = ["accepted", "needs_reconfirm", "completed"];

type Game = {
  id: string;
  title: string;
  hirer_id: string;
  tournament_id: string | null;
  status: string;
  payment_status: string | null;
  payment_intent_id: string | null;
  refunded_amount_cents: number | null;
  payment_dispute_status: string | null;
  payment_issue_requires_review: boolean | null;
};
type Tournament = {
  id: string;
  name: string;
  hirer_id: string;
  assignor_id: string | null;
  assignor_status: string | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const user = await getCaller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const gameId = typeof body.gameId === "string" ? body.gameId : null;
    const tournamentId = typeof body.tournamentId === "string" ? body.tournamentId : null;
    if (!gameId === !tournamentId) return json({ error: "Send either a gameId or a tournamentId." }, 400);
    const admin = adminClient();

    // What's being deleted, and whose it is.
    let games: Game[] = [];
    let tournament: Tournament | null = null;
    let ownerId: string | null = null;
    if (tournamentId) {
      const { data: t } = await admin
        .from("tournaments")
        .select("id, name, hirer_id, assignor_id, assignor_status, hirers(user_id)")
        .eq("id", tournamentId)
        .maybeSingle();
      if (!t) return json({ error: "Tournament not found." }, 404);
      tournament = t as unknown as Tournament;
      ownerId = one<{ user_id: string }>(t.hirers)?.user_id ?? null;
      const { data: rows, error } = await admin.from("jobs").select(GAME_COLUMNS).eq("tournament_id", tournamentId);
      if (error) throw new Error(error.message);
      games = (rows ?? []) as Game[];
    } else {
      const { data: g } = await admin
        .from("jobs")
        .select(`${GAME_COLUMNS}, hirers(user_id), tournaments(id, name, hirer_id, assignor_id, assignor_status)`)
        .eq("id", gameId)
        .maybeSingle();
      if (!g) return json({ error: "Game not found." }, 404);
      ownerId = one<{ user_id: string }>(g.hirers)?.user_id ?? null;
      tournament = one<Tournament>(g.tournaments as Tournament | Tournament[] | null);
      games = [g as unknown as Game];
    }

    const isDirector = !!ownerId && ownerId === user.id;
    const isAssignor = !!tournament && tournament.assignor_id === user.id && tournament.assignor_status === "accepted";
    if (!isDirector && !isAssignor) {
      return json({ error: "Only the director or the tournament's assignor can delete this." }, 403);
    }

    const ids = games.map((g) => g.id);
    const acceptedCounts = async () => {
      const counts = new Map<string, number>();
      if (ids.length === 0) return counts;
      const { data, error } = await admin.from("job_assignments").select("job_id").in("job_id", ids).in("status", ACCEPTED);
      if (error) throw new Error(error.message);
      for (const a of data ?? []) counts.set(a.job_id, (counts.get(a.job_id) ?? 0) + 1);
      return counts;
    };

    const accepted = await acceptedCounts();
    const blocker = games.map((g) => deletionBlocker(g, accepted.get(g.id) ?? 0)).find((b) => b !== null);
    if (blocker) return json({ error: blocker }, 409);

    // Close the games first so nobody can be booked mid-delete…
    const now = new Date().toISOString();
    const closing = games.filter((g) => g.status !== "cancelled").map((g) => g.id);
    if (closing.length > 0) {
      const { error } = await admin.from("jobs").update({ status: "cancelled", cancelled_at: now }).in("id", closing);
      if (error) throw new Error(error.message);
    }
    // …then make sure no referee accepted in the meantime; if one did, undo and stop.
    const acceptedSince = await acceptedCounts();
    const raced = games.find((g) => (acceptedSince.get(g.id) ?? 0) > 0);
    if (raced) {
      if (closing.length > 0) {
        await admin.from("jobs").update({ status: "open", cancelled_at: null }).in("id", closing);
      }
      return json({ error: `A referee just accepted "${raced.title}". Nothing was deleted.` }, 409);
    }
    if (ids.length > 0) {
      await admin
        .from("job_assignments")
        .update({ status: "cancelled", amount_due: 0 })
        .in("job_id", ids)
        .in("status", ["pending", "offered"]);
    }

    // Refund booking charges in full. A refund that fails leaves the game
    // cancelled but not deleted, so trying again is safe (refunds are idempotent).
    const refunds = new Map<string, number>();
    for (const g of games) {
      if (!needsRefund(g)) continue;
      const outcome = await settlePrepaidGame(admin, g.id);
      if (outcome.flagged) {
        return json(
          { error: `"${g.title}" couldn't be refunded (${outcome.flagged}). It's cancelled, not deleted — contact Refee support.` },
          409
        );
      }
      refunds.set(g.id, outcome.refundedCents);
    }

    const log = (games.length > 0 ? games : [null]).map((g) => ({
      kind: tournamentId ? "tournament" : "game",
      tournament_id: tournamentId ?? g?.tournament_id ?? null,
      job_id: g?.id ?? null,
      title: g?.title ?? tournament?.name ?? null,
      hirer_id: g?.hirer_id ?? tournament?.hirer_id ?? null,
      payment_intent_id: g?.payment_intent_id ?? null,
      refunded_cents: g ? (refunds.get(g.id) ?? 0) : 0,
      deleted_by: user.id,
    }));
    const { error: logError } = await admin.from("listing_deletions").insert(log);
    if (logError) throw new Error(logError.message);

    // Removing a game takes its applications, crew chat and ratings with it;
    // removing a tournament takes its games and assignor proposals.
    const removed = tournamentId
      ? await admin.from("tournaments").delete().eq("id", tournamentId)
      : await admin.from("jobs").delete().eq("id", gameId as string);
    if (removed.error) throw new Error(removed.error.message);

    if (!tournamentId && tournament) {
      const { count } = await admin
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("tournament_id", tournament.id);
      await admin.from("tournaments").update({ total_games: count ?? 0 }).eq("id", tournament.id);
    }

    const refundedCents = [...refunds.values()].reduce((sum, c) => sum + c, 0);
    return json({ deleted: tournamentId ? "tournament" : "game", games: games.length, refundedCents });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
