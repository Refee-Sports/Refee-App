"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/AppButton";
import { supabase } from "@/lib/supabase";
import {
  fetchMyAvailability,
  fetchMyCertifications,
  fetchMyLevels,
  fetchMyProfile,
  fetchMyRefSports,
  toggleAvailability,
  type AvailabilityRow,
  type CertificationRow,
  type ProfileRow,
  type RefLevelRow,
  type RefSportRow,
} from "@/lib/profile/queries";
import {
  fetchEarningsSummary,
  fetchUpcomingGames,
  type EarningsPeriod,
  type EarningsSummary,
  type UpcomingGameRow,
} from "@/lib/referee/queries";
import { getOrCreateCrewConversation } from "@/lib/messages/queries";
import { uploadAvatarFile } from "@/lib/profile/avatar";
import { unregisterPushToken } from "@/lib/push/notifications";
import { fetchPayoutStatus, getPayoutOnboardingLink, type PayoutStatus } from "@/lib/payments/queries";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const TZ = "America/Chicago";

const CERT_LABELS: Record<string, string> = {
  iaabo: "IAABO",
  nfhs: "NFHS",
  ncaa: "NCAA",
  fiba: "FIBA",
};

const LEVEL_LABELS: Record<string, string> = {
  youth_rec: "Youth League / Rec",
  high_school: "High School",
  juco: "JUCO",
  naia: "NAIA",
  ncaa_mens: "NCAA Men's",
  ncaa_womens: "NCAA Women's",
  pro_am: "Pro-Am",
};

const LEVEL_TIERS: Record<string, string> = {
  youth_rec: "AMATEUR",
  high_school: "AMATEUR",
  juco: "COLLEGE",
  naia: "COLLEGE",
  ncaa_mens: "COLLEGE",
  ncaa_womens: "COLLEGE",
  pro_am: "PRO",
};

const PERIOD_LABEL: Record<EarningsPeriod, string> = {
  week: "EARNED / WK",
  month: "EARNED / MO",
  year: "EARNED / YR",
};

function dayBit(day: number, mask: number) {
  return !!(mask & (1 << day));
}

function daysLabel(mask: number): string {
  if (mask === 0b1111111) return "ALL DAYS";
  if (mask === 0b0111110) return "WEEKDAYS";
  if (mask === 0b1000001) return "WEEKENDS";
  return `${DAYS.filter((_, i) => dayBit(i, mask)).length} DAYS`;
}

