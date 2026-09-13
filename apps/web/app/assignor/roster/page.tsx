"use client";

import { useCallback, useEffect, useState } from "react";
import { Wordmark } from "@/components/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/AppButton";
import { useFocusEffect } from "@/hooks/useFocusEffect";
import { supabase } from "@/lib/supabase";
import {
  fetchMyRoster,
  inviteToRoster,
  removeFromRoster,
  searchReferees,
  type RefSearchResult,
  type RosterMemberRow,
} from "@/lib/assignor/queries";

/** Port of refee-mobile/refee/app/(assignor)/(tabs)/roster.tsx. */
export default function AssignorRosterPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<RosterMemberRow[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RefSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }
    setUserId(session.user.id);
    const result = await fetchMyRoster(session.user.id);
    setMembers(result.members);
    setError(result.error?.message ?? null);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  // Search as they type, after a short pause, leaving out anyone already on the roster.
  useEffect(() => {
    if (!userId || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      void searchReferees(query, userId).then((result) => {
        if (cancelled) return;
        const existing = new Set(members.filter((m) => m.status !== "removed").map((m) => m.ref_id));
        setResults(result.results.filter((ref) => !existing.has(ref.id)));
        setError(result.error?.message ?? null);
        setSearching(false);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [members, query, userId]);

  const invite = async (ref: RefSearchResult) => {
    if (!userId || busyId) return;
    setBusyId(ref.id);
    const result = await inviteToRoster(userId, ref.id);
    setBusyId(null);
    if (result.error) {
      setError(`Invite not sent: ${result.error.message}`);
      return;
    }
    setQuery("");
    setResults([]);
    await load();
  };

  const remove = async (member: RosterMemberRow) => {
    if (busyId) return;
    if (!window.confirm(`Remove ${member.display_name} from your roster?\n\nThey won't be offered new games by you.`)) {
      return;
    }
    setBusyId(member.roster_id);
    const result = await removeFromRoster(member.roster_id);
    setBusyId(null);
    if (result.error) setError(`Could not remove: ${result.error.message}`);
    else await load();
  };

  const visible = members.filter((m) => m.status !== "removed");
  const active = visible.filter((m) => m.status === "accepted").length;
  const searchingMode = query.trim().length >= 2;

  return (
    <div className="app-canvas bg-paper pb-6">
      <div className="flex items-center justify-between px-5 pb-3 pt-1 sm:px-0 lg:pt-6">
        <Wordmark className="text-[26px] lg:hidden" />
        <h1
          className="hidden font-display uppercase text-ink lg:block"
          style={{ fontSize: 34, lineHeight: "34px", letterSpacing: -1.2 }}
        >
          ROSTER<span className="text-signal">.</span>
        </h1>
        <span className="font-mono-bold text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1.5 }}>
          {active} active
        </span>
      </div>
      <div className="px-5 pb-1.5 sm:px-0">
        <span className="font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 2 }}>
          <span className="font-mono-bold text-ink">MY ROSTER</span>
          {` · ${visible.length} TOTAL`}
        </span>
      </div>
      <div className="mb-4 px-5 sm:px-0">
        <ZebraRule variant="signal" thin />
      </div>

      <div className="mx-5 mb-4 flex items-center border border-ink bg-chalk px-3 sm:mx-0 lg:max-w-xl">
        <span className="text-ink-60">
          <Icon name="search" size={14} />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="SEARCH REFEREES BY NAME OR CITY"
          aria-label="Search referees"
          className="flex-1 bg-transparent px-2 py-3 font-mono text-[11px] uppercase text-ink outline-none placeholder:text-ink-40"
        />
        {searching ? (
          <span className="text-signal">
            <Spinner />
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="mx-5 mb-3 font-mono text-[10px] uppercase text-foul sm:mx-0" role="alert">
          {error}
        </p>
      ) : null}

      <div className="px-5 sm:px-0">
        {searchingMode ? (
          results.length === 0 && !searching ? (
            <p className="py-10 text-center font-mono text-[9px] uppercase text-ink-40" style={{ letterSpacing: 1 }}>
              No eligible referees found.
            </p>
          ) : (
            <div className="card-grid">
              {results.map((ref) => (
                <PersonRow
                  key={ref.id}
                  name={ref.display_name}
                  meta={`${ref.city}, ${ref.state} · ${ref.rating.toFixed(1)} rating`}
                  action="Invite"
                  busy={busyId === ref.id}
                  onClick={() => void invite(ref)}
                />
              ))}
            </div>
          )
        ) : loading ? (
          <div className="flex justify-center py-12 text-signal">
            <Spinner />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-16 text-center font-mono text-[9px] uppercase text-ink-40" style={{ letterSpacing: 1 }}>
            Search above to invite referees already on Refee.
          </p>
        ) : (
          <div className="card-grid">
            {visible.map((m) => (
              <PersonRow
                key={m.roster_id}
                name={m.display_name}
                meta={`${m.city}, ${m.state} · ${m.status}`}
                action="Remove"
                destructive
                busy={busyId === m.roster_id}
                onClick={() => void remove(m)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PersonRow({
  name,
  meta,
  action,
  busy,
  destructive = false,
  onClick,
}: {
  name: string;
  meta: string;
  action: string;
  busy: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center border border-ink bg-chalk px-4 py-3">
      <span className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center bg-ink">
        <span className="font-mono-bold text-[10px] text-paper">{name.slice(0, 2).toUpperCase()}</span>
      </span>
      <span className="min-w-0 flex-1 pr-2">
        <span className="block truncate font-mono-bold text-[11px] uppercase text-ink">{name}</span>
        <span className="mt-1 block truncate font-mono text-[8px] uppercase text-ink-40" style={{ letterSpacing: 0.8 }}>
          {meta}
        </span>
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className={`border px-2.5 py-2 hover:opacity-80 disabled:opacity-50 ${
          destructive ? "border-foul text-foul" : "border-ink bg-ink text-paper"
        }`}
      >
        {busy ? (
          <Spinner />
        ) : (
          <span className="font-mono-bold text-[8px] uppercase" style={{ letterSpacing: 1 }}>
            {action}
          </span>
        )}
      </button>
    </div>
  );
}
