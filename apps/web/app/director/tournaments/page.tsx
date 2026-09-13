"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { Wordmark } from "@/components/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/AppButton";
import { useFocusEffect } from "@/hooks/useFocusEffect";
import { supabase } from "@/lib/supabase";
import {
  approveApplicant,
  declineApplicantForGame,
  fetchGamesNeedingCompletion,
  fetchMyTournaments,
  fetchPendingApprovals,
  fetchStandaloneGames,
  type DirectorGameRow,
  type NeedsCompletionRow,
  type PendingApproval,
  type TournamentRow,
} from "@/lib/director/queries";
import { runAutoPay } from "@/lib/payments/queries";
import { gameStatusDisplay, isClosedGame, payoutDisplay, type PayoutTone } from "@/lib/director/game-status";

const STATUS_COLORS: Record<string, string> = {
  open: "#1F4FCC",
  partially_filled: "#F5B90B",
  staffed: "#00A85C",
  completed: "rgba(8,17,28,0.40)",
  cancelled: "#E53E3E",
};

const TZ = "America/Chicago";

function formatDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: TZ,
    })
    .toUpperCase();
}

function formatGameWhen(iso: string) {
  const d = new Date(iso);
  const day = d
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: TZ })
    .toUpperCase();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
  return `${day} · ${time}`;
}

function appliedAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}M AGO`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}H AGO`;
  return `${Math.round(hours / 24)}D AGO`;
}

type Tab = "tournaments" | "games" | "approvals";

const TAB_META: { id: Tab; label: string; short: string }[] = [
  { id: "tournaments", label: "Tournaments & leagues", short: "Tournaments" },
  { id: "games", label: "Single games", short: "Games" },
  { id: "approvals", label: "Approvals", short: "Approvals" },
];

function isTab(v: string | null): v is Tab {
  return v === "tournaments" || v === "games" || v === "approvals";
}

/**
 * Director home — port of refee-mobile/refee/app/(director)/(tabs)/tournaments.tsx,
 * organised into three tabs: tournaments & leagues, single games, and the
 * referees waiting on the director's approval.
 *
 * The tab lives in the URL (?tab=) so a reload, the back button, or a shared
 * link lands on the same view. useSearchParams needs a Suspense boundary.
 */
export default function DirectorTournamentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center bg-paper text-signal">
          <Spinner />
        </div>
      }
    >
      <DirectorHome />
    </Suspense>
  );
}

function DirectorHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [singleGames, setSingleGames] = useState<DirectorGameRow[]>([]);
  const [needsCompletion, setNeedsCompletion] = useState<NeedsCompletionRow[]>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoPayNote, setAutoPayNote] = useState<string | null>(null);
  const [defaultTab, setDefaultTab] = useState<Tab | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const tab: Tab = isTab(tabParam) ? tabParam : (defaultTab ?? "tournaments");

  const selectTab = (next: Tab) => {
    router.replace(`/director/tournaments?tab=${next}`, { scroll: false });
  };

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setLoading(false);
        return;
      }

      // Fallback for pg_cron: auto-completes games 24h past their end, then
      // auto-pays freshly-completed games if a card is on file.
      void supabase.rpc("sweep_game_lifecycle").then(() => {
        void runAutoPay().then(({ result }) => {
          if (cancelled || !result || result.paid.length === 0) return;
          const total = result.paid.reduce((s, p) => s + p.total, 0);
          setAutoPayNote(
            `${result.paid.length} completed game${
              result.paid.length !== 1 ? "s" : ""
            } charged ($${total} total) and referees paid.`
          );
        });
      });

      const [{ tournaments: rows, error: fetchErr }, nudge, { games: solo }, { approvals: pending }] =
        await Promise.all([
          fetchMyTournaments(session.user.id),
          fetchGamesNeedingCompletion(session.user.id),
          fetchStandaloneGames(session.user.id),
          fetchPendingApprovals(session.user.id),
        ]);

      if (cancelled) return;
      setTournaments(rows);
      setNeedsCompletion(nudge);
      setSingleGames(solo);
      setApprovals(pending);
      // With no tab in the URL, open where the work is: approvals if refs are
      // waiting, otherwise whichever list has something in it. Only decided
      // once, so a reload of the data never yanks the view out from under you.
      setDefaultTab(
        (prev) =>
          prev ?? (pending.length > 0 ? "approvals" : rows.length > 0 ? "tournaments" : "games")
      );
      if (fetchErr) setError(fetchErr.message);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(load);

  const respond = async (a: PendingApproval, accept: boolean) => {
    setApprovalError(null);
    setActioning(a.assignmentId);
    const { error: err } = accept
      ? await approveApplicant(a.job.id, a.refId)
      : await declineApplicantForGame(a.job.id, a.refId);
    if (err) {
      setActioning(null);
      setApprovalError(err.message);
      return;
    }
    // Refresh quietly: slot counts and game statuses change with every answer,
    // and a full reload would flash the whole screen back to a spinner.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const [{ approvals: next }, { games }] = await Promise.all([
        fetchPendingApprovals(session.user.id),
        fetchStandaloneGames(session.user.id),
      ]);
      setApprovals(next);
      setSingleGames(games);
    }
    setActioning(null);
  };

  // Finished games move to the archive so the list is what still needs work.
  const activeGames = singleGames.filter((g) => !isClosedGame(g.status));
  const archivedGames = singleGames
    .filter((g) => isClosedGame(g.status))
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  const counts: Record<Tab, number> = {
    tournaments: tournaments.length,
    games: activeGames.length,
    approvals: approvals.length,
  };

  return (
    <div className="app-canvas bg-paper pb-6">
      {/* Header — the wordmark stands in for the side nav on small screens. */}
      <div className="flex items-center justify-between px-5 pb-3 pt-1 sm:px-0 lg:pt-6">
        <Wordmark className="text-[26px] lg:hidden" />
        <h1
          className="hidden font-display uppercase text-ink lg:block"
          style={{ fontSize: 34, lineHeight: "34px", letterSpacing: -1.2 }}
        >
          TOURNAMENTS<span className="text-signal">.</span>
        </h1>
        <NewMenu />
      </div>

      {/* Telemetry */}
      <div className="px-5 pb-1.5 sm:px-0">
        <span className="font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 2 }}>
          <span className="font-mono-bold text-ink">DIRECTOR</span>
          {` · ${tournaments.length} TOURNAMENT${tournaments.length !== 1 ? "S" : ""} · ${
            activeGames.length
          } UPCOMING GAME${activeGames.length !== 1 ? "S" : ""} · ${archivedGames.length} ARCHIVED`}
          {approvals.length > 0 ? (
            <span className="font-mono-bold text-ink">{` · ${approvals.length} AWAITING APPROVAL`}</span>
          ) : null}
        </span>
      </div>
      <div className="mb-4 px-5 sm:px-0">
        <ZebraRule variant="signal" thin />
      </div>

      {autoPayNote ? (
        <div className="mx-5 mb-4 border border-court bg-court/10 px-4 py-3 sm:mx-0">
          <p
            className="font-mono-bold text-[10px] uppercase text-court"
            style={{ letterSpacing: 1.5 }}
          >
            Crews paid automatically
          </p>
          <p className="mt-1 font-mono text-[10px] text-ink-80">{autoPayNote}</p>
        </div>
      ) : null}

      {/* Completion nudge — games ended but not yet closed out */}
      {needsCompletion.length > 0 && (
        <div className="mx-5 mb-4 border border-ink bg-hi-vis sm:mx-0">
          <div className="flex items-center gap-2 border-b border-ink/20 px-4 py-2.5">
            <Icon name="alert-circle" size={13} />
            <span
              className="font-mono-bold text-[10px] uppercase text-ink"
              style={{ letterSpacing: 1.5 }}
            >
              {needsCompletion.length} GAME{needsCompletion.length !== 1 ? "S" : ""} NEED CLOSING OUT
            </span>
          </div>
          {needsCompletion.slice(0, 4).map((g) => (
            <Link
              key={g.id}
              href={`/director/game/${g.id}`}
              className="flex items-center justify-between border-b border-ink/10 px-4 py-2.5 hover:opacity-70"
            >
              <span className="min-w-0 flex-1 pr-2">
                <span
                  className="block truncate font-mono-bold text-[11px] uppercase text-ink"
                  style={{ letterSpacing: 0.5 }}
                >
                  {g.title}
                </span>
                <span
                  className="block font-mono text-[9px] uppercase text-ink/60"
                  style={{ letterSpacing: 1 }}
                >
                  {g.acceptedCount} REF{g.acceptedCount !== 1 ? "S" : ""} · MARK COMPLETE TO PAY
                </span>
              </span>
              <Icon name="chevron-right" size={14} />
            </Link>
          ))}
          <p
            className="px-4 py-2 font-mono text-[8px] uppercase text-ink/50"
            style={{ letterSpacing: 1 }}
          >
            Auto-completes 24h after game end if not done
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 px-5 sm:px-0">
        <div
          role="tablist"
          aria-label="Director views"
          className="flex overflow-x-auto border border-ink lg:max-w-2xl"
        >
          {TAB_META.map(({ id, label, short }, idx) => {
            const active = tab === id;
            const count = counts[id];
            const urgent = id === "approvals" && count > 0;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(id)}
                className={`flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-2 py-3 sm:gap-2 sm:px-3 ${
                  idx < TAB_META.length - 1 ? "border-r border-ink" : ""
                } ${active ? "bg-ink text-paper" : "bg-chalk text-ink-60 hover:text-ink"}`}
              >
                <span className="font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 1.4 }}>
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
                <span
                  className={`min-w-[20px] px-1.5 py-0.5 text-center font-mono-bold text-[10px] ${
                    urgent ? "badge-flash bg-whistle text-ink" : active ? "text-hi-vis" : "text-ink"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Refs waiting shouldn't depend on the director thinking to check a tab. */}
      {!loading && approvals.length > 0 && tab !== "approvals" ? (
        <div className="mb-4 px-5 sm:px-0">
          <button
            type="button"
            onClick={() => selectTab("approvals")}
            className="flex w-full items-center justify-between border border-whistle bg-whistle/15 px-4 py-2.5 text-left hover:opacity-80"
          >
            <span className="flex items-center gap-2 text-ink">
              <Icon name="alert-circle" size={13} />
              <span
                className="font-mono-bold text-[10px] uppercase"
                style={{ letterSpacing: 1.5 }}
              >
                {approvals.length} referee{approvals.length !== 1 ? "s" : ""} waiting on your
                approval
              </span>
            </span>
            <span
              className="font-mono-bold text-[10px] uppercase text-ink"
              style={{ letterSpacing: 1.5 }}
            >
              Review →
            </span>
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-12 text-signal">
          <Spinner />
        </div>
      ) : tab === "tournaments" ? (
        <div className="px-5 sm:px-0" role="tabpanel">
          {tournaments.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="card-grid">
              {tournaments.map((t) => (
                <TournamentCard key={t.id} tournament={t} />
              ))}
            </div>
          )}
        </div>
      ) : tab === "games" ? (
        <div className="px-5 sm:px-0" role="tabpanel">
          {singleGames.length === 0 ? (
            <SingleGamesEmpty />
          ) : (
            <>
              {activeGames.length === 0 ? (
                <p
                  className="border border-dashed border-ink-20 px-4 py-6 text-center font-mono text-[11px] uppercase text-ink-60"
                  style={{ letterSpacing: 1 }}
                >
                  No upcoming single games — finished ones are in the archive below.
                </p>
              ) : (
                <div className="card-grid">
                  {activeGames.map((g) => (
                    <SingleGameCard key={g.id} game={g} />
                  ))}
                </div>
              )}
              {archivedGames.length > 0 ? <GameArchive games={archivedGames} /> : null}
            </>
          )}
        </div>
      ) : (
        <div role="tabpanel">
          <ApprovalsPanel
            approvals={approvals}
            actioning={actioning}
            error={approvalError}
            onRespond={respond}
          />
        </div>
      )}

      {error && (
        <p
          className="mb-4 px-5 text-center font-mono text-xs text-foul sm:px-0"
          style={{ letterSpacing: 0.5 }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ── Approvals ────────────────────────────────────────────────────────────────

function ApprovalsPanel({
  approvals,
  actioning,
  error,
  onRespond,
}: {
  approvals: PendingApproval[];
  actioning: string | null;
  error: string | null;
  onRespond: (a: PendingApproval, accept: boolean) => void;
}) {
  if (approvals.length === 0) {
    return (
      <div className="mx-5 flex flex-col items-center border border-dashed border-ink-20 px-6 py-12 text-center sm:mx-0">
        <span className="mb-4 flex h-12 w-12 items-center justify-center border-2 border-ink-20 text-ink-20">
          <Icon name="check-circle" size={22} />
        </span>
        <p className="font-display text-ink" style={{ fontSize: 22, letterSpacing: -0.5 }}>
          ALL CAUGHT UP.
        </p>
        <p className="mt-2 max-w-sm font-mono text-[11px] text-ink-60" style={{ letterSpacing: 0.3 }}>
          When a referee applies to one of your games, they show up here to approve or decline.
        </p>
      </div>
    );
  }

  // One card per game, in the soonest-first order the query returns.
  const groups = new Map<string, PendingApproval[]>();
  for (const a of approvals) {
    const list = groups.get(a.job.id) ?? [];
    list.push(a);
    groups.set(a.job.id, list);
  }

  return (
    <div className="px-5 sm:px-0">
      {error ? (
        <p
          role="alert"
          className="mb-3 border border-foul bg-foul/10 px-3 py-2 font-mono text-[10px] uppercase text-foul"
          style={{ letterSpacing: 1 }}
        >
          {error}
        </p>
      ) : null}
      <div className="card-grid">
        {[...groups.values()].map((items) => (
          <ApprovalGroup
            key={items[0].job.id}
            items={items}
            actioning={actioning}
            onRespond={onRespond}
          />
        ))}
      </div>
    </div>
  );
}

function ApprovalGroup({
  items,
  actioning,
  onRespond,
}: {
  items: PendingApproval[];
  actioning: string | null;
  onRespond: (a: PendingApproval, accept: boolean) => void;
}) {
  const job = items[0].job;
  const slotsLeft = Math.max(0, job.crewSize - job.acceptedCount);

  return (
    <section className="flex flex-col self-start border border-ink bg-chalk">
      <div className="h-1 bg-whistle" />
      <Link
        href={`/director/game/${job.id}`}
        className="block border-b border-ink-20 px-4 pb-3 pt-3 hover:opacity-80"
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className="min-w-0 flex-1 truncate font-mono-bold text-[12px] uppercase text-ink"
            style={{ letterSpacing: 0.5 }}
          >
            {job.title}
          </span>
          <span
            className="shrink-0 font-mono-bold text-[9px] uppercase text-ink-60"
            style={{ letterSpacing: 1.5 }}
          >
            {items.length} waiting
          </span>
        </div>
        <span
          className="mt-1 block font-mono text-[10px] uppercase text-ink-60"
          style={{ letterSpacing: 1 }}
        >
          {formatGameWhen(job.startsAt)} · {job.venueCity.toUpperCase()}, {job.venueState} · $
          {job.payPerGame}/REF
        </span>
        {job.tournamentName ? (
          <span
            className="mt-0.5 block font-mono text-[9px] uppercase text-ink-40"
            style={{ letterSpacing: 1.2 }}
          >
            {job.tournamentName}
          </span>
        ) : null}
        <span
          className={`mt-2 inline-block font-mono-bold text-[9px] uppercase ${
            slotsLeft === 0 ? "text-foul" : "text-court"
          }`}
          style={{ letterSpacing: 1.4 }}
        >
          {job.acceptedCount} / {job.crewSize} crew confirmed
          {slotsLeft === 0 ? " · full" : ` · ${slotsLeft} open`}
        </span>
      </Link>

      <div className="flex flex-col">
        {items.map((a, idx) => (
          <ApprovalRow
            key={a.assignmentId}
            approval={a}
            first={idx === 0}
            busy={actioning === a.assignmentId}
            locked={actioning !== null}
            crewFull={slotsLeft === 0}
            onRespond={onRespond}
          />
        ))}
      </div>
    </section>
  );
}

function ApprovalRow({
  approval,
  first,
  busy,
  locked,
  crewFull,
  onRespond,
}: {
  approval: PendingApproval;
  first: boolean;
  busy: boolean;
  locked: boolean;
  crewFull: boolean;
  onRespond: (a: PendingApproval, accept: boolean) => void;
}) {
  const p = approval.profile;
  const initials = p ? `${p.first_name[0] ?? "?"}${p.last_initial}`.toUpperCase() : "??";
  const name = p ? `${p.first_name} ${p.last_initial}.`.toUpperCase() : "UNKNOWN REF";

  return (
    <div className={first ? "" : "border-t border-ink-20"}>
      <Link
        href={`/director/referee/${approval.refId}`}
        className="flex items-center gap-3 px-4 py-3 hover:opacity-80"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-ink">
          <span className="font-mono-bold text-[11px] text-paper">{initials}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="block truncate font-mono-bold text-[11px] uppercase text-ink"
            style={{ letterSpacing: 0.5 }}
          >
            {name}
          </span>
          <span
            className="block truncate font-mono text-[9px] uppercase text-ink-60"
            style={{ letterSpacing: 1 }}
          >
            {p ? `${p.city.toUpperCase()}, ${p.state} · ★ ${p.rating.toFixed(2)} · ` : ""}
            applied {appliedAgo(approval.appliedAt)}
          </span>
        </span>
        <Icon name="chevron-right" size={13} />
      </Link>
      <div className="flex border-t border-ink-20">
        <button
          type="button"
          onClick={() => onRespond(approval, false)}
          disabled={locked}
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
          onClick={() => onRespond(approval, true)}
          disabled={locked || crewFull}
          title={crewFull ? "Every crew slot is already filled" : undefined}
          className="flex flex-1 items-center justify-center bg-court py-2.5 text-paper hover:opacity-80 disabled:bg-ink-20 disabled:text-ink-40"
        >
          {busy ? (
            <Spinner />
          ) : (
            <span className="font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 1.5 }}>
              {crewFull ? "Crew full" : "Approve ✓"}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function SingleGamesEmpty() {
  return (
    <div className="flex flex-col items-center border border-dashed border-ink-20 px-6 py-12 text-center">
      <p className="font-display text-ink" style={{ fontSize: 22, letterSpacing: -0.5 }}>
        NO SINGLE GAMES YET.
      </p>
      <p className="mb-6 mt-2 max-w-sm font-mono text-[11px] text-ink-60" style={{ letterSpacing: 0.3 }}>
        One-off games that aren&apos;t part of a tournament or league live here.
      </p>
      <Link href="/director/game/create" className="bg-ink px-6 py-3.5 text-paper hover:opacity-80">
        <span className="font-mono-bold text-[11px] uppercase" style={{ letterSpacing: 2 }}>
          Add a game →
        </span>
      </Link>
    </div>
  );
}

/** The app uses an action sheet here; on web a small popover menu reads better. */
function NewMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-9 items-center justify-center gap-1.5 bg-ink px-3 text-paper hover:opacity-80"
      >
        <Icon name="plus" size={14} />
        <span className="font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 1.5 }}>
          New
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-44 border border-ink bg-chalk shadow-[4px_4px_0_var(--ink)]">
          <Link
            href="/director/tournament/create"
            onClick={() => setOpen(false)}
            className="block border-b border-ink-20 px-4 py-3 font-mono-bold text-[10px] uppercase text-ink hover:bg-ink hover:text-paper"
            style={{ letterSpacing: 1.5 }}
          >
            Tournament
          </Link>
          <Link
            href="/director/game/create"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 font-mono-bold text-[10px] uppercase text-ink hover:bg-ink hover:text-paper"
            style={{ letterSpacing: 1.5 }}
          >
            Single game
          </Link>
        </div>
      )}
    </div>
  );
}

function TournamentCard({ tournament }: { tournament: TournamentRow }) {
  const statusColor = STATUS_COLORS[tournament.status] ?? "rgba(8,17,28,0.40)";
  return (
    <Link
      href={`/director/tournament/${tournament.id}`}
      className="block border border-ink bg-chalk hover:opacity-75"
    >
      <div className="h-1" style={{ backgroundColor: statusColor }} />
      <div className="px-4 pb-4 pt-3">
        <div className="mb-1 flex items-start justify-between">
          <span
            className="flex-1 pr-2 font-display text-ink"
            style={{ fontSize: 20, letterSpacing: -0.5, lineHeight: "22px" }}
          >
            {tournament.name.toUpperCase()}
          </span>
          <span
            className="font-mono-bold text-[9px] uppercase"
            style={{ letterSpacing: 1.5, color: statusColor, marginTop: 2 }}
          >
            {tournament.status}
          </span>
        </div>
        <span
          className="block font-mono text-[10px] uppercase text-ink-60"
          style={{ letterSpacing: 1 }}
        >
          {tournament.venue_city.toUpperCase()}, {tournament.venue_state}
        </span>
        <div className="mt-3 flex items-center gap-3">
          <DataPill label="Start" value={formatDate(tournament.starts_on)} />
          <DataPill label="End" value={formatDate(tournament.ends_on)} />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-ink-20 px-4 py-2.5">
        <span
          className="font-mono text-[9px] uppercase text-ink-40"
          style={{ letterSpacing: 1.5 }}
        >
          Basketball · Direct hire
        </span>
        <span className="text-ink-40">
          <Icon name="chevron-right" size={14} />
        </span>
      </div>
    </Link>
  );
}

const PAYOUT_TONE: Record<PayoutTone, string> = {
  paid: "border-ink-20 text-court",
  held: "border-ink-20 bg-whistle/10 text-ink-80",
  due: "border-ink-20 text-ink-60",
  overdue: "border-foul/40 bg-foul/10 text-foul",
  none: "border-ink-20 text-ink-40",
};

function SingleGameCard({ game, archived }: { game: DirectorGameRow; archived?: boolean }) {
  const display = gameStatusDisplay(game);
  const payout = archived ? payoutDisplay(game) : null;
  const title =
    game.home_team && game.away_team ? `${game.home_team} vs ${game.away_team}` : game.title;
  return (
    <Link
      href={`/director/game/${game.id}`}
      className={`block border bg-chalk hover:opacity-75 ${archived ? "border-ink-20" : "border-ink"}`}
    >
      <div className="h-1" style={{ backgroundColor: display.accent }} />
      <div className="px-4 pb-3 pt-3">
        <div className="mb-1 flex items-start justify-between gap-2">
          <span
            className={`min-w-0 flex-1 truncate font-mono-bold text-[12px] uppercase ${
              archived ? "text-ink-60" : "text-ink"
            }`}
            style={{ letterSpacing: 0.5 }}
          >
            {title.toUpperCase()}
          </span>
          <span
            className={`shrink-0 font-mono-bold text-[8px] uppercase ${display.chip}`}
            style={{ letterSpacing: 1.5 }}
          >
            {display.label}
          </span>
        </div>
        <span
          className="block font-mono text-[10px] uppercase text-ink-60"
          style={{ letterSpacing: 1 }}
        >
          {archived ? `${formatDate(game.starts_at)} · ` : ""}
          {game.venue_city.toUpperCase()}, {game.venue_state} · ${game.pay_per_game}/REF
        </span>
      </div>
      {payout ? (
        <div className={`border-t px-4 py-2 ${PAYOUT_TONE[payout.tone]}`}>
          <span className="font-mono-bold text-[9px] uppercase" style={{ letterSpacing: 1.3 }}>
            {payout.label}
          </span>
        </div>
      ) : null}
    </Link>
  );
}

/** Completed and cancelled games, out of the way but one tap from view. */
function GameArchive({ games }: { games: DirectorGameRow[] }) {
  const [open, setOpen] = useState(false);
  const owed = games.filter((g) => {
    const tone = payoutDisplay(g).tone;
    return tone === "due" || tone === "overdue";
  }).length;
  const overdue = games.filter((g) => payoutDisplay(g).tone === "overdue").length;

  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 border-y border-ink py-3 text-left hover:opacity-80"
      >
        <span
          className="font-mono-bold text-[10px] uppercase text-ink"
          style={{ letterSpacing: 2.5 }}
        >
          ── Archive · {games.length}
        </span>
        <span className="flex items-center gap-3">
          {overdue > 0 ? (
            <span
              className="bg-foul px-1.5 py-0.5 font-mono-bold text-[9px] uppercase text-paper"
              style={{ letterSpacing: 1.2 }}
            >
              {overdue} payout{overdue !== 1 ? "s" : ""} overdue
            </span>
          ) : owed > 0 ? (
            <span
              className="bg-whistle px-1.5 py-0.5 font-mono-bold text-[9px] uppercase text-ink"
              style={{ letterSpacing: 1.2 }}
            >
              {owed} payout{owed !== 1 ? "s" : ""} pending
            </span>
          ) : null}
          <span
            className="font-mono-bold text-[10px] uppercase text-ink-60"
            style={{ letterSpacing: 1.5 }}
          >
            {open ? "Hide" : "Show"}
          </span>
          <span className={`text-ink-60 transition-transform ${open ? "rotate-180" : ""}`}>
            <Icon name="chevron-down" size={14} />
          </span>
        </span>
      </button>
      {open ? (
        <div className="card-grid mt-4">
          {games.map((g) => (
            <SingleGameCard key={g.id} game={g} archived />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DataPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span
        className="mb-0.5 block font-mono text-[8px] uppercase text-ink-40"
        style={{ letterSpacing: 1.5 }}
      >
        {label}
      </span>
      <span
        className="block font-mono-bold text-[10px] uppercase text-ink"
        style={{ letterSpacing: 0.5 }}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-12">
      <span className="mb-5 flex h-16 w-16 items-center justify-center border-2 border-ink-20 text-ink-20">
        <Icon name="grid" size={28} />
      </span>
      <p
        className="mb-2 whitespace-pre-line text-center font-display text-ink"
        style={{ fontSize: 24, letterSpacing: -0.5, lineHeight: "24px" }}
      >
        {"NO TOURNAMENTS\nYET"}
      </p>
      <p
        className="mb-8 text-center font-mono text-[11px] text-ink-60"
        style={{ letterSpacing: 0.5 }}
      >
        Create your first tournament to start posting game assignments.
      </p>
      <Link
        href="/director/tournament/create"
        className="bg-ink px-8 py-4 text-paper hover:opacity-80"
      >
        <span className="font-mono-bold text-[11px] uppercase" style={{ letterSpacing: 2 }}>
          Create tournament →
        </span>
      </Link>
    </div>
  );
}