/** Port of refee-mobile/refee/app/(app)/(tabs)/profile.tsx. */
export default function RefereeProfilePage() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [sports, setSports] = useState<RefSportRow[]>([]);
  const [avail, setAvail] = useState<AvailabilityRow | null>(null);
  const [certs, setCerts] = useState<CertificationRow[]>([]);
  const [levels, setLevels] = useState<RefLevelRow[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<UpcomingGameRow[]>([]);
  const [earnings, setEarnings] = useState<EarningsSummary>({
    totalEarned: 0,
    gamesWorked: 0,
    pendingTotal: 0,
    pendingGames: 0,
  });
  const [earningsPeriod, setEarningsPeriod] = useState<EarningsPeriod>("week");
  const [loading, setLoading] = useState(true);
  const [availToggling, setAvailToggling] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus | null>(null);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const uid = session.user.id;

      const [profileRes, sportsRes, availRes, certsRes, levelsRes, upcomingRes, earningsRes] =
        await Promise.all([
          fetchMyProfile(uid),
          fetchMyRefSports(uid),
          fetchMyAvailability(uid),
          fetchMyCertifications(uid),
          fetchMyLevels(uid),
          fetchUpcomingGames(uid),
          fetchEarningsSummary(uid, "week"),
        ]);

      if (cancelled) return;
      setProfile(profileRes.data as ProfileRow | null);
      setSports((sportsRes.data ?? []) as RefSportRow[]);
      setAvail(availRes.data as AvailabilityRow | null);
      setCerts((certsRes.data ?? []) as CertificationRow[]);
      setLevels((levelsRes.data ?? []) as RefLevelRow[]);
      setUpcomingGames(upcomingRes.games);
      setEarnings(earningsRes.summary);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { summary } = await fetchEarningsSummary(session.user.id, earningsPeriod);
      setEarnings(summary);
    })();
  }, [earningsPeriod]);

  useEffect(() => {
    // Non-critical: tolerate edge functions being unavailable locally.
    (async () => {
      const { status, error: err } = await fetchPayoutStatus();
      if (!err) setPayoutStatus(status);
    })();
  }, []);

  const cyclePeriod = () =>
    setEarningsPeriod((p) => (p === "week" ? "month" : p === "month" ? "year" : "week"));

  const handleAvailToggle = async () => {
    if (!profile || availToggling) return;
    const next = !profile.is_available;
    setAvailToggling(true);
    setProfile((p) => (p ? { ...p, is_available: next } : p));
    await toggleAvailability(profile.id, next);
    setAvailToggling(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile) return;
    setNotice(null);
    setUploadingAvatar(true);
    const { avatarUrl, error: err } = await uploadAvatarFile(profile.id, file);
    setUploadingAvatar(false);
    if (err) {
      setNotice(`Upload failed: ${err.message}`);
      return;
    }
    if (avatarUrl) setProfile((p) => (p ? { ...p, avatar_url: avatarUrl } : p));
  };

  const handleSetUpPayouts = async () => {
    if (payoutBusy) return;
    setNotice(null);
    setPayoutBusy(true);
    try {
      // Stripe account links need an https return URL. On web we can come
      // straight back to this page.
      const returnUrl = `${window.location.origin}/app/profile`;
      const { url, error: err } = await getPayoutOnboardingLink(returnUrl);
      if (err || !url) {
        setNotice(err?.message ?? "Could not start payout setup.");
        return;
      }
      window.location.href = url;
    } finally {
      setPayoutBusy(false);
    }
  };

  const signOut = async () => {
    await unregisterPushToken();
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper text-signal">
        <Spinner />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper px-6">
        <p
          className="whitespace-pre-line text-center font-mono-bold text-sm uppercase text-ink"
          style={{ letterSpacing: 1 }}
        >
          {"Profile not found.\nPlease complete sign-up."}
        </p>
      </div>
    );
  }

  const initials = `${profile.first_name[0]}${profile.last_initial}`.toUpperCase();
  const memberYear = profile.member_since ? new Date(profile.member_since).getFullYear() : "—";
  const availDays = avail?.available_days ?? 0;
  const currentYear = new Date().getFullYear();

  const levelsByTier: Record<string, RefLevelRow[]> = {};
  for (const l of levels) {
    const tier = LEVEL_TIERS[l.level_id] ?? "OTHER";
    (levelsByTier[tier] ??= []).push(l);
  }
  const tierOrder = ["AMATEUR", "COLLEGE", "PRO"];

  let sectionNum = 0;
  const nextNum = () => String(++sectionNum).padStart(2, "0");

  return (
    <div className="app-canvas bg-paper pb-6">
      {/* App header */}
      <div className="flex items-center justify-between px-5 pb-3 pt-1 sm:px-0 lg:pt-6">
        <Wordmark className="text-[26px] lg:hidden" />
        <h1
          className="hidden font-display uppercase text-ink lg:block"
          style={{ fontSize: 34, lineHeight: "34px", letterSpacing: -1.2 }}
        >
          PROFILE<span className="text-signal">.</span>
        </h1>
        <Link
          href="/app/edit-profile"
          aria-label="Edit profile"
          className="flex h-9 w-9 items-center justify-center border border-ink bg-chalk text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="edit-2" size={14} />
        </Link>
      </div>

      {/* Telemetry */}
      <div className="px-5 sm:px-0 pb-1.5">
        <span className="font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 2 }}>
          <span className="font-mono-bold text-ink">PROFILE</span>
          {` · ID ${profile.ref_id_number}`}
        </span>
      </div>
      <div className="mb-4 px-5">
        <ZebraRule variant="signal" thin />
      </div>

      {notice ? (
        <p
          className="mx-5 sm:mx-0 mb-4 border border-foul bg-foul/10 px-3 py-2 font-mono text-[10px] uppercase text-foul"
          style={{ letterSpacing: 1 }}
        >
          {notice}
        </p>
      ) : null}

      {/* Avatar pill */}
      <div className="mb-5 flex items-center gap-4 px-5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative shrink-0 hover:opacity-80"
          aria-label="Change headshot"
        >
          <span className="flex h-16 w-16 items-center justify-center overflow-hidden border border-ink bg-ink">
            {uploadingAvatar ? (
              <span className="text-paper">
                <Spinner />
              </span>
            ) : profile.avatar_url ? (
              // Supabase Storage URL; plain <img> avoids configuring a remote loader.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 object-cover"
              />
            ) : (
              <span className="font-display text-paper" style={{ fontSize: 22, letterSpacing: -1 }}>
                {initials}
              </span>
            )}
          </span>
          <span className="absolute -left-1 -top-1 bg-ink px-[3px] py-[2px] text-hi-vis">
            <Icon name="camera" size={9} />
          </span>
          <span
            className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 border-2 border-paper"
            style={{ backgroundColor: profile.is_available ? "#00A85C" : "rgba(8,17,28,0.18)" }}
          />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />

        <div className="flex-1">
          <span className="block font-mono text-[9px] uppercase text-ink-60" style={{ letterSpacing: 2 }}>
            REF / {profile.is_available ? "ACTIVE" : "INACTIVE"}
          </span>
          <span
            className="mt-0.5 block font-mono-bold text-[11px] uppercase text-ink"
            style={{ letterSpacing: 1.5 }}
          >
            MEMBER {memberYear}
          </span>
        </div>

        <div className="flex flex-col items-end">
          <span className="mb-0.5 font-mono text-[8px] uppercase text-ink-60" style={{ letterSpacing: 2 }}>
            REF ID
          </span>
          <span
            className="font-display text-ink"
            style={{ fontSize: 22, letterSpacing: -1, lineHeight: "24px" }}
          >
            {profile.ref_id_number}
          </span>
        </div>
      </div>

      {/* Ref hero */}
      <div className="relative mx-5 mb-0.5 overflow-hidden border-b border-t border-ink py-5">
        {/* Ghost jersey number */}
        <span
          aria-hidden
          className="pointer-events-none absolute font-display"
          style={{
            right: -20,
            top: "5%",
            fontSize: 190,
            lineHeight: "190px",
            color: "rgba(8,17,28,0.05)",
            letterSpacing: -8,
          }}
        >
          {profile.ref_id_number}
        </span>

        <h1
          className="relative font-display uppercase text-ink"
          style={{ fontSize: 42, lineHeight: "38px", letterSpacing: -2 }}
        >
          {profile.first_name.toUpperCase()}
          <br />
          <span className="text-signal">{profile.last_initial.toUpperCase()}.</span>
        </h1>

        <p
          className="relative mt-2 font-mono text-[10px] uppercase text-ink-60"
          style={{ letterSpacing: 2 }}
        >
          REF / {profile.city.toUpperCase()}, {profile.state.toUpperCase()}
        </p>

        {/* Scorecard */}
        <div className="relative" style={{ marginTop: 18 }}>
          <span className="absolute -top-1.5 left-3 z-10 bg-paper px-1">
            <span
              className="font-mono-bold text-[7px] uppercase text-ink"
              style={{ letterSpacing: 2.5 }}
            >
              {`SCORECARD / ${currentYear}`}
            </span>
          </span>
          <div className="flex border-[1.5px] border-ink bg-chalk">
            {profile.rating_count < 5 ? (
              <ScoreCell label="Rating" value="NEW" sub={`${profile.rating_count}/5 RATINGS`} />
            ) : (
              <ScoreCell label="Rating" value={profile.rating.toFixed(2)} sub="/ 5.00" />
            )}
            <span className="w-px bg-ink" />
            <ScoreCell label="Reviews" value={String(profile.rating_count)} sub="ALL-TIME" />
            <span className="w-px bg-ink" />
            <ScoreCell
              label="Status"
              value={profile.is_verified ? "A+" : "—"}
              sub={profile.is_verified ? "VERIFIED" : "UNVERIFIED"}
              subCourt={profile.is_verified}
            />
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="mx-5 sm:mx-0 mb-4 flex border border-ink bg-chalk">
        <StatStrip
          label="Games worked"
          value={String(earnings.gamesWorked || profile.games_called_total)}
        />
        <span className="w-px bg-ink" />
        <button type="button" onClick={cyclePeriod} className="flex-1 px-3 py-3 text-left hover:opacity-70">
          <span
            className="mb-1 block font-mono-bold text-[8px] uppercase text-ink-60"
            style={{ letterSpacing: 2 }}
          >
            {PERIOD_LABEL[earningsPeriod]}
          </span>
          <span
            className="block truncate font-display text-ink"
            style={{ fontSize: 16, letterSpacing: -0.5, lineHeight: "18px" }}
          >
            ${earnings.totalEarned.toLocaleString()}
          </span>
          <span
            className="mt-0.5 block font-mono text-[7px] uppercase text-ink-40"
            style={{ letterSpacing: 1.5 }}
          >
            Tap to switch
          </span>
        </button>
        <span className="w-px bg-ink" />
        <StatStrip label="Member since" value={String(memberYear)} />
      </div>

      {/* Detail sections — stacked on phones, two columns once there is room. */}
      <div className="split-grid">
        <div className="min-w-0">

      {/* Pending earnings */}
      {earnings.pendingTotal > 0 && (
        <div className="mx-5 sm:mx-0 -mt-3 mb-4 flex items-center justify-between border border-t-0 border-ink bg-hi-vis px-4 py-2.5">
          <span
            className="font-mono-bold text-[9px] uppercase text-ink"
            style={{ letterSpacing: 1.5 }}
          >
            PENDING · {earnings.pendingGames} GAME{earnings.pendingGames !== 1 ? "S" : ""} SCHEDULED
          </span>
          <span className="font-display text-ink" style={{ fontSize: 16, letterSpacing: -0.5 }}>
            ${earnings.pendingTotal.toLocaleString()}
          </span>
        </div>
      )}

      {/* Upcoming games */}
      {upcomingGames.length > 0 && (
        <>
          <PSectionHeader num={nextNum()} title="Upcoming Games" />
          <div className="mx-5 sm:mx-0 mb-2 flex flex-col gap-1.5">
            {upcomingGames.map((g) => (
              <UpcomingGameCard key={g.assignmentId} game={g} />
            ))}
          </div>
        </>
      )}

      {/* Payouts */}
      {payoutStatus?.payoutsEnabled ? (
        <div className="mx-5 sm:mx-0 mb-4 flex items-center gap-2 border border-court bg-court/10 px-4 py-3 text-court">
          <Icon name="check-circle" size={13} />
          <span className="font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 1.5 }}>
            Payouts ready · pay lands automatically
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSetUpPayouts}
          disabled={payoutBusy}
          className="mx-5 sm:mx-0 mb-4 flex w-[calc(100%-40px)] items-center justify-between border border-ink bg-ink px-4 py-3.5 text-left hover:opacity-80 disabled:opacity-60"
        >
          <span className="flex-1 pr-3">
            <span
              className="block font-mono-bold text-[11px] uppercase text-paper"
              style={{ letterSpacing: 1.5 }}
            >
              {payoutBusy ? "Opening Stripe..." : "Set up payouts"}
            </span>
            <span
              className="mt-0.5 block font-mono text-[9px] uppercase text-paper/60"
              style={{ letterSpacing: 1 }}
            >
              {payoutStatus?.hasAccount
                ? "Finish Stripe onboarding to get paid"
                : "Connect a bank account to get paid for games"}
            </span>
          </span>
          <span className="text-hi-vis">
            {payoutBusy ? <Spinner /> : <Icon name="arrow-right" size={16} />}
          </span>
        </button>
      )}

      {/* Availability */}
      <div
        className="mx-5 sm:mx-0 mb-4 flex items-center justify-between border border-ink px-4 py-3.5"
        style={{ backgroundColor: profile.is_available ? "#C9F031" : "#F5F2EA" }}
      >
        <div>
          <span
            className="block font-mono-bold text-[11px] uppercase text-ink"
            style={{ letterSpacing: 1.5 }}
          >
            {profile.is_available ? "● Available" : "○ Not available"}
          </span>
          {avail && (
            <span
              className="mt-0.5 block font-mono text-[9px] uppercase text-ink-60"
              style={{ letterSpacing: 1.5 }}
            >
              {"< "}
              {avail.travel_radius_miles} MI
              {availDays > 0 ? ` · ${daysLabel(availDays)}` : ""}
            </span>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={profile.is_available}
          aria-label="Toggle availability"
          onClick={handleAvailToggle}
          disabled={availToggling}
          className={`relative h-6 w-11 shrink-0 border border-ink transition-none ${
            profile.is_available ? "bg-ink" : "bg-ink/15"
          } disabled:opacity-60`}
        >
          <span
            className="absolute top-[2px] h-[18px] w-[18px]"
            style={{
              left: profile.is_available ? 22 : 2,
              backgroundColor: profile.is_available ? "#C9F031" : "#E5E1D6",
            }}
          />
        </button>
      </div>

      {/* Days grid */}
      {avail && availDays > 0 && (
        <div className="mx-5 sm:mx-0 mb-4 border border-ink-20 bg-chalk px-4 py-3">
          <span
            className="mb-2 block font-mono-bold text-[9px] uppercase text-ink-60"
            style={{ letterSpacing: 2 }}
          >
            Days available
          </span>
          <div className="flex gap-1">
            {DAYS.map((day, i) => (
              <span
                key={day}
                className={`flex flex-1 items-center justify-center border py-1.5 ${
                  dayBit(i, availDays) ? "border-signal bg-signal" : "border-ink-20 bg-paper"
                }`}
              >
                <span
                  className={`font-mono-bold text-[8px] ${
                    dayBit(i, availDays) ? "text-paper" : "text-ink-40"
                  }`}
                  style={{ letterSpacing: 0.5 }}
                >
                  {day}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

        </div>

        <div className="min-w-0">

      {/* Credentials */}
      {certs.length > 0 && (
        <>
          <PSectionHeader
            num={nextNum()}
            title="Credentials"
            action="[ MANAGE ]"
            actionHref="/app/edit-profile"
          />
          <div className="mx-5 sm:mx-0 flex flex-wrap gap-1.5">
            {certs.map((c) => (
              <span
                key={c.id}
                className="flex items-center gap-1.5 border border-ink bg-chalk px-2.5 py-1.5"
              >
                <span className="text-[10px] text-court">✓</span>
                <span
                  className="font-mono text-[9px] uppercase text-ink"
                  style={{ letterSpacing: 1.5 }}
                >
                  {CERT_LABELS[c.org_name] ?? c.org_name}
                  {c.license_number ? ` ${c.license_number}` : ""}
                </span>
              </span>
            ))}
          </div>
        </>
      )}

      {/* Sports */}
      {sports.length > 0 && (
        <>
          <PSectionHeader num={nextNum()} title="Sports" />
          <div className="mx-5 sm:mx-0 flex flex-col gap-1.5">
            {sports.map((s) => (
              <div
                key={s.sport_id}
                className="flex items-center justify-between border border-ink-20 bg-chalk px-4 py-3"
              >
                <span
                  className="font-mono-bold text-sm uppercase text-ink"
                  style={{ letterSpacing: 1 }}
                >
                  {(s.sports as unknown as { display_name: string })?.display_name ?? s.sport_id}
                </span>
                {s.years_experience > 0 && (
                  <span
                    className="font-mono text-[9px] uppercase text-ink-60"
                    style={{ letterSpacing: 1.5 }}
                  >
                    {s.years_experience} YR{s.years_experience !== 1 ? "S" : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Levels */}
      {levels.length > 0 && (
        <>
          <PSectionHeader num={nextNum()} title="Levels" />
          <div className="mx-5 sm:mx-0 flex flex-col gap-3">
            {tierOrder.map((tier) => {
              const tierLevels = levelsByTier[tier];
              if (!tierLevels?.length) return null;
              return (
                <div key={tier}>
                  <span
                    className="mb-1.5 block font-mono-bold text-[9px] uppercase text-ink-40"
                    style={{ letterSpacing: 2 }}
                  >
                    ── {tier}
                  </span>
                  <div className="flex flex-col gap-1">
                    {tierLevels.map((l) => (
                      <div key={l.level_id} className="border border-ink-20 bg-chalk px-4 py-3">
                        <span className="font-mono text-sm text-ink" style={{ letterSpacing: 0.5 }}>
                          {LEVEL_LABELS[l.level_id] ?? l.level_id}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Sign out */}
      <div className="mx-5 sm:mx-0 mt-10">
        <button
          type="button"
          onClick={signOut}
          className="w-full border border-foul py-4 text-center text-foul hover:bg-foul hover:text-paper"
        >
          <span className="font-mono-bold uppercase" style={{ fontSize: 11, letterSpacing: 2 }}>
            Sign out
          </span>
        </button>
      </div>
        </div>
      </div>
    </div>
  );
}

function ScoreCell({
  label,
  value,
  sub,
  subCourt,
}: {
  label: string;
  value: string;
  sub: string;
  subCourt?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center px-2 py-4">
      <span
        className="mb-1 font-mono-bold text-[8px] uppercase text-ink-60"
        style={{ letterSpacing: 2 }}
      >
        {label}
      </span>
      <span
        className="font-display text-ink"
        style={{ fontSize: 24, letterSpacing: -1, lineHeight: "24px" }}
      >
        {value}
      </span>
      <span
        className={`mt-1 font-mono text-[9px] uppercase ${subCourt ? "text-court" : "text-ink-60"}`}
        style={{ letterSpacing: 1.5 }}
      >
        {sub}
      </span>
    </div>
  );
}

function StatStrip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 px-3 py-3">
      <span
        className="mb-1 block font-mono-bold text-[8px] uppercase text-ink-60"
        style={{ letterSpacing: 2 }}
      >
        {label}
      </span>
      <span
        className="block truncate font-display text-ink"
        style={{ fontSize: 28, letterSpacing: -0.5, lineHeight: "28px" }}
      >
        {value}
      </span>
    </div>
  );
}

function UpcomingGameCard({ game }: { game: UpcomingGameRow }) {
  const router = useRouter();
  const d = new Date(game.startsAt);
  const dateStr = d
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: TZ,
    })
    .toUpperCase();
  const timeStr = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  });

  const openCrew = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const { conversationId } = await getOrCreateCrewConversation(session.user.id, game.jobId);
    if (conversationId) router.push(`/app/conversation/${conversationId}`);
  };

  return (
    <div
      className={`flex items-start justify-between border px-4 py-3.5 ${
        game.needsReconfirm ? "border-foul bg-foul/5" : "border-ink bg-chalk"
      }`}
    >
      <Link href={`/app/job/${game.jobId}`} className="min-w-0 flex-1 pr-3 hover:opacity-80">
        {game.needsReconfirm && (
          <span
            className="mb-1 block font-mono-bold text-[8px] uppercase text-foul"
            style={{ letterSpacing: 1.5 }}
          >
            ⚠ Details changed — tap to re-confirm
          </span>
        )}
        <span
          className="block truncate font-mono-bold text-[12px] uppercase text-ink"
          style={{ letterSpacing: 0.5 }}
        >
          {game.title}
        </span>
        <span
          className="mt-0.5 block font-mono text-[9px] uppercase text-ink-60"
          style={{ letterSpacing: 1 }}
        >
          {game.orgName.toUpperCase()} · {game.venueCity.toUpperCase()}, {game.venueState}
        </span>
        <span
          className="mt-0.5 block font-mono text-[9px] uppercase text-ink-60"
          style={{ letterSpacing: 1 }}
        >
          {dateStr} · {timeStr}
        </span>
      </Link>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="flex flex-col items-end">
          <span
            className="font-display text-ink"
            style={{ fontSize: 20, letterSpacing: -0.5, lineHeight: "20px" }}
          >
            ${game.payPerGame}
          </span>
          <span className="font-mono text-[8px] uppercase text-ink-40" style={{ letterSpacing: 1 }}>
            / game
          </span>
        </span>
        <button
          type="button"
          onClick={openCrew}
          aria-label="Message crew"
          className="flex h-8 w-8 items-center justify-center border border-ink bg-paper text-ink hover:bg-ink hover:text-paper"
        >
          <Icon name="message-square" size={13} />
        </button>
      </div>
    </div>
  );
}

function PSectionHeader({
  num,
  title,
  action,
  actionHref,
}: {
  num: string;
  title: string;
  action?: string;
  actionHref?: string;
}) {
  return (
    <div className="mx-5 sm:mx-0 mb-2.5 mt-5 flex items-baseline justify-between">
      <span className="flex items-baseline gap-2">
        <span className="font-mono text-[8px] text-ink-40" style={{ letterSpacing: 1.5 }}>
          {num}
        </span>
        <span
          className="font-display text-ink"
          style={{ fontSize: 18, letterSpacing: -0.5, lineHeight: "20px" }}
        >
          {title.toUpperCase()}
        </span>
      </span>
      {action && actionHref && (
        <Link
          href={actionHref}
          className="font-mono-bold text-[9px] uppercase text-signal hover:underline"
          style={{ letterSpacing: 1.5 }}
        >
          {action}
        </Link>
      )}
    </div>
  );
}
