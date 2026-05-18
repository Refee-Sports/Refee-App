import { useEffect, useState } from "react";
import { Text, View, ActivityIndicator, Pressable } from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScrollScreen } from "@/components/layout/ScrollScreen";
import { Wordmark } from "@/components/ui/Wordmark";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { supabase } from "@/lib/supabase";
import { fetchMyProfile, type ProfileRow } from "@/lib/profile/queries";
import {
  fetchMyAssignments,
  fetchEarningsSummary,
  type AssignmentRow,
  type EarningsSummary,
} from "@/lib/home/queries";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";

const TZ = "America/Chicago";

function formatCardDate(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short", timeZone: TZ }).toUpperCase();
  const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ }).toUpperCase();
  return `${weekday} · ${md}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  });
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
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        router.push(`/job/${row.job.id}`);
      }}
      className="border border-ink-20 bg-chalk active:opacity-70"
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
          <Text className="text-ink-40 font-mono-bold text-[8px] uppercase mb-0.5" style={{ letterSpacing: 1.5 }}>
            WHEN
          </Text>
          <Text className="text-ink font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 0.5 }}>
            {formatCardDate(row.job.starts_at)}
          </Text>
          <Text className="text-ink-60 font-mono text-[9px] uppercase mt-0.5" style={{ letterSpacing: 0.5 }}>
            {formatTime(row.job.starts_at)}
          </Text>
        </View>
        <View className="flex-1 px-4 py-2.5 border-r border-ink-20">
          <Text className="text-ink-40 font-mono-bold text-[8px] uppercase mb-0.5" style={{ letterSpacing: 1.5 }}>
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
          <Text className="text-ink-40 font-mono-bold text-[8px] uppercase mb-0.5" style={{ letterSpacing: 1.5 }}>
            PAY
          </Text>
          <Text className="text-ink font-display" style={{ fontSize: 18, letterSpacing: -0.5 }}>
            ${pay}
          </Text>
        </View>
      </View>
    </Pressable>
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
  const [earnings, setEarnings] = useState<EarningsSummary>({
    paidThisMonth: 0,
    pendingTotal: 0,
    gamesThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const uid = session.user.id;

      const [profileRes, assignRes, earningsRes] = await Promise.all([
        fetchMyProfile(uid),
        fetchMyAssignments(uid),
        fetchEarningsSummary(uid),
      ]);

      if (cancelled) return;
      setProfile(profileRes.data as ProfileRow | null);
      setTodayGames(assignRes.today);
      setUpcomingGames(assignRes.upcoming);
      setEarnings(earningsRes.summary);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profileVersion]);

  const monthName = new Date().toLocaleDateString("en-US", { month: "long" }).toUpperCase();

  if (loading) {
    return (
      <View className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator color="#1F4FCC" />
      </View>
    );
  }

  const firstName = profile?.first_name.toUpperCase() ?? "REF";

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
              color: profile?.is_available ? "#2E7D32" : "rgba(8,17,28,0.36)",
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

      {/* ── Earnings ─────────────────────────────────────────────── */}
      <SectionHeader>{`EARNINGS · ${monthName}`}</SectionHeader>
      <View className="mx-5 border border-ink-20 bg-chalk">
        <View className="flex-row border-b border-ink-20">
          <View className="flex-1 px-4 py-4 border-r border-ink-20">
            <Text
              className="text-ink-60 font-mono-bold text-[9px] uppercase mb-1"
              style={{ letterSpacing: 1.5 }}
            >
              PAID
            </Text>
            <Text className="text-ink font-display" style={{ fontSize: 28, letterSpacing: -1 }}>
              ${earnings.paidThisMonth.toLocaleString()}
            </Text>
          </View>
          <View className="flex-1 px-4 py-4">
            <Text
              className="text-ink-60 font-mono-bold text-[9px] uppercase mb-1"
              style={{ letterSpacing: 1.5 }}
            >
              PENDING
            </Text>
            <Text className="text-ink font-display" style={{ fontSize: 28, letterSpacing: -1 }}>
              ${earnings.pendingTotal.toLocaleString()}
            </Text>
          </View>
        </View>
        <View className="px-4 py-3">
          <Text
            className="text-ink-40 font-mono text-[9px] uppercase"
            style={{ letterSpacing: 1.5 }}
          >
            {earnings.gamesThisMonth} GAME{earnings.gamesThisMonth !== 1 ? "S" : ""} THIS MONTH
          </Text>
        </View>
      </View>

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
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        router.push(href as any);
      }}
      className="border border-ink-20 bg-chalk px-4 py-3.5 flex-row items-center justify-between active:opacity-70"
    >
      <Text
        className="text-ink font-mono-bold text-[11px] uppercase"
        style={{ letterSpacing: 1.5 }}
      >
        {label}
      </Text>
      <Text className="text-ink-40 font-mono text-[11px]">→</Text>
    </Pressable>
  );
}
