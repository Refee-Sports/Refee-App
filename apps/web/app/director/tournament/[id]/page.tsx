"use client";

import Link from "next/link";
import { gameStatusDisplay } from "@/lib/director/game-status";
import { useRouter } from "next/navigation";
import { use, useCallback, useState } from "react";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/AppButton";
import { useFocusEffect } from "@/hooks/useFocusEffect";
import {
  fetchTournamentById,
  fetchTournamentGames,
  type DirectorGameRow,
  type TournamentRow,
} from "@/lib/director/queries";

const TZ = "America/Chicago";

function fmt(iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString("en-US", { ...opts, timeZone: TZ }).toUpperCase();
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  });
}

/** Port of refee-mobile/refee/app/(director)/tournament/[id].tsx. */
export default function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [tournament, setTournament] = useState<TournamentRow | null>(null);
  const [games, setGames] = useState<DirectorGameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ tournament: t, error: tErr }, { games: g, error: gErr }] = await Promise.all([
        fetchTournamentById(id),
        fetchTournamentGames(id),
      ]);
      if (cancelled) return;
      setTournament(t);
      setGames(g);
      setError(tErr?.message ?? gErr?.message ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useFocusEffect(load);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper text-signal">
        <Spinner />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper px-6">
        <p className="font-mono-bold uppercase text-ink" style={{ letterSpacing: 1 }}>
          {error ?? "Tournament not found."}
        </p>
      </div>
    );
  }

  const staffedGames = games.filter(
    (g) => g.status === "staffed" || g.status === "completed"
  ).length;
  // Tournament is 'staffed' once it has games and all are staffed/completed.
  const derivedStatus =
    tournament.status === "completed" || tournament.status === "cancelled"
      ? tournament.status
      : games.length > 0 && staffedGames === games.length
        ? "staffed"
        : "open";

  return (
    <div className="app-canvas bg-paper pb-6">
      {/* Back / edit */}
      <div className="flex items-center gap-3 px-5 py-3 sm:px-0 lg:pt-5">
        <button
          type="button"
          onClick={() => router.push("/director/tournaments")}
          aria-label="Back"
          className="flex h-9 w-9 shrink-0 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <span
          className="min-w-0 flex-1 truncate font-mono-bold text-[10px] uppercase text-ink-60"
          style={{ letterSpacing: 2 }}
        >
          {tournament.name.toUpperCase()}
        </span>
        <Link
          href={`/director/tournament/create?editId=${id}`}
          className="flex h-9 shrink-0 items-center gap-1.5 border border-ink bg-chalk px-3 text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="edit-2" size={12} />
          <span className="font-mono-bold text-[9px] uppercase" style={{ letterSpacing: 1.5 }}>
            Edit
          </span>
        </Link>
      </div>

      {/* Hero */}
      <div className="px-5 sm:px-0 pb-1.5">
        <h1
          className="font-display uppercase text-ink"
          style={{ fontSize: 30, lineHeight: "28px", letterSpacing: -1 }}
        >
          {tournament.name.toUpperCase()}
        </h1>
        <p
          className="mt-1.5 font-mono text-[10px] uppercase text-ink-60"
          style={{ letterSpacing: 1.5 }}
        >
          {tournament.venue_city.toUpperCase()}, {tournament.venue_state} ·{" "}
          {fmt(tournament.starts_on, { month: "short", day: "numeric" })}–
          {fmt(tournament.ends_on, { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>
      <div className="my-3 px-5">
        <ZebraRule thin noMargin />
      </div>

      {/* Stats */}
      <div className="mx-5 sm:mx-0 mb-4 flex border border-ink bg-chalk">
        <StatCell label="Games" value={String(games.length)} />
        <span className="w-px bg-ink" />
        <StatCell label="Staffed" value={`${staffedGames}/${games.length}`} />
        <span className="w-px bg-ink" />
        <StatCell label="Status" value={derivedStatus.toUpperCase()} />
      </div>

      {/* Games */}
      <div className="mb-3 flex items-center justify-between px-5">
        <h2
          className="font-mono-bold text-[10px] uppercase text-ink"
          style={{ letterSpacing: 2.5 }}
        >
          ── Games ({games.length})
        </h2>
        <Link
          href={`/director/game/create?tournamentId=${id}`}
          className="flex h-8 items-center gap-1.5 bg-ink px-3 text-paper hover:opacity-80"
        >
          <Icon name="plus" size={12} />
          <span className="font-mono-bold text-[9px] uppercase" style={{ letterSpacing: 1.5 }}>
            Add game
          </span>
        </Link>
      </div>

      {games.length === 0 ? (
        <div className="mx-5 sm:mx-0 flex items-center justify-center border border-dashed border-ink-20 px-5 py-8">
          <p
            className="whitespace-pre-line text-center font-mono text-[11px] uppercase text-ink-40"
            style={{ letterSpacing: 1 }}
          >
            {"No games yet.\nAdd your first game to start hiring officials."}
          </p>
        </div>
      ) : (
        <div>
          {games.map((item) => (
            <div key={item.id} className="mx-5 sm:mx-0 mb-2 border border-ink bg-chalk">
              <div className="h-1" style={{ backgroundColor: gameStatusDisplay(item).accent }} />
              <Link href={`/director/game/${item.id}`} className="block hover:opacity-75">
                <div className="px-4 pb-3 pt-3.5">
                  <div className="mb-1 flex items-start justify-between">
                    <span
                      className="min-w-0 flex-1 truncate pr-2 font-mono-bold text-[12px] uppercase text-ink"
                      style={{ letterSpacing: 0.5 }}
                    >
                      {item.title}
                    </span>
                    <GameStatusBadge game={item} />
                  </div>
                  <span
                    className="block font-mono text-[10px] uppercase text-ink-60"
                    style={{ letterSpacing: 1 }}
                  >
                    {fmtTime(item.starts_at)} · {item.venue_city.toUpperCase()}, {item.venue_state}
                  </span>
                </div>
              </Link>
              <div className="flex items-center border-t border-ink-20">
                <span className="flex-1 px-4 py-2.5">
                  <span
                    className="font-mono text-[9px] uppercase text-ink-40"
                    style={{ letterSpacing: 1 }}
                  >
                    {item.crew_size}-REF · ${item.pay_per_game}/GAME
                  </span>
                </span>
                <Link
                  href={`/director/game/create?tournamentId=${id}&copyFromId=${item.id}`}
                  className="flex items-center gap-1 border-l border-ink-20 px-3 py-2.5 text-signal hover:opacity-60"
                >
                  <Icon name="copy" size={11} />
                  <span
                    className="font-mono-bold text-[8px] uppercase"
                    style={{ letterSpacing: 1 }}
                  >
                    Copy
                  </span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col items-center px-3 py-3">
      <span
        className="mb-0.5 font-mono text-[8px] uppercase text-ink-40"
        style={{ letterSpacing: 2 }}
      >
        {label}
      </span>
      <span className="font-display text-ink" style={{ fontSize: 20, letterSpacing: -0.5 }}>
        {value}
      </span>
    </div>
  );
}

/** Derived from confirmed refs vs crew size, so a 1-of-3 game reads as partially filled. */
function GameStatusBadge({ game }: { game: DirectorGameRow }) {
  const display = gameStatusDisplay(game);
  return (
    <span
      className={`shrink-0 font-mono-bold text-[8px] uppercase ${display.chip}`}
      style={{ letterSpacing: 1.5 }}
    >
      {display.label}
    </span>
  );
}
