"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Wordmark } from "@/components/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/AppButton";
import { useFocusEffect } from "@/hooks/useFocusEffect";
import { supabase } from "@/lib/supabase";
import {
  fetchMyAssignedTournaments,
  fetchTournamentInvites,
  type TournamentInviteRow,
} from "@/lib/assignor/queries";

function orgName(t: TournamentInviteRow) {
  const hirer = Array.isArray(t.hirer) ? t.hirer[0] : t.hirer;
  return hirer?.org_name ?? "Tournament director";
}

function dateRange(t: TournamentInviteRow) {
  const fmt = (v: string) =>
    new Date(v)
      .toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
      .toUpperCase();
  return `${fmt(t.starts_on)}–${fmt(t.ends_on)}`;
}

/** Port of refee-mobile/refee/app/(assignor)/(tabs)/tournaments.tsx. */
export default function AssignorTournamentsPage() {
  const [invites, setInvites] = useState<TournamentInviteRow[]>([]);
  const [assigned, setAssigned] = useState<TournamentInviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const [inviteRes, assignedRes] = await Promise.all([
        fetchTournamentInvites(session.user.id),
        fetchMyAssignedTournaments(session.user.id),
      ]);
      if (cancelled) return;
      setInvites(inviteRes.invites);
      setAssigned(assignedRes.tournaments);
      setError(inviteRes.error?.message ?? assignedRes.error?.message ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(load);

  return (
    <div className="app-canvas bg-paper pb-6">
      <div className="flex items-center justify-between px-5 pb-3 pt-1 sm:px-0 lg:pt-6">
        <Wordmark className="text-[26px] lg:hidden" />
        <h1
          className="hidden font-display uppercase text-ink lg:block"
          style={{ fontSize: 34, lineHeight: "34px", letterSpacing: -1.2 }}
        >
          TOURNAMENTS<span className="text-signal">.</span>
        </h1>
        <span
          className="border border-ink bg-chalk px-2.5 py-1.5 font-mono-bold text-[9px] uppercase text-ink"
          style={{ letterSpacing: 1.5 }}
        >
          Assignor
        </span>
      </div>

      <div className="flex justify-between px-5 pb-1.5 sm:px-0">
        <span className="font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 2 }}>
          <span className="font-mono-bold text-ink">TOURNAMENTS</span>
          {` · ${assigned.length} ACTIVE`}
        </span>
        {invites.length > 0 ? (
          <span className="font-mono-bold text-[9px] uppercase text-signal" style={{ letterSpacing: 1.5 }}>
            {invites.length} need action
          </span>
        ) : null}
      </div>
      <div className="mb-4 px-5 sm:px-0">
        <ZebraRule variant="signal" thin />
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-12 text-signal">
          <Spinner />
        </div>
      ) : invites.length === 0 && assigned.length === 0 ? (
        <div className="mx-5 flex flex-col items-center border border-dashed border-ink-20 px-6 py-16 text-center sm:mx-0">
          <span className="text-ink-40">
            <Icon name="calendar" size={28} />
          </span>
          <p className="mt-4 font-mono-bold text-[11px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
            No tournaments yet
          </p>
          <p className="mt-2 font-mono text-[9px] uppercase text-ink-40" style={{ letterSpacing: 1 }}>
            Director invitations and events you staff will appear here.
          </p>
        </div>
      ) : (
        <div className="px-5 sm:px-0">
          {invites.length > 0 ? (
            <Section label="Invites & proposals" count={invites.length}>
              {invites.map((t) => (
                <TournamentCard key={t.id} tournament={t} invited />
              ))}
            </Section>
          ) : null}
          <Section label="Assigned tournaments" count={assigned.length}>
            {assigned.map((t) => (
              <TournamentCard key={t.id} tournament={t} invited={false} />
            ))}
          </Section>
        </div>
      )}

      {error ? (
        <p className="mb-4 px-5 text-center font-mono text-[10px] uppercase text-foul sm:px-0">{error}</p>
      ) : null}
    </div>
  );
}

function Section({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 font-mono-bold text-[10px] uppercase text-ink" style={{ letterSpacing: 2 }}>
        ── {label} ({count})
      </h2>
      {count === 0 ? (
        <p className="font-mono text-[9px] uppercase text-ink-40" style={{ letterSpacing: 1 }}>
          None yet.
        </p>
      ) : (
        <div className="card-grid">{children}</div>
      )}
    </section>
  );
}

function TournamentCard({ tournament, invited }: { tournament: TournamentInviteRow; invited: boolean }) {
  return (
    <Link
      href={`/assignor/tournament/${tournament.id}`}
      className="block border border-ink bg-chalk hover:opacity-75"
    >
      <div className={`h-1 ${invited ? "bg-signal" : "bg-court"}`} />
      <div className="px-4 pb-3 pt-3">
        <div className="flex items-start justify-between gap-2">
          <span
            className="flex-1 font-display text-ink"
            style={{ fontSize: 20, lineHeight: "22px", letterSpacing: -0.5 }}
          >
            {tournament.name.toUpperCase()}
          </span>
          <span className="font-mono-bold text-[8px] uppercase text-signal" style={{ letterSpacing: 1.2 }}>
            {invited ? tournament.assignor_status : "Accepted"}
          </span>
        </div>
        <span className="mt-1 block font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
          {orgName(tournament).toUpperCase()} · {tournament.venue_city.toUpperCase()}, {tournament.venue_state}
        </span>
      </div>
      <div className="flex items-center justify-between border-t border-ink-20 px-4 py-2.5">
        <span className="font-mono text-[9px] uppercase text-ink-40" style={{ letterSpacing: 1.2 }}>
          {dateRange(tournament)} · {tournament.total_games ?? "—"} games
        </span>
        <span className="text-ink-40">
          <Icon name="chevron-right" size={14} />
        </span>
      </div>
    </Link>
  );
}
