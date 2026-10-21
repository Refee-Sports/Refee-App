import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { loadDirectorDashboard, waitingLabel, type DirectorDashboard as Dashboard, type Spend } from "@refee/core/director/dashboard";
import { fetchPendingApprovals, type PendingApproval } from "@/lib/director/queries";
import { formatGameDate, formatGameTimeWithZone } from "@refee/core/time";

/** Crew coverage, applicants waiting on the director, and spend. */
export function DirectorDashboard({ userId }: { userId: string }) {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [spendView, setSpendView] = useState<"month" | "tournaments">("month");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all([loadDirectorDashboard(userId), fetchPendingApprovals(userId)]).then(([d, a]) => {
        if (cancelled) return;
        setData(d);
        setApprovals(a.approvals);
      });
      return () => {
        cancelled = true;
      };
    }, [userId])
  );

  if (!data) return null;
  const { coverage, spend } = data;
  const open = (id: string) => {
    Haptics.selectionAsync();
    router.push(`/(director)/game/${id}` as any);
  };

  return (
    <View className="mb-2">
      {/* ── Coverage ──────────────────────────────────────────────── */}
      <Header>CREW COVERAGE</Header>
      <View className="mx-5 border border-ink bg-chalk">
        <View className="flex-row border-b border-ink-20">
          <Stat label="UPCOMING" value={String(coverage.upcoming)} bordered />
          <Stat label="FULLY STAFFED" value={String(coverage.staffed)} bordered />
          <Stat label="OPEN SPOTS" value={String(coverage.openSlots)} />
        </View>
        {coverage.short.length === 0 ? (
          <Text className="px-4 py-3 font-mono text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 1 }}>
            {coverage.upcoming ? "EVERY UPCOMING GAME HAS ITS FULL CREW" : "NO UPCOMING GAMES"}
          </Text>
        ) : (
          coverage.short.slice(0, 5).map((g) => (
            <Pressable
              key={g.gameId}
              onPress={() => open(g.gameId)}
              className="px-4 py-2.5 border-b border-ink-10 flex-row items-center justify-between active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel={`${g.title}, ${g.confirmed} of ${g.crew} referees${g.urgent ? ", within 7 days" : ""}`}
            >
              <View className="flex-1 pr-2">
                <Text className="font-mono-bold text-[11px] text-ink uppercase" numberOfLines={1} style={{ letterSpacing: 0.5 }}>
                  {g.title}
                </Text>
                <Text className="font-mono text-[9px] text-ink-60 uppercase mt-0.5" style={{ letterSpacing: 1 }}>
                  {formatGameDate(g.startsAt, g.timeZone, { weekday: "short", month: "short", day: "numeric" }).toUpperCase()} ·{" "}
                  {formatGameTimeWithZone(g.startsAt, g.timeZone)}
                </Text>
              </View>
              <Text
                className={`font-mono-bold text-[10px] uppercase ${g.urgent ? "text-foul-ink" : "text-ink"}`}
                style={{ letterSpacing: 1 }}
              >
                {g.urgent ? "! " : ""}
                {g.confirmed}/{g.crew} REFS
              </Text>
            </Pressable>
          ))
        )}
        {coverage.short.length > 5 ? (
          <Text className="px-4 py-2 font-mono text-[8px] text-ink-60 uppercase" style={{ letterSpacing: 1 }}>
            +{coverage.short.length - 5} MORE GAMES NEED REFEREES
          </Text>
        ) : null}
      </View>

      {/* ── Applicants waiting ────────────────────────────────────── */}
      {approvals.length > 0 ? (
        <>
          <Header>{`APPLICANTS WAITING · ${approvals.length}`}</Header>
          <View className="mx-5 border border-ink bg-chalk">
            {approvals.slice(0, 5).map((a) => (
              <Pressable
                key={a.assignmentId}
                onPress={() => open(a.job.id)}
                className="px-4 py-2.5 border-b border-ink-10 flex-row items-center justify-between active:opacity-70"
                accessibilityRole="button"
              >
                <View className="flex-1 pr-2">
                  <Text className="font-mono-bold text-[11px] text-ink uppercase" numberOfLines={1} style={{ letterSpacing: 0.5 }}>
                    {a.profile ? `${a.profile.first_name} ${a.profile.last_initial}.` : "Referee"} · {a.job.title}
                  </Text>
                  <Text className="font-mono text-[9px] text-ink-60 uppercase mt-0.5" style={{ letterSpacing: 1 }}>
                    {waitingLabel(a.appliedAt).toUpperCase()} · {a.job.acceptedCount}/{a.job.crewSize} CONFIRMED
                  </Text>
                </View>
                <Feather name="chevron-right" size={14} color="#08111C" />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {/* ── Spend ─────────────────────────────────────────────────── */}
      <View className="flex-row items-center justify-between px-5 mt-5 mb-2.5">
        <Text className="font-mono-bold text-[10px] text-ink uppercase" style={{ letterSpacing: 2 }}>
          SPEND
        </Text>
        <View className="flex-row border border-ink">
          {(["month", "tournaments"] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => {
                Haptics.selectionAsync();
                setSpendView(v);
              }}
              className={`px-2.5 py-1 ${spendView === v ? "bg-ink" : "bg-chalk"}`}
              accessibilityRole="button"
              accessibilityState={{ selected: spendView === v }}
            >
              <Text className={`font-mono-bold text-[9px] uppercase ${spendView === v ? "text-paper" : "text-ink"}`} style={{ letterSpacing: 1 }}>
                {v === "month" ? "THIS MONTH" : "BY TOURNAMENT"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {spendView === "month" ? (
        <SpendCard spend={spend.month} />
      ) : spend.tournaments.length === 0 ? (
        <Text className="mx-5 font-mono text-[9px] text-ink-60 uppercase" style={{ letterSpacing: 1 }}>
          NO TOURNAMENT GAMES IN THE LAST 4 MONTHS
        </Text>
      ) : (
        <View className="gap-2">
          {spend.tournaments.slice(0, 5).map((t) => (
            <SpendCard key={t.tournamentId} spend={t} title={t.name} />
          ))}
        </View>
      )}
    </View>
  );
}

function SpendCard({ spend, title }: { spend: Spend; title?: string }) {
  return (
    <View className="mx-5 border border-ink-20 bg-chalk">
      {title ? (
        <Text className="px-4 pt-2.5 font-mono-bold text-[10px] text-ink uppercase" numberOfLines={1} style={{ letterSpacing: 1 }}>
          {title}
        </Text>
      ) : null}
      <View className="flex-row">
        <Stat label="CHARGED" value={`$${spend.charged.toLocaleString()}`} bordered />
        <Stat label="STILL TO PAY" value={`$${spend.pending.toLocaleString()}`} bordered />
        <Stat label="REFEE FEE" value={`$${spend.fee.toLocaleString()}`} />
      </View>
      <Text className="px-4 pb-2.5 font-mono text-[8px] text-ink-40 uppercase" style={{ letterSpacing: 1 }}>
        TOTAL ${spend.total.toLocaleString()} · THE FEE IS INCLUDED IN BOTH AMOUNTS
      </Text>
    </View>
  );
}

function Header({ children }: { children: string }) {
  return (
    <Text className="text-ink font-mono-bold text-[10px] uppercase px-5 mt-5 mb-2.5" style={{ letterSpacing: 2 }}>
      {children}
    </Text>
  );
}

function Stat({ label, value, bordered }: { label: string; value: string; bordered?: boolean }) {
  return (
    <View className={`flex-1 px-3 py-3 ${bordered ? "border-r border-ink-20" : ""}`}>
      <Text className="text-ink-60 font-mono-bold text-[8px] uppercase mb-1" style={{ letterSpacing: 1.5 }}>
        {label}
      </Text>
      <Text className="text-ink font-display" style={{ fontSize: 18, letterSpacing: -0.5 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}
