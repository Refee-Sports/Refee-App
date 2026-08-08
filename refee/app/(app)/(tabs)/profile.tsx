import { useEffect, useState } from "react";
import { Text, View, Pressable, Switch, ActivityIndicator, Image, Alert } from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { ScrollScreen } from "@/components/layout/ScrollScreen";
import { Wordmark } from "@/components/ui/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import {
  fetchMyProfile,
  fetchMyRefSports,
  fetchMyAvailability,
  fetchMyCertifications,
  fetchMyLevels,
  toggleAvailability,
  ProfileRow,
  RefSportRow,
  AvailabilityRow,
  CertificationRow,
  RefLevelRow,
} from "@/lib/profile/queries";
import { fetchUpcomingGames, fetchEarningsSummary, type UpcomingGameRow, type EarningsSummary, type EarningsPeriod } from "@/lib/referee/queries";
import { getOrCreateCrewConversation } from "@/lib/messages/queries";
import { pickAndUploadAvatar } from "@/lib/profile/avatar";
import { unregisterPushToken } from "@/lib/push/notifications";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import {
  getPayoutOnboardingLink,
  fetchPayoutStatus,
  type PayoutStatus,
} from "@/lib/payments/queries";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

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

const PAPER = "#E5E1D6";

function dayBit(day: number, mask: number) {
  return !!(mask & (1 << day));
}

function daysLabel(mask: number): string {
  if (mask === 0b1111111) return "ALL DAYS";
  if (mask === 0b0111110) return "WEEKDAYS";
  if (mask === 0b1000001) return "WEEKENDS";
  const count = DAYS.filter((_, i) => dayBit(i, mask)).length;
  return `${count} DAYS`;
}

