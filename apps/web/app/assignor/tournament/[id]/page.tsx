"use client";

import Link from "next/link";
import { use, useCallback, useState } from "react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Spinner } from "@/components/ui/AppButton";
import { useFocusEffect } from "@/hooks/useFocusEffect";
import { supabase } from "@/lib/supabase";
import {
  fetchAssignorTournament,
  fetchAssignorTournamentGames,
  fetchMyProposal,
  submitProposal,
  withdrawProposal,
  type AssignorGameRow,
  type MyProposalRow,
  type TournamentInviteRow,
} from "@/lib/assignor/queries";

function formatWhen(value: string, timeZone: string) {
  return new Date(value)
    .toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone })
    .toUpperCase();
}

/** Port of refee-mobile/refee/app/(assignor)/tournament/[id].tsx. */
export default function AssignorTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [userId, setUserId] = useState<string | null>(null);
  const [tournament, setTournament] = useState<TournamentInviteRow | null>(null);
  const [proposal, setProposal] = useState<MyProposalRow | null>(null);
  const [games, setGames] = useState<AssignorGameRow[]>([]);
  const [feeType, setFeeType] = useState<"flat" | "percentage">("flat");
  const [fee, setFee] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      setUserId(session.user.id);
      const [tRes, pRes, gRes] = await Promise.all([
        fetchAssignorTournament(id, session.user.id),
        fetchMyProposal(id, session.user.id),
        fetchAssignorTournamentGames(id),
      ]);
      if (cancelled) return;
      setTournament(tRes.tournament);
      setProposal(pRes.proposal);
      setGames(gRes.games);
      const current = pRes.proposal;
      if (current) {
        setFeeType(current.fee_type);
        setFee(String(current.fee_type === "flat" ? current.fee_amount ?? "" : current.fee_pct ?? ""));
        setMessage(current.message ?? "");
      }
      setError(tRes.error?.message ?? pRes.error?.message ?? gRes.error?.message ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useFocusEffect(load);

  const submit = async () => {
    if (!userId || saving) return;
    const parsed = Number(fee);
    if (!Number.isFinite(parsed) || parsed <= 0 || (feeType === "percentage" && parsed > 100)) {
      setError(feeType === "flat" ? "Enter a flat fee greater than $0." : "Enter a percentage between 0 and 100.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await submitProposal(id, userId, {
      feeType,
      feeAmount: feeType === "flat" ? parsed : undefined,
      feePct: feeType === "percentage" ? parsed : undefined,
      message: message.trim() || undefined,
    });
    setSaving(false);
    if (result.error) setError(`Proposal not submitted: ${result.error.message}`);
    else {
      setNotice("Proposal sent — the director will review it.");
      load();
    }
  };

  const withdraw = async () => {
    if (!proposal || !userId || saving) return;
    if (!window.confirm("Withdraw proposal?\n\nThe director will no longer be able to accept it.")) return;
    setSaving(true);
    const result = await withdrawProposal(proposal.tournament_id, userId);
    setSaving(false);
    if (result.error) setError(`Could not withdraw: ${result.error.message}`);
    else load();
  };

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
        <p className="text-center font-mono-bold uppercase text-ink">Tournament not available</p>
      </div>
    );
  }

  const accepted = tournament.assignor_status === "accepted";
  const proposalOpen = !accepted && (!proposal || !["accepted", "declined", "withdrawn"].includes(proposal.status));

  return (
    <div className="app-canvas bg-paper pb-8">
      <div className="sm:-mx-0 lg:pt-3">
        <ScreenHeader title="Tournament" backHref="/assignor/tournaments" />
      </div>

      <div className="px-5 sm:px-0">
        <h1
          className="mt-2 font-display uppercase text-ink"
          style={{ fontSize: 34, lineHeight: "34px", letterSpacing: -1.2 }}
        >
          {tournament.name}
        </h1>
        <p className="mt-2 font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
          {tournament.venue_city}, {tournament.venue_state} · {tournament.total_games ?? "—"} games
        </p>

        <div
          className={`mt-5 border px-4 py-3 ${accepted ? "border-court bg-court/10" : "border-signal bg-signal/10"}`}
        >
          <span className="font-mono-bold text-[10px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
            {accepted ? "✓ You are the assignor" : `Status · ${proposal?.status ?? tournament.assignor_status}`}
          </span>
        </div>

        {notice ? (
          <p className="mt-3 border border-court bg-court/10 px-3 py-2 font-mono text-[10px] uppercase text-ink-80">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 border border-foul bg-foul/10 px-3 py-2 font-mono text-[10px] uppercase text-foul" role="alert">
            {error}
          </p>
        ) : null}

        {proposalOpen ? (
          <div className="mt-5 border border-ink bg-chalk p-4 lg:max-w-xl">
            <p className="mb-3 font-mono-bold text-[10px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
              Your proposal
            </p>
            <div className="mb-3 flex" role="radiogroup" aria-label="Fee type">
              {(["flat", "percentage"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={feeType === type}
                  onClick={() => setFeeType(type)}
                  className={`flex-1 border border-ink py-2.5 font-mono-bold text-[9px] uppercase ${
                    feeType === type ? "bg-ink text-paper" : "bg-paper text-ink"
                  }`}
                >
                  {type === "flat" ? "Flat fee" : "Percentage"}
                </button>
              ))}
            </div>
            <input
              value={fee}
              onChange={(e) => setFee(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder={feeType === "flat" ? "FLAT FEE ($)" : "PERCENTAGE (%)"}
              className="field mb-3"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="OPTIONAL NOTE TO THE DIRECTOR"
              rows={3}
              className="field mb-3"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving}
              className="flex w-full items-center justify-center bg-ink py-3.5 text-paper hover:opacity-80 disabled:opacity-60"
            >
              {saving ? (
                <Spinner />
              ) : (
                <span className="font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 1.5 }}>
                  {proposal?.status === "submitted" ? "Update proposal" : "Submit proposal"}
                </span>
              )}
            </button>
            {proposal?.status === "submitted" ? (
              <button
                type="button"
                onClick={() => void withdraw()}
                className="w-full py-3 font-mono-bold text-[9px] uppercase text-foul hover:opacity-70"
              >
                Withdraw proposal
              </button>
            ) : null}
          </div>
        ) : null}

        {accepted ? (
          <>
            <h2 className="mb-3 mt-7 font-mono-bold text-[10px] uppercase text-ink" style={{ letterSpacing: 2 }}>
              ── Game staffing ({games.length})
            </h2>
            {games.length === 0 ? (
              <p className="py-10 text-center font-mono text-[9px] uppercase text-ink-40">
                No games have been added yet.
              </p>
            ) : (
              <div className="card-grid">
                {games.map((g) => (
                  <Link
                    key={g.id}
                    href={`/assignor/game/${g.id}`}
                    className="block border border-ink bg-chalk px-4 py-3 hover:opacity-75"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono-bold text-[11px] uppercase text-ink">{g.title}</span>
                        <span className="mt-1 block font-mono text-[8px] uppercase text-ink-40" style={{ letterSpacing: 0.8 }}>
                          {formatWhen(g.starts_at, tournament.timezone)} · {g.venue_name}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block font-mono-bold text-[8px] uppercase text-signal">{g.status}</span>
                        <span className="mt-1 block font-mono text-[8px] uppercase text-ink-40">{g.crew_size} refs</span>
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
