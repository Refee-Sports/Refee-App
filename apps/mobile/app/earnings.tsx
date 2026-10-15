import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { fetchEarningsLedger, ledgerTotals, payoutLabel, type LedgerRow } from "@/lib/referee/queries";
import { formatGameDate } from "@refee/core/time";

const PAYOUT_COLOR: Record<LedgerRow["payout"], string> = {
  paid: "text-ink",
  processing: "text-signal",
  pending: "text-ink-60",
  failed: "text-foul",
};

/** Every game a referee worked, what it paid, and where that money is. */
export default function EarningsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const result = await fetchEarningsLedger(session.user.id);
    setRows(result.rows);
    setError(result.error?.message ?? null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const totals = ledgerTotals(rows);

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <View className="px-5 py-3 flex-row items-center justify-between border-b border-ink">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 border border-ink items-center justify-center active:opacity-70"
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={16} color="#08111C" />
        </Pressable>
        <Text className="font-mono-bold text-[9px] text-ink uppercase" style={{ letterSpacing: 1.5 }}>
          EARNINGS STATEMENT
        </Text>
        <View className="w-9" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1F4FCC" />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.assignmentId}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#1F4FCC" />
          }
          ListHeaderComponent={
            <View className="mb-4">
              <View className="border border-ink bg-chalk flex-row">
                <Total label="PAID OUT" value={totals.paid} />
                <View className="w-px bg-ink" />
                <Total label="STILL OWED" value={totals.owed} />
                <View className="w-px bg-ink" />
                <View className="flex-1 px-3 py-3">
                  <Text className="text-ink-60 font-mono-bold text-[8px] uppercase mb-1" style={{ letterSpacing: 2 }}>GAMES</Text>
                  <Text className="text-ink font-display" style={{ fontSize: 18, letterSpacing: -0.5 }}>{totals.games}</Text>
                </View>
              </View>
              <Text className="mt-2 text-ink-60 text-[12px] leading-[18px]">
                Paid means sent to your Stripe account. Stripe moves it to your bank on its own schedule, usually within 2 business days.
              </Text>
              {error ? (
                <Text className="mt-3 border border-foul bg-foul/10 p-3 text-foul text-[13px]">{error}</Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <Text className="text-ink-60 text-[14px] text-center mt-8">
              Games you work show up here once they finish.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/job/${item.jobId}` as any)}
              className="border border-ink bg-chalk px-4 py-3 mb-1.5 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, $${item.amount}, ${payoutLabel(item)}`}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="font-mono-bold text-[11px] text-ink uppercase" numberOfLines={1} style={{ letterSpacing: 0.5 }}>
                    {item.title}
                  </Text>
                  <Text className="font-mono text-[9px] text-ink-60 uppercase mt-0.5" style={{ letterSpacing: 1 }}>
                    {formatGameDate(item.startsAt, item.timeZone, { month: "short", day: "numeric", year: "numeric" })} · {item.orgName}
                    {item.kind === "late_cancel" ? " · LATE-CANCEL FEE" : ""}
                  </Text>
                </View>
                <Text className="font-display text-ink" style={{ fontSize: 16, letterSpacing: -0.5 }}>
                  ${item.amount.toLocaleString()}
                </Text>
              </View>
              <Text className={`font-mono-bold text-[9px] uppercase mt-2 ${PAYOUT_COLOR[item.payout]}`} style={{ letterSpacing: 1 }}>
                {payoutLabel(item)}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 px-3 py-3">
      <Text className="text-ink-60 font-mono-bold text-[8px] uppercase mb-1" style={{ letterSpacing: 2 }}>{label}</Text>
      <Text className="text-ink font-display" style={{ fontSize: 18, letterSpacing: -0.5 }} numberOfLines={1} adjustsFontSizeToFit>
        ${value.toLocaleString()}
      </Text>
    </View>
  );
}
