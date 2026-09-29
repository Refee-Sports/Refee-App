"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/AppButton";
import { Icon } from "@/components/ui/Icon";
import { useFocusEffect } from "@/hooks/useFocusEffect";
import { supabase } from "@/lib/supabase";
import {
  extractRosterCode,
  fetchMyRosterInvites,
  fetchMyRosters,
  leaveRoster,
  respondToRosterInvite,
  type MyRosterRow,
  type RosterInviteRow,
} from "@/lib/assignor/queries";

/** Every roster (organization) this referee is on — they can be on any number. */
export default function OrganizationsPage() {
  const router = useRouter();
  const [rosters, setRosters] = useState<MyRosterRow[]>([]);
  const [invites, setInvites] = useState<RosterInviteRow[]>([]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }
    const [mine, pending] = await Promise.all([
      fetchMyRosters(session.user.id),
      fetchMyRosterInvites(session.user.id),
    ]);
    setRosters(mine.rosters);
    setInvites(pending.invites);
    setError(mine.error?.message ?? pending.error?.message ?? null);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const respond = async (invite: RosterInviteRow, accept: boolean) => {
    if (busyId) return;
    setBusyId(invite.roster_id);
    const { error: e } = await respondToRosterInvite(invite.roster_id, accept);
    setBusyId(null);
    if (e) setError(e.message);
    else await load();
  };

  const leave = async (roster: MyRosterRow) => {
    if (busyId) return;
    if (!window.confirm(`Leave ${roster.assignor_name}'s roster?\n\nYou'll stop seeing their games and announcements. Games you've already accepted stay on your schedule.`)) {
      return;
    }
    setBusyId(roster.roster_id);
    const { error: e } = await leaveRoster(roster.roster_id);
    setBusyId(null);
    if (e) setError(e.message);
    else await load();
  };

  const parsed = extractRosterCode(code);

  return (
    <div className="app-canvas bg-paper pb-10">
      <div className="flex items-center gap-3 px-5 pb-3 pt-4 sm:px-0 lg:pt-6">
        <Link
          href="/app/profile"
          aria-label="Back to profile"
          className="flex h-9 w-9 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="chevron-left" size={18} />
        </Link>
        <h1 className="font-display uppercase text-ink" style={{ fontSize: 28, letterSpacing: -1 }}>
          My organizations<span className="text-signal">.</span>
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-signal"><Spinner /></div>
      ) : (
        <div className="px-5 sm:px-0 lg:max-w-2xl">
          {error ? <p className="mb-3 font-mono text-[10px] uppercase text-foul" role="alert">{error}</p> : null}

          {invites.length > 0 ? (
            <section className="mb-6">
              <h2 className="mb-2 font-mono-bold text-[9px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
                Invitations ({invites.length})
              </h2>
              {invites.map((invite) => (
                <div key={invite.roster_id} className="mb-2 border border-signal bg-signal/5 px-4 py-3">
                  <p className="font-mono-bold text-[11px] uppercase text-ink">{invite.assignor_name}</p>
                  <p className="font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1 }}>
                    Invites you to their roster{invite.assignor_city ? ` · ${invite.assignor_city}, ${invite.assignor_state}` : ""}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void respond(invite, true)}
                      className="flex flex-1 items-center justify-center bg-ink py-2.5 font-mono-bold text-[10px] uppercase text-paper hover:opacity-80 disabled:opacity-50"
                      style={{ letterSpacing: 1.5 }}
                    >
                      {busyId === invite.roster_id ? <Spinner /> : "Join"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void respond(invite, false)}
                      className="flex-1 border border-ink py-2.5 font-mono-bold text-[10px] uppercase text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
                      style={{ letterSpacing: 1.5 }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          <h2 className="mb-2 font-mono-bold text-[9px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
            You&apos;re on {rosters.length} {rosters.length === 1 ? "roster" : "rosters"}
          </h2>
          {rosters.length === 0 ? (
            <p className="border border-dashed border-ink-20 px-5 py-6 text-center font-mono text-[10px] uppercase text-ink-40" style={{ letterSpacing: 1.2 }}>
              You&apos;re not on any assignor&apos;s roster yet. Ask an assignor for their QR code or invite code.
            </p>
          ) : (
            rosters.map((roster) => (
              <div key={roster.roster_id} className="mb-2 flex items-center border border-ink bg-chalk px-4 py-3">
                <span className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center bg-ink font-mono-bold text-[10px] text-paper">
                  {roster.assignor_name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 pr-2">
                  <span className="block truncate font-mono-bold text-[11px] uppercase text-ink">{roster.assignor_name}</span>
                  <span className="mt-1 block truncate font-mono text-[8px] uppercase text-ink-40" style={{ letterSpacing: 0.8 }}>
                    {roster.assignor_city ? `${roster.assignor_city}, ${roster.assignor_state} · ` : ""}
                    {roster.joined_at
                      ? `Joined ${new Date(roster.joined_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                      : "On roster"}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void leave(roster)}
                  className="border border-foul px-2.5 py-2 font-mono-bold text-[8px] uppercase text-foul hover:opacity-80 disabled:opacity-50"
                  style={{ letterSpacing: 1 }}
                >
                  {busyId === roster.roster_id ? <Spinner /> : "Leave"}
                </button>
              </div>
            ))
          )}

          <h2 className="mb-2 mt-8 font-mono-bold text-[9px] uppercase text-ink" style={{ letterSpacing: 1.5 }}>
            Join with a code
          </h2>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ROSTER CODE"
              aria-label="Roster code"
              maxLength={60}
              className="flex-1 border border-ink bg-chalk px-3 py-3 font-mono-bold text-[13px] uppercase text-ink outline-none"
              style={{ letterSpacing: 3 }}
            />
            <button
              type="button"
              disabled={!parsed}
              onClick={() => parsed && router.push(`/join/${parsed}`)}
              className={`px-5 font-mono-bold text-[10px] uppercase ${parsed ? "bg-ink text-paper hover:opacity-80" : "cursor-not-allowed bg-ink-20 text-ink-40"}`}
              style={{ letterSpacing: 1.5 }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