export default function Profile() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const profileVersion = useOnboardingStore((s) => s.profileVersion);

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
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
          fetchEarningsSummary(uid, earningsPeriod),
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
    return () => { cancelled = true; };
  }, [profileVersion]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { summary } = await fetchEarningsSummary(session.user.id, earningsPeriod);
      setEarnings(summary);
    })();
  }, [earningsPeriod]);

  const cyclePeriod = () => {
    Haptics.selectionAsync();
    setEarningsPeriod((p) => p === "week" ? "month" : p === "month" ? "year" : "week");
  };

  const PERIOD_LABEL: Record<EarningsPeriod, string> = {
    week: "EARNED / WK",
    month: "EARNED / MO",
    year: "EARNED / YR",
  };

  const handleAvailToggle = async (value: boolean) => {
    if (!profile || availToggling) return;
    Haptics.selectionAsync();
    setAvailToggling(true);
    setProfile((p) => (p ? { ...p, is_available: value } : p));
    await toggleAvailability(profile.id, value);
    setAvailToggling(false);
  };

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus | null>(null);
  const [payoutBusy, setPayoutBusy] = useState(false);

  useEffect(() => {
    // Non-critical: tolerate edge functions being unavailable locally
    (async () => {
      const { status, error: err } = await fetchPayoutStatus();
      if (!err) setPayoutStatus(status);
    })();
  }, [profileVersion]);

  const handleSetUpPayouts = async () => {
    if (payoutBusy) return;
    Haptics.selectionAsync();
    setPayoutBusy(true);
    try {
      const returnUrl = Linking.createURL("payouts-return");
      const { url, error: err } = await getPayoutOnboardingLink(returnUrl);
      if (err || !url) {
        Alert.alert(
          "Payouts unavailable",
          err?.message ?? "Could not start payout setup. Is the local Stripe function running?"
        );
        return;
      }
      await WebBrowser.openBrowserAsync(url);
      // re-check status after they come back (also releases any held pay)
      const { status } = await fetchPayoutStatus();
      setPayoutStatus(status);
      if (status.released > 0) {
        Alert.alert(
          "Payouts released",
          `Held pay from ${status.released} past game${status.released !== 1 ? "s" : ""} just transferred to your account.`
        );
      }
    } finally {
      setPayoutBusy(false);
    }
  };

  const handleAvatarPress = async () => {
    if (!profile || uploadingAvatar) return;
    Haptics.selectionAsync();
    setUploadingAvatar(true);
    const { avatarUrl, error: err, cancelled } = await pickAndUploadAvatar(profile.id);
    setUploadingAvatar(false);
    if (cancelled) return;
    if (err) {
      Alert.alert("Upload failed", err.message);
      return;
    }
    if (avatarUrl) {
      setProfile((p) => (p ? { ...p, avatar_url: avatarUrl } : p));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const signOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await unregisterPushToken();
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <View className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator color="#1F4FCC" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 bg-paper items-center justify-center px-6">
        <Text className="text-ink font-mono-bold text-sm uppercase text-center" style={{ letterSpacing: 1 }}>
          Profile not found.{"\n"}Please complete sign-up.
        </Text>
      </View>
    );
  }

  const initials = `${profile.first_name[0]}${profile.last_initial}`.toUpperCase();
  const memberYear = profile.member_since ? new Date(profile.member_since).getFullYear() : "—";
  const availDays = avail?.available_days ?? 0;
  const currentYear = new Date().getFullYear();

  const levelsByTier: Record<string, RefLevelRow[]> = {};
  for (const l of levels) {
    const tier = LEVEL_TIERS[l.level_id] ?? "OTHER";
    if (!levelsByTier[tier]) levelsByTier[tier] = [];
    levelsByTier[tier].push(l);
  }
  const tierOrder = ["AMATEUR", "COLLEGE", "PRO"];

  return (
    <ScrollScreen bottomOffset={tabBarHeight}>

      {/* ── App header ───────────────────────────────────────────── */}
      <View className="px-5 pt-1 pb-3 flex-row items-center justify-between">
        <Wordmark size={26} />
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/edit-profile");
          }}
          className="w-9 h-9 bg-chalk border border-ink items-center justify-center active:opacity-70"
        >
          <Feather name="edit-2" size={14} color="#08111C" />
        </Pressable>
      </View>

      {/* ── Telemetry ────────────────────────────────────────────── */}
      <View className="px-5 pb-1.5 flex-row justify-between items-center">
        <Text className="font-mono text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 2 }}>
          <Text className="font-mono-bold text-ink">PROFILE</Text>
          {` · ID ${profile.ref_id_number}`}
        </Text>
      </View>
      <View className="px-5 mb-4">
        <ZebraRule variant="signal" thin />
      </View>

      {/* ── Avatar pill ──────────────────────────────────────────── */}
      <View className="px-5 flex-row items-center gap-4 mb-5">
        <Pressable onPress={handleAvatarPress} style={{ position: "relative" }} className="active:opacity-80">
          <View className="w-16 h-16 bg-ink border border-ink items-center justify-center overflow-hidden">
            {uploadingAvatar ? (
              <ActivityIndicator color="#E5E1D6" size="small" />
            ) : profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={{ width: 64, height: 64 }} resizeMode="cover" />
            ) : (
              <Text className="text-paper font-display" style={{ fontSize: 22, letterSpacing: -1 }}>
                {initials}
              </Text>
            )}
          </View>
          {/* camera hint */}
          <View
            style={{
              position: "absolute",
              top: -4,
              left: -4,
              backgroundColor: "#08111C",
              paddingHorizontal: 3,
              paddingVertical: 2,
            }}
          >
            <Feather name="camera" size={9} color="#C9F031" />
          </View>
          <View
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 14,
              height: 14,
              backgroundColor: profile.is_available ? "#00A85C" : "rgba(8,17,28,0.18)",
              borderWidth: 2,
              borderColor: PAPER,
            }}
          />
        </Pressable>

        <View className="flex-1">
          <Text className="font-mono text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 2 }}>
            REF / {profile.is_available ? "ACTIVE" : "INACTIVE"}
          </Text>
          <Text className="font-mono-bold text-[11px] text-ink uppercase mt-0.5" style={{ letterSpacing: 1.5 }}>
            MEMBER {memberYear}
          </Text>
        </View>

        <View className="items-end">
          <Text className="font-mono text-[8px] text-ink-60 uppercase mb-0.5" style={{ letterSpacing: 2 }}>
            REF ID
          </Text>
          <Text className="font-display text-ink" style={{ fontSize: 22, letterSpacing: -1, lineHeight: 24 }}>
            {profile.ref_id_number}
          </Text>
        </View>
      </View>

      {/* ── Ref hero ─────────────────────────────────────────────── */}
      <View
        className="mx-5 border-t border-b border-ink pt-5 pb-5 mb-0.5"
        style={{ overflow: "hidden", position: "relative" }}
      >
        {/* Ghost jersey number */}
        <Text
          style={{
            position: "absolute",
            right: -20,
            top: "5%",
            fontFamily: "InterTight_900Black",
            fontSize: 190,
            lineHeight: 190,
            color: "rgba(8,17,28,0.05)",
            letterSpacing: -8,
          }}
          numberOfLines={1}
          pointerEvents="none"
        >
          {profile.ref_id_number}
        </Text>

        {/* Name */}
        <Text
          className="font-display text-ink uppercase"
          style={{ fontSize: 42, lineHeight: 38, letterSpacing: -2 }}
        >
          {profile.first_name.toUpperCase()}{"\n"}
          <Text style={{ color: "#1F4FCC" }}>{profile.last_initial.toUpperCase()}.</Text>
        </Text>

        {/* Handle */}
        <Text
          className="font-mono text-ink-60 text-[10px] uppercase mt-2"
          style={{ letterSpacing: 2 }}
        >
          REF / {profile.city.toUpperCase()}, {profile.state.toUpperCase()}
        </Text>

        {/* Scoreboard block */}
        <View style={{ marginTop: 18, position: "relative" }}>
          <View
            style={{
              position: "absolute",
              top: -6,
              left: 12,
              zIndex: 1,
              backgroundColor: PAPER,
              paddingHorizontal: 4,
            }}
          >
            <Text
              style={{
                fontFamily: "JetBrainsMono_700Bold",
                fontSize: 7,
                textTransform: "uppercase",
                letterSpacing: 2.5,
                color: "#08111C",
              }}
            >
              {`SCORECARD / ${currentYear}`}
            </Text>
          </View>
          <View className="border-[1.5px] border-ink bg-chalk flex-row">
            {profile.rating_count < 5 ? (
              <ScoreCell label="RATING" value="NEW" sub={`${profile.rating_count}/5 RATINGS`} />
            ) : (
              <ScoreCell label="RATING" value={profile.rating.toFixed(2)} sub="/ 5.00" />
            )}
            <View className="w-px bg-ink" />
            <ScoreCell label="REVIEWS" value={String(profile.rating_count)} sub="ALL-TIME" />
            <View className="w-px bg-ink" />
            <ScoreCell
              label="STATUS"
              value={profile.is_verified ? "A+" : "—"}
              sub={profile.is_verified ? "VERIFIED" : "UNVERIFIED"}
              subColor={profile.is_verified ? "#00A85C" : undefined}
            />
          </View>
        </View>
      </View>

      {/* ── Stat strip ───────────────────────────────────────────── */}
      <View className="mx-5 border border-ink bg-chalk flex-row mb-4">
        <StatStrip label="GAMES WORKED" value={String(earnings.gamesWorked || profile.games_called_total)} />
        <View className="w-px bg-ink" />
        <Pressable className="flex-1 px-3 py-3 active:opacity-70" onPress={cyclePeriod}>
          <Text
            className="text-ink-60 font-mono-bold text-[8px] uppercase mb-1"
            style={{ letterSpacing: 2 }}
          >
            {PERIOD_LABEL[earningsPeriod]}
          </Text>
          <Text
            className="text-ink font-display"
            style={{ fontSize: 16, letterSpacing: -0.5, lineHeight: 18 }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            ${earnings.totalEarned.toLocaleString()}
          </Text>
          <Text
            className="font-mono text-[7px] text-ink-40 uppercase mt-0.5"
            style={{ letterSpacing: 1.5 }}
          >
            TAP TO SWITCH
          </Text>
        </Pressable>
        <View className="w-px bg-ink" />
        <StatStrip label="MEMBER SINCE" value={String(memberYear)} />
      </View>

      {/* ── Pending earnings ─────────────────────────────────────── */}
      {earnings.pendingTotal > 0 && (
        <View className="mx-5 -mt-3 mb-4 border border-t-0 border-ink bg-hivis px-4 py-2.5 flex-row items-center justify-between">
          <Text className="font-mono-bold text-[9px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>
            PENDING · {earnings.pendingGames} GAME{earnings.pendingGames !== 1 ? "S" : ""} SCHEDULED
          </Text>
          <Text className="font-display text-ink" style={{ fontSize: 16, letterSpacing: -0.5 }}>
            ${earnings.pendingTotal.toLocaleString()}
          </Text>
        </View>
      )}

      {/* ── Upcoming games ───────────────────────────────────────── */}
      {upcomingGames.length > 0 && (
        <>
          <PSectionHeader num="01" title="Upcoming Games" />
          <View className="mx-5 gap-1.5 mb-2">
            {upcomingGames.map((g) => (
              <UpcomingGameCard key={g.assignmentId} game={g} />
            ))}
          </View>
        </>
      )}

      {/* ── Payouts ──────────────────────────────────────────────── */}
      {payoutStatus?.payoutsEnabled ? (
        <View className="mx-5 mb-4 border border-court bg-court/10 px-4 py-3 flex-row items-center gap-2">
          <Feather name="check-circle" size={13} color="#00A85C" />
          <Text className="font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 1.5, color: "#00A85C" }}>
            PAYOUTS READY · PAY LANDS AUTOMATICALLY
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={handleSetUpPayouts}
          disabled={payoutBusy}
          className="mx-5 mb-4 border border-ink bg-ink px-4 py-3.5 flex-row items-center justify-between active:opacity-80"
        >
          <View className="flex-1 pr-3">
            <Text className="text-paper font-mono-bold text-[11px] uppercase" style={{ letterSpacing: 1.5 }}>
              {payoutBusy ? "OPENING STRIPE..." : "SET UP PAYOUTS"}
            </Text>
            <Text className="font-mono text-[9px] uppercase mt-0.5" style={{ letterSpacing: 1, color: "rgba(229,225,214,0.6)" }}>
              {payoutStatus?.hasAccount
                ? "FINISH STRIPE ONBOARDING TO GET PAID"
                : "CONNECT A BANK ACCOUNT TO GET PAID FOR GAMES"}
            </Text>
          </View>
          {payoutBusy ? (
            <ActivityIndicator color="#C9F031" size="small" />
          ) : (
            <Feather name="arrow-right" size={16} color="#C9F031" />
          )}
        </Pressable>
      )}

      {/* ── Availability ─────────────────────────────────────────── */}
      <View
        className="mx-5 mb-4 border border-ink flex-row items-center justify-between px-4 py-3.5"
        style={{ backgroundColor: profile.is_available ? "#C9F031" : "#F5F2EA" }}
      >
        <View>
          <Text
            className="font-mono-bold text-[11px] text-ink uppercase"
            style={{ letterSpacing: 1.5 }}
          >
            {profile.is_available ? "● AVAILABLE" : "○ NOT AVAILABLE"}
          </Text>
          {avail && (
            <Text
              className="font-mono text-[9px] text-ink-60 uppercase mt-0.5"
              style={{ letterSpacing: 1.5 }}
            >
              {"< "}{avail.travel_radius_miles} MI
              {availDays > 0 ? ` · ${daysLabel(availDays)}` : ""}
            </Text>
          )}
        </View>
        <Switch
          value={profile.is_available}
          onValueChange={handleAvailToggle}
          disabled={availToggling}
          trackColor={{ false: "rgba(8,17,28,0.15)", true: "#08111C" }}
          thumbColor={profile.is_available ? "#C9F031" : "#E5E1D6"}
        />
      </View>

      {/* Days grid */}
      {avail && availDays > 0 && (
        <View className="mx-5 mb-4 border border-ink-20 bg-chalk px-4 py-3">
          <Text className="text-ink-60 font-mono-bold text-[9px] uppercase mb-2" style={{ letterSpacing: 2 }}>
            DAYS AVAILABLE
          </Text>
          <View className="flex-row gap-1">
            {DAYS.map((day, i) => (
              <View
                key={day}
                className={`flex-1 py-1.5 items-center border ${
                  dayBit(i, availDays) ? "bg-signal border-signal" : "bg-paper border-ink-20"
                }`}
              >
                <Text
                  className={`font-mono-bold text-[8px] ${
                    dayBit(i, availDays) ? "text-paper" : "text-ink-40"
                  }`}
                  style={{ letterSpacing: 0.5 }}
                >
                  {day}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Credentials ──────────────────────────────────────────── */}
      {certs.length > 0 && (
        <>
          <PSectionHeader
            num={upcomingGames.length > 0 ? "02" : "01"}
            title="Credentials"
            action="[ MANAGE ]"
            onAction={() => {
              Haptics.selectionAsync();
              router.push("/edit-profile");
            }}
          />
          <View className="mx-5 flex-row flex-wrap gap-1.5">
            {certs.map((c) => (
              <View
                key={c.id}
                className="flex-row items-center gap-1.5 border border-ink bg-chalk px-2.5 py-1.5"
              >
                <Text style={{ color: "#00A85C", fontSize: 10 }}>✓</Text>
                <Text
                  className="font-mono text-[9px] text-ink uppercase"
                  style={{ letterSpacing: 1.5 }}
                >
                  {CERT_LABELS[c.org_name] ?? c.org_name}
                  {c.license_number ? ` ${c.license_number}` : ""}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ── Sports ───────────────────────────────────────────────── */}
      {sports.length > 0 && (
        <>
          <PSectionHeader num={certs.length > 0 ? "02" : "01"} title="Sports" />
          <View className="mx-5 gap-1.5">
            {sports.map((s) => (
              <View
                key={s.sport_id}
                className="border border-ink-20 bg-chalk flex-row items-center justify-between px-4 py-3"
              >
                <Text className="text-ink font-mono-bold text-sm uppercase" style={{ letterSpacing: 1 }}>
                  {(s.sports as unknown as { display_name: string })?.display_name ?? s.sport_id}
                </Text>
                {s.years_experience > 0 && (
                  <Text className="text-ink-60 font-mono text-[9px] uppercase" style={{ letterSpacing: 1.5 }}>
                    {s.years_experience} YR{s.years_experience !== 1 ? "S" : ""}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </>
      )}

      {/* ── Levels ───────────────────────────────────────────────── */}
      {levels.length > 0 && (
        <>
          <PSectionHeader
            num={String((certs.length > 0 ? 1 : 0) + (sports.length > 0 ? 1 : 0) + 1).padStart(2, "0")}
            title="Levels"
          />
          <View className="mx-5 gap-3">
            {tierOrder.map((tier) => {
              const tierLevels = levelsByTier[tier];
              if (!tierLevels?.length) return null;
              return (
                <View key={tier}>
                  <Text
                    className="text-ink-40 font-mono-bold text-[9px] uppercase mb-1.5"
                    style={{ letterSpacing: 2 }}
                  >
                    ── {tier}
                  </Text>
                  <View className="gap-1">
                    {tierLevels.map((l) => (
                      <View key={l.level_id} className="border border-ink-20 bg-chalk px-4 py-3">
                        <Text className="text-ink font-mono text-sm" style={{ letterSpacing: 0.5 }}>
                          {LEVEL_LABELS[l.level_id] ?? l.level_id}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* ── Sign out ─────────────────────────────────────────────── */}
      <View className="mx-5 mt-10">
        <Pressable onPress={signOut} className="border border-foul py-4 active:opacity-70">
          <Text className="text-foul text-center font-mono-bold uppercase" style={{ fontSize: 11, letterSpacing: 2 }}>
            SIGN OUT
          </Text>
        </Pressable>
      </View>
    </ScrollScreen>
  );
}

function ScoreCell({
  label,
  value,
  sub,
  subColor,
}: {
  label: string;
  value: string;
  sub: string;
  subColor?: string;
}) {
  return (
    <View className="flex-1 px-2 py-4 items-center">
      <Text
        className="text-ink-60 font-mono-bold text-[8px] uppercase mb-1"
        style={{ letterSpacing: 2 }}
      >
        {label}
      </Text>
      <Text
        className="text-ink font-display"
        style={{ fontSize: 24, letterSpacing: -1, lineHeight: 24 }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text
        className="font-mono text-[9px] uppercase mt-1"
        style={{ letterSpacing: 1.5, color: subColor ?? "rgba(8,17,28,0.56)" }}
      >
        {sub}
      </Text>
    </View>
  );
}

function StatStrip({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <View className="flex-1 px-3 py-3">
      <Text
        className="text-ink-60 font-mono-bold text-[8px] uppercase mb-1"
        style={{ letterSpacing: 2 }}
      >
        {label}
      </Text>
      <Text
        className="text-ink font-display"
        style={{ fontSize: small ? 16 : 28, letterSpacing: -0.5, lineHeight: small ? 18 : 28 }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

const TZ = "America/Chicago";

function UpcomingGameCard({ game }: { game: UpcomingGameRow }) {
  const router = useRouter();
  const d = new Date(game.startsAt);
  const dateStr = d
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: TZ })
    .toUpperCase();
  const timeStr = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  });

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        router.push(`/job/${game.jobId}` as any);
      }}
      className={`border px-4 py-3.5 flex-row items-start justify-between active:opacity-80 ${
        game.needsReconfirm ? "border-foul bg-foul/5" : "border-ink bg-chalk"
      }`}
    >
      <View className="flex-1 pr-3">
        {game.needsReconfirm && (
          <Text
            className="font-mono-bold text-[8px] text-foul uppercase mb-1"
            style={{ letterSpacing: 1.5 }}
          >
            ⚠ DETAILS CHANGED — TAP TO RE-CONFIRM
          </Text>
        )}
        <Text
          className="font-mono-bold text-[12px] text-ink uppercase"
          style={{ letterSpacing: 0.5 }}
          numberOfLines={1}
        >
          {game.title}
        </Text>
        <Text className="font-mono text-[9px] text-ink-60 uppercase mt-0.5" style={{ letterSpacing: 1 }}>
          {game.orgName.toUpperCase()} · {game.venueCity.toUpperCase()}, {game.venueState}
        </Text>
        <Text className="font-mono text-[9px] text-ink-60 uppercase mt-0.5" style={{ letterSpacing: 1 }}>
          {dateStr} · {timeStr}
        </Text>
      </View>
      <View className="items-end gap-1.5">
        <View className="items-end">
          <Text
            className="font-display text-ink"
            style={{ fontSize: 20, letterSpacing: -0.5, lineHeight: 20 }}
          >
            ${game.payPerGame}
          </Text>
          <Text className="font-mono text-[8px] text-ink-40 uppercase" style={{ letterSpacing: 1 }}>
            / GAME
          </Text>
        </View>
        <Pressable
          onPress={async () => {
            Haptics.selectionAsync();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const { conversationId } = await getOrCreateCrewConversation(session.user.id, game.jobId);
            if (conversationId) {
              router.push(`/(app)/conversation/${conversationId}` as any);
            }
          }}
          className="w-8 h-8 border border-ink bg-paper items-center justify-center active:opacity-70"
        >
          <Feather name="message-square" size={13} color="#08111C" />
        </Pressable>
      </View>
    </Pressable>
  );
}

function PSectionHeader({
  num,
  title,
  action,
  onAction,
}: {
  num: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View className="mx-5 flex-row justify-between items-baseline mt-5 mb-2.5">
      <View className="flex-row items-baseline gap-2">
        <Text className="text-ink-40 font-mono text-[8px]" style={{ letterSpacing: 1.5 }}>
          {num}
        </Text>
        <Text
          className="text-ink font-display"
          style={{ fontSize: 18, letterSpacing: -0.5, lineHeight: 20 }}
        >
          {title.toUpperCase()}
        </Text>
      </View>
      {action && (
        <Pressable onPress={onAction} className="active:opacity-70">
          <Text className="text-signal font-mono-bold text-[9px] uppercase" style={{ letterSpacing: 1.5 }}>
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
