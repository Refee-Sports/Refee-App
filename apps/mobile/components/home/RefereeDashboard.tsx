import { useCallback, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { countdownLabel, loadRefereeDashboard, type RefereeDashboardData } from "@refee/core/referee/dashboard";
import { showRate } from "@refee/core/referee/reliability";
import { LEVELS } from "@refee/core/basketball/options";
import { formatGameDate, formatGameTimeWithZone } from "@refee/core/time";
import { palette } from "@refee/design";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Choice";

const LEVEL_LABEL = new Map(LEVELS.map((l) => [l.id, l.label]));

/** The referee's home dashboard: next game, open games, money, record and games by level. */
export function RefereeDashboard({ userId }: { userId: string }) {
  const router = useRouter();
  const [data, setData] = useState<RefereeDashboardData | null>(null);
  const [period, setPeriod] = useState<"month" | "year">("month");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadRefereeDashboard(userId).then((d) => {
        if (!cancelled) setData(d);
      });
      return () => {
        cancelled = true;
      };
    }, [userId])
  );

  if (!data) {
    return (
      <View className="py-6 items-center">
        <ActivityIndicator color={palette.signal} />
      </View>
    );
  }

  const next = data.nextGame;
  const rate = showRate(data.reliability);
  const money = data.money[period];
  const levels = data.gamesByLevel[period];
  const trend =
    data.rating && data.rating.previous != null
      ? data.rating.recent > data.rating.previous
        ? "▲"
        : data.rating.recent < data.rating.previous
          ? "▼"
          : "="
      : "";

  return (
    <View>
      {/* ── Next game ─────────────────────────────────────────────── */}
      {next ? (
        <>
          <SectionHeader>{`NEXT GAME · ${countdownLabel(next.startsAt).toUpperCase()}`}</SectionHeader>
          <View className="mx-5">
            <Card onPress={() => router.push(`/job/${next.jobId}` as any)} accessibilityLabel={next.title}>
              <View className="px-4 py-3.5">
                {next.needsReconfirm ? (
                  <Text className="font-mono-bold text-[9px] text-foul-ink uppercase mb-1.5" style={{ letterSpacing: 1.5 }}>
                    ! THE ORGANIZER CHANGED THIS GAME · RE-CONFIRM
                  </Text>
                ) : null}
                <Text className="text-ink font-display" style={{ fontSize: 20, lineHeight: 22, letterSpacing: -0.5 }}>
                  {next.title.toUpperCase()}
                </Text>
                <Text className="font-mono-bold text-[10px] text-ink uppercase mt-1.5" style={{ letterSpacing: 1 }}>
                  {formatGameDate(next.startsAt, next.timeZone, { weekday: "short", month: "short", day: "numeric" }).toUpperCase()} ·{" "}
                  {formatGameTimeWithZone(next.startsAt, next.timeZone)}
                </Text>
                <Text className="text-ink-80 text-[13px] leading-[18px] mt-1">
                  {[next.venueName, next.venueAddress, next.venueCity && `${next.venueCity}, ${next.venueState}`].filter(Boolean).join(" · ")}
                </Text>
                <Text className="text-ink-60 text-[12px] leading-[17px] mt-1.5">
                  {data.crew.length ? `Crew: ${data.crew.join(", ")}` : "No other referees confirmed yet"}
                </Text>
                {next.arrivalNotes ? (
                  <Text className="text-ink-60 text-[12px] leading-[17px] mt-1">Arrival: {next.arrivalNotes}</Text>
                ) : null}
              </View>
            </Card>
          </View>
        </>
      ) : null}

      {/* ── Open games ────────────────────────────────────────────── */}
      <View className="mx-5 mt-4">
        <Card
          onPress={() => router.push("/jobs" as any)}
          variant="hi-vis"
          accessibilityLabel={`${data.openGames} open games match you`}
        >
          <View className="px-4 py-3 flex-row items-center justify-between">
            <View className="flex-1 pr-2">
              <Text className="font-mono-bold text-[11px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>
                {data.openGames} OPEN GAME{data.openGames !== 1 ? "S" : ""} MATCH YOU
              </Text>
              <Text className="font-mono text-[9px] text-ink-80 uppercase mt-0.5" style={{ letterSpacing: 1 }}>
                {data.newOpenGames > 0 ? `${data.newOpenGames} NEW SINCE YESTERDAY` : "YOUR RADIUS, DAYS AND RATE"}
              </Text>
            </View>
            <Text className="text-ink font-mono-bold text-sm">→</Text>
          </View>
        </Card>
      </View>

      {/* ── Money and games ───────────────────────────────────────── */}
      <View className="flex-row items-center justify-between px-5 mt-6 mb-2.5">
        <Text className="text-ink font-mono-bold text-[10px] uppercase" style={{ letterSpacing: 2 }}>
          EARNINGS
        </Text>
        <View className="flex-row gap-1.5">
          {(["month", "year"] as const).map((p) => (
            <Chip
              key={p}
              label={p === "month" ? "This month" : "This year"}
              selected={period === p}
              onPress={() => setPeriod(p)}
            />
          ))}
        </View>
      </View>
      <View className="mx-5">
        <Card
          onPress={() => router.push("/earnings" as any)}
          variant="quiet"
          accessibilityLabel={`Paid $${money.paid}, owed $${money.owed}. Open earnings statement`}
        >
          <View className="flex-row">
            <Stat label="PAID" value={`$${money.paid.toLocaleString()}`} bordered />
            <Stat label="OWED" value={`$${money.owed.toLocaleString()}`} />
          </View>
          <View className="px-4 py-2.5 border-t border-ink-20">
            {levels.length === 0 ? (
              <Text className="text-ink-60 font-mono text-[9px] uppercase" style={{ letterSpacing: 1.5 }}>
                NO GAMES WORKED {period === "month" ? "THIS MONTH" : "THIS YEAR"} YET
              </Text>
            ) : (
              levels.map((l) => (
                <View key={l.level} className="flex-row justify-between py-0.5">
                  <Text className="text-ink-60 font-mono text-[9px] uppercase" style={{ letterSpacing: 1.5 }}>
                    {LEVEL_LABEL.get(l.level) ?? l.level.toUpperCase()}
                  </Text>
                  <Text className="text-ink font-mono-bold text-[9px] uppercase" style={{ letterSpacing: 1.5 }}>
                    {l.games} GAME{l.games !== 1 ? "S" : ""}
                  </Text>
                </View>
              ))
            )}
          </View>
        </Card>
      </View>

      {/* ── Record ────────────────────────────────────────────────── */}
      <SectionHeader>YOUR RECORD</SectionHeader>
      <View className="mx-5 border border-ink-20 bg-chalk flex-row">
        <Stat
          label="RATING"
          value={data.rating ? `★ ${data.rating.recent.toFixed(1)}${trend ? ` ${trend}` : ""}` : "—"}
          note={data.rating ? `LAST ${data.rating.recentCount}` : "NO RATINGS YET"}
          bordered
        />
        <Stat label="SHOW RATE" value={rate.rate != null ? `${rate.rate}%` : "NEW"} note="LAST 12 MONTHS" bordered />
        <Stat
          label="APPROVED"
          value={data.approval.rate != null ? `${data.approval.rate}%` : "—"}
          note={data.approval.rate != null ? `${data.approval.approved} OF ${data.approval.decided}` : "TOO FEW YET"}
        />
      </View>
    </View>
  );
}

function SectionHeader({ children }: { children: string }) {
  return (
    <Text className="text-ink font-mono-bold text-[10px] uppercase px-5 mt-6 mb-2.5" style={{ letterSpacing: 2 }}>
      {children}
    </Text>
  );
}

function Stat({ label, value, note, bordered }: { label: string; value: string; note?: string; bordered?: boolean }) {
  return (
    <View className={`flex-1 px-4 py-3.5 ${bordered ? "border-r border-ink-20" : ""}`}>
      <Text className="text-ink-60 font-mono-bold text-[9px] uppercase mb-1" style={{ letterSpacing: 1.5 }}>
        {label}
      </Text>
      <Text className="text-ink font-display" style={{ fontSize: 22, letterSpacing: -0.5 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {note ? (
        <Text className="text-ink-40 font-mono text-[8px] uppercase mt-0.5" style={{ letterSpacing: 1 }}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}
