"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "@/components/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/AppButton";
import { supabase } from "@/lib/supabase";
import { fetchMyProfile, type ProfileRow } from "@/lib/profile/queries";
import { fetchMyRoles } from "@/lib/assignor/queries";

/** Port of refee-mobile/refee/app/(assignor)/(tabs)/profile.tsx. */
export default function AssignorProfilePage() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      const [profileRes, rolesRes] = await Promise.all([
        fetchMyProfile(session.user.id),
        fetchMyRoles(session.user.id),
      ]);
      setProfile(profileRes.data as ProfileRow | null);
      setRoles(rolesRes.roles);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper text-signal">
        <Spinner />
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper">
        <p className="font-mono-bold uppercase text-ink">Profile not found</p>
      </div>
    );
  }

  const initials = `${profile.first_name?.[0] ?? "A"}${profile.last_initial ?? ""}`.toUpperCase();

  return (
    <div className="app-canvas bg-paper pb-6">
      <div className="flex items-center justify-between px-5 pb-3 pt-1 sm:px-0 lg:pt-6">
        <Wordmark className="text-[26px] lg:hidden" />
        <h1
          className="hidden font-display uppercase text-ink lg:block"
          style={{ fontSize: 34, lineHeight: "34px", letterSpacing: -1.2 }}
        >
          PROFILE<span className="text-signal">.</span>
        </h1>
      </div>
      <div className="px-5 pb-1.5 sm:px-0">
        <span className="font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 2 }}>
          <span className="font-mono-bold text-ink">ASSIGNOR</span> · PROFILE
        </span>
      </div>
      <div className="mb-5 px-5 sm:px-0">
        <ZebraRule variant="signal" thin />
      </div>

      <div className="split-grid px-5 sm:px-0">
        <div className="min-w-0">
          <div className="mb-6 flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center bg-ink">
              <span className="font-display text-paper" style={{ fontSize: 22 }}>
                {initials}
              </span>
            </span>
            <span>
              <span
                className="block font-display uppercase text-ink"
                style={{ fontSize: 28, lineHeight: "29px", letterSpacing: -1 }}
              >
                {profile.display_name}
              </span>
              <span className="mt-1 block font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 1.5 }}>
                {profile.city}, {profile.state}
              </span>
            </span>
          </div>
          <div className="border border-ink bg-chalk">
            <InfoRow label="Primary role" value="ASSIGNOR" />
            <span className="block h-px bg-ink-20" />
            <InfoRow
              label="All roles"
              value={roles.map((r) => r.toUpperCase()).join(" · ") || "ASSIGNOR"}
            />
            <span className="block h-px bg-ink-20" />
            <InfoRow
              label="Member since"
              value={profile.member_since ? String(new Date(profile.member_since).getFullYear()) : "—"}
            />
          </div>
        </div>
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="flex w-full items-center justify-center gap-2 bg-foul py-4 text-paper hover:opacity-80"
          >
            <Icon name="log-out" size={14} />
            <span className="font-mono-bold uppercase" style={{ fontSize: 11, letterSpacing: 2 }}>
              Sign out
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="font-mono text-[9px] uppercase text-ink-40" style={{ letterSpacing: 2 }}>
        {label}
      </span>
      <span className="ml-3 flex-1 truncate text-right font-mono-bold text-[10px] uppercase text-ink">{value}</span>
    </div>
  );
}
