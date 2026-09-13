"use client";

import { use, useCallback, useState } from "react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Spinner } from "@/components/ui/AppButton";
import { useFocusEffect } from "@/hooks/useFocusEffect";
import { supabase } from "@/lib/supabase";
import {
  directAssignRefToGame,
  fetchAssignorGame,
  fetchGameCrew,
  fetchMyRoster,
  removeRefFromGame,
  setGameStaffingMode,
  type AssignorGameRow,
  type RosterMemberRow,
} from "@/lib/assignor/queries";

type CrewRow = { id: string; ref_id: string; role: string; status: string; display_name: string };

function formatWhen(value: string) {
  return new Date(value)
    .toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Chicago",
    })
    .toUpperCase();
}

/** Port of refee-mobile/refee/app/(assignor)/game/[id].tsx. */
export default function AssignorGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [game, setGame] = useState<AssignorGameRow | null>(null);
  const [crew, setCrew] = useState<CrewRow[]>([]);
  const [roster, setRoster] = useState<RosterMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setLoading(false);
        return;
      }
      const [gRes, cRes, rRes] = await Promise.all([
        fetchAssignorGame(id),
        fetchGameCrew(id),
        fetchMyRoster(session.user.id),
      ]);
      if (cancelled) return;
      setGame(gRes.game);
      setCrew(cRes.crew);
      setRoster(rRes.members);
      setError(gRes.error?.message ?? cRes.error?.message ?? rRes.error?.message ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useFocusEffect(load);

  const setMode = async (mode: "assignor_direct" | "self_assign") => {
    if (busyId) return;
    setBusyId(mode);
    const result = await setGameStaffingMode(id, mode);
    setBusyId(null);
    if (result.error) setError(`Mode not changed: ${result.error.message}`);
    else setGame((g) => (g ? { ...g, assignor_staffing_mode: mode } : g));
  };

  const offer = async (member: RosterMemberRow) => {
    if (busyId) return;
    setBusyId(member.ref_id);
    const result = await directAssignRefToGame(id, member.ref_id);
    setBusyId(null);
    if (result.error) setError(`Offer not sent: ${result.error.message}`);
    else load();
  };

  const remove = async (assignment: CrewRow) => {
    if (busyId) return;
    if (!window.confirm(`Remove ${assignment.display_name} from this game?`)) return;
    setBusyId(assignment.id);
    const result = await removeRefFromGame(assignment.id);
    setBusyId(null);
    if (result.error) setError(`Could not remove: ${result.error.message}`);
    else load();
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper text-signal">
        <Spinner />
      </div>
    );
  }
  if (!game) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper">
        <p className="font-mono-bold uppercase text-ink">Game not available</p>
      </div>
    );
  }

  const assigned = new Set(crew.map((m) => m.ref_id));
  const available = roster.filter((m) => m.status === "accepted" && m.is_available && !assigned.has(m.ref_id));
  const mode = game.assignor_staffing_mode ?? "assignor_direct";
  const full = crew.length >= game.crew_size;

  return (
    <div className="app-canvas bg-paper pb-8">
      <div className="lg:pt-3">
        <ScreenHeader title="Staff game" />
      </div>

      <div className="px-5 sm:px-0">
        <h1 className="mt-2 font-display uppercase text-ink" style={{ fontSize: 32, lineHeight: "32px", letterSpacing: -1 }}>
          {game.title}
        </h1>
        <p className="mt-2 font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
          {formatWhen(game.starts_at)} · {game.venue_name}
        </p>
        <p className="mt-2 font-mono-bold text-[10px] uppercase text-signal">
          ${game.pay_per_game}/ref · {crew.length}/{game.crew_size} slots active
        </p>

        {error ? (
          <p className="mt-3 border border-foul bg-foul/10 px-3 py-2 font-mono text-[10px] uppercase text-foul" role="alert">
            {error}
          </p>
        ) : null}

        <div className="split-grid mt-6">
          <div className="min-w-0">
            <p className="mb-2 font-mono-bold text-[9px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
              Staffing mode
            </p>
            <div className="mb-5 flex" role="radiogroup" aria-label="Staffing mode">
              {(["assignor_direct", "self_assign"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  disabled={busyId !== null}
                  onClick={() => void setMode(value)}
                  className={`flex-1 border border-ink py-3 font-mono-bold text-[8px] uppercase disabled:opacity-60 ${
                    mode === value ? "bg-ink text-paper" : "bg-chalk text-ink"
                  }`}
                >
                  {value === "assignor_direct" ? "Offer from roster" : "Roster self-claim"}
                </button>
              ))}
            </div>
            {mode === "self_assign" ? (
              <p className="mb-5 border border-signal bg-signal/10 px-4 py-3 font-mono text-[9px] uppercase text-ink" style={{ letterSpacing: 1 }}>
                Accepted roster referees can claim this game until the crew is full. Conflicts and capacity are
                checked atomically.
              </p>
            ) : null}

            <p className="mb-2 font-mono-bold text-[9px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
              Active crew ({crew.length})
            </p>
            {crew.length === 0 ? (
              <p className="py-3 font-mono text-[9px] uppercase text-ink-40">No offers or accepted referees yet.</p>
            ) : (
              crew.map((m) => (
                <div key={m.id} className="mb-2 flex items-center border border-ink bg-chalk px-4 py-3">
                  <span className="flex-1">
                    <span className="block font-mono-bold text-[10px] uppercase text-ink">{m.display_name}</span>
                    <span className="mt-1 block font-mono text-[8px] uppercase text-ink-40">
                      {m.role} · {m.status}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void remove(m)}
                    className="border border-foul px-2.5 py-2 font-mono-bold text-[8px] uppercase text-foul disabled:opacity-50"
                  >
                    {busyId === m.id ? <Spinner /> : "Remove"}
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="min-w-0">
            {mode === "assignor_direct" ? (
              <>
                <p className="mb-2 font-mono-bold text-[9px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
                  Available roster ({available.length})
                </p>
                {available.length === 0 ? (
                  <p className="py-8 text-center font-mono text-[9px] uppercase text-ink-40">
                    No available accepted roster referees remain for this game.
                  </p>
                ) : (
                  available.map((m) => (
                    <div key={m.ref_id} className="mb-2 flex items-center border border-ink bg-chalk px-4 py-3">
                      <span className="flex-1">
                        <span className="block font-mono-bold text-[10px] uppercase text-ink">{m.display_name}</span>
                        <span className="mt-1 block font-mono text-[8px] uppercase text-ink-40">
                          {m.city}, {m.state} · {m.rating.toFixed(1)} rating
                        </span>
                      </span>
                      <button
                        type="button"
                        disabled={busyId !== null || full}
                        onClick={() => void offer(m)}
                        className={`border border-ink px-3 py-2 font-mono-bold text-[8px] uppercase text-paper disabled:opacity-60 ${
                          full ? "bg-ink-20" : "bg-ink"
                        }`}
                      >
                        {busyId === m.ref_id ? <Spinner /> : "Offer"}
                      </button>
                    </div>
                  ))
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
