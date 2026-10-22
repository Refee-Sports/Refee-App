import { useCallback, useState } from "react";
import { Text, View, ActivityIndicator, Alert } from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScrollScreen } from "@/components/layout/ScrollScreen";
import { Wordmark } from "@/components/ui/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { supabase } from "@/lib/supabase";
import { fetchMyProfile, type ProfileRow } from "@/lib/profile/queries";
import { fetchMyAssignments, type AssignmentRow } from "@/lib/home/queries";
import { RefereeDashboard } from "@/components/home/RefereeDashboard";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";
import {
  fetchMyRosterInvites,
  respondToRosterInvite,
  type RosterInviteRow,
} from "@/lib/assignor/queries";
import { formatGameDate, formatGameTimeWithZone } from "@refee/core/time";
import { palette } from "@refee/design";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/Controls";

/** "SAT · SEP 20" in the venue's zone. */
function formatCardDate(iso: string, tz?: string | null): string {
  const weekday = formatGameDate(iso, tz, { weekday: "short" }).toUpperCase();
  const md = formatGameDate(iso, tz, { month: "short", day: "numeric" }).toUpperCase();
  return `${weekday} · ${md}`;
}

/** "1:30 PM ET" in the venue's zone. */
function formatTime(iso: string, tz?: string | null): string {
  return formatGameTimeWithZone(iso, tz);
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "GOOD MORNING";
  if (h < 17) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

function AssignmentCard({ row }: { row: AssignmentRow }) {
  const router = useRouter();
  const org = row.job.hirers?.org_name.toUpperCase() ?? "ORGANIZER";
  const pay = row.job.pay_per_game * row.job.num_games;

  return (
    <Card
      onPress={() => router.push(`/job/${row.job.id}`)}
      variant="quiet"
      accessibilityLabel={row.job.title}
    >
      <View className="px-4 pt-3.5 pb-1">
        <Text
          className="text-ink font-display"
          style={{ fontSize: 20, letterSpacing: -0.5, lineHeight: 22 }}
          numberOfLines={2}
        >
          {row.job.title.toUpperCase()}
        </Text>
        <Text
          className="text-ink-60 font-mono-bold text-[9px] uppercase mt-1"
          style={{ letterSpacing: 1.5 }}
        >
          {org}
        </Text>
      </View>
      <View className="flex-row border-t border-ink-20 mt-2">
        <View className="flex-1 px-4 py-2.5 border-r border-ink-20">
          <Text className="text-ink-60 font-mono-bold text-[8px] uppercase mb-0.5" style={{ letterSpacing: 1.5 }}>
            WHEN
          </Text>
          <Text className="text-ink font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 0.5 }}>
            {formatCardDate(row.job.starts_at, row.job.timezone)}
          </Text>
          <Text className="text-ink-60 font-mono text-[9px] uppercase mt-0.5" style={{ letterSpacing: 0.5 }}>
            {formatTime(row.job.starts_at, row.job.timezone)}
          </Text>
        </View>
        <View className="flex-1 px-4 py-2.5 border-r border-ink-20">
          <Text className="text-ink-60 font-mono-bold text-[8px] uppercase mb-0.5" style={{ letterSpacing: 1.5 }}>
            WHERE
          </Text>
          <Text className="text-ink font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 0.5 }} numberOfLines={1}>
            {row.job.venue_name.toUpperCase()}
          </Text>
          <Text className="text-ink-60 font-mono text-[9px] uppercase mt-0.5" style={{ letterSpacing: 0.5 }}>
            {row.job.venue_city}, {row.job.venue_state}
          </Text>
        </View>
        <View className="px-4 py-2.5 items-end justify-center">
          <Text className="text-ink-60 font-mono-bold text-[8px] uppercase mb-0.5" style={{ letterSpacing: 1.5 }}>
            PAY
          </Text>
          <Text className="text-ink font-display" style={{ fontSize: 18, letterSpacing: -0.5 }}>
            ${pay}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View className="border border-dashed border-ink-20 px-5 py-6 items-center">
      <Text
        className="text-ink-40 font-mono text-[10px] uppercase text-center"
        style={{ letterSpacing: 1.5 }}
      >
        {message}
      </Text>
    </View>
  );
}

function SectionHeader({ children }: { children: string }) {
  return (
    <Text
      className="text-ink-60 font-mono-bold text-[9px] uppercase mx-5 mt-6 mb-3"
      style={{ letterSpacing: 2 }}
    >
      {children}
    </Text>
  );
}

export default function Home() {
  const tabBarHeight = useBottomTabBarHeight();
  const profileVersion = useOnboardingStore((s) => s.profileVersion);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [todayGames, setTodayGames] = useState<AssignmentRow[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<AssignmentRow[]>([]);
  const [rosterInvites, setRosterInvites] = useState<RosterInviteRow[]>([]);
  const [rosterBusyId, setRosterBusyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      (async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session || cancelled) return;
        const uid = session.user.id;

        setUserId(uid);
        const [profileRes, assignRes, rosterRes] = await Promise.all([
          fetchMyProfile(uid),
          fetchMyAssignments(uid),
          fetchMyRosterInvites(uid),
        ]);

        if (cancelled) return;
        setProfile(profileRes.data as ProfileRow | null);
        setTodayGames(assignRes.today);
        setUpcomingGames(assignRes.upcoming);
        setRosterInvites(rosterRes.invites);
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    // profileVersion is an explicit external-store invalidation signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profileVersion])
  );

  if (loading) {
    return (
      <View className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator color={palette.signal} />
      </View>
    );
  }

  const firstName = profile?.first_name.toUpperCase() ?? "REF";

  const respondToRoster = async (invite: RosterInviteRow, accept: boolean) => {
    if (rosterBusyId) return;
    setRosterBusyId(invite.roster_id);
    const result = await respondToRosterInvite(invite.roster_id, accept);
    setRosterBusyId(null);
    if (result.error) {
      Alert.alert("Could not respond", result.error.message);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRosterInvites((current) => current.filter((row) => row.roster_id !== invite.roster_id));
  };

  return (
    <ScrollScreen bottomOffset={tabBarHeight}>
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <View className="px-5 py-3 flex-row justify-between items-center">
        <Wordmark size={26} />
        <View className="flex-row items-center gap-1.5">
          {profile?.is_available ? (
            <View className="w-1.5 h-1.5 rounded-full bg-court" />
          ) : (
            <View className="w-1.5 h-1.5 rounded-full bg-ink-20" />
          )}
          <Text
            className="font-mono-bold text-[9px] uppercase"
            style={{
              letterSpacing: 1.5,
              color: profile?.is_available ? palette.courtInk : palette.ink40,
            }}
          >
            {profile?.is_available ? "AVAILABLE" : "UNAVAILABLE"}
          </Text>
        </View>
      </View>
      <ZebraRule />

      {/* ── Greeting ─────────────────────────────────────────────── */}
      <View className="px-5 pt-5 pb-4 border-b border-ink-20">
        <Text
          className="text-signal font-mono-bold text-[10px] uppercase mb-1"
          style={{ letterSpacing: 2 }}
        >
          {getGreeting()}
        </Text>
        <Text
          className="text-ink font-display"
          style={{ fontSize: 36, lineHeight: 34, letterSpacing: -1.5 }}
        >
          {firstName}.
        </Text>
      </View>

      {rosterInvites.length > 0 && (
        <>
          <SectionHeader>{`ROSTER INVITES · ${rosterInvites.length} NEED ACTION`}</SectionHeader>
          <View className="mx-5 gap-3">
            {rosterInvites.map((invite) => (
              <View key={invite.roster_id} className="border border-signal bg-signal-tint px-4 py-4">
                <Text className="font-mono-bold text-[11px] text-ink uppercase" style={{ letterSpacing: 1 }}>
                  {invite.assignor_name}
                </Text>
                <Text className="font-mono text-[9px] text-ink-60 uppercase mt-1" style={{ letterSpacing: 1 }}>
                  INVITED YOU TO THEIR REFEREE ROSTER
                  {invite.assignor_city ? ` · ${invite.assignor_city}, ${invite.assignor_state ?? ""}` : ""}
                </Text>
                <Text className="font-mono text-[8px] text-ink-40 uppercase mt-2" style={{ letterSpacing: 0.8 }}>
                  Joining allows this assignor to send game offers. Every game still requires your acceptance.
                </Text>
                <View className="flex-row mt-3">
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Decline"
                      variant="secondary"
                      size="sm"
                      fullWidth
                      disabled={rosterBusyId !== null}
                      onPress={() => void respondToRoster(invite, false)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Join roster"
                      size="sm"
                      fullWidth
                      loading={rosterBusyId === invite.roster_id}
                      loadingLabel="Joining"
                      disabled={rosterBusyId !== null}
                      onPress={() => void respondToRoster(invite, true)}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {userId ? <RefereeDashboard userId={userId} /> : null}

      {/* ── Today ────────────────────────────────────────────────── */}
      <SectionHeader>TODAY</SectionHeader>
      <View className="mx-5 gap-3">
        {todayGames.length === 0 ? (
          <EmptyState message={"No games on the schedule today.\nCheck the jobs feed."} />
        ) : (
          todayGames.map((r) => <AssignmentCard key={r.id} row={r} />)
        )}
      </View>

      {/* ── Upcoming ─────────────────────────────────────────────── */}
      {upcomingGames.length > 0 && (
        <>
          <SectionHeader>UPCOMING</SectionHeader>
          <View className="mx-5 gap-3">
            {upcomingGames.slice(0, 3).map((r) => (
              <AssignmentCard key={r.id} row={r} />
            ))}
          </View>
        </>
      )}

      {/* ── Quick actions ────────────────────────────────────────── */}
      <SectionHeader>QUICK ACTIONS</SectionHeader>
      <View className="mx-5 gap-2 mb-4">
        <QuickAction label="BROWSE OPEN JOBS" href="/jobs" />
        <QuickAction label="VIEW MY PROFILE" href="/profile" />
      </View>
    </ScrollScreen>
  );
}

function QuickAction({ label, href }: { label: string; href: string }) {
  const router = useRouter();
  return (
    <ListRow label={label} onPress={() => router.push(href as any)} />
  );
}
