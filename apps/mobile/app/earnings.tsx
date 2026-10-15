import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import {
  earningsCsv,
  earningsCsvFilename,
  earningsYears,
  fetchEarningsLedger,
  ledgerTotals,
  payoutLabel,
  type LedgerRow,
} from "@/lib/referee/queries";
import { shareCsv } from "@/lib/files/share";
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
  const [exportYear, setExportYear] = useState<number | "all">("all");
  const [exporting, setExporting] = useState(false);

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
  const years = earningsYears(rows);

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    const opts = exportYear === "all" ? {} : { year: exportYear };
    try {
      await shareCsv(earningsCsvFilename(opts), earningsCsv(rows, opts), "Save your Refee earnings");
    } catch (e) {
      Alert.alert("Couldn't export", (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

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
              {rows.length > 0 ? (
                <View className="mt-4 flex-row flex-wrap items-center gap-2">
                  {(["all", ...years] as const).map((y) => (
                    <Pressable
                      key={String(y)}
                      onPress={() => setExportYear(y)}
                      className={`border px-2.5 py-1.5 ${exportYear === y ? "border-ink bg-ink" : "border-ink-20 bg-chalk"}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: exportYear === y }}
                    >
                      <Text className={`font-mono-bold text-[9px] uppercase ${exportYear === y ? "text-paper" : "text-ink"}`} style={{ letterSpacing: 1 }}>
                        {y === "all" ? "ALL TIME" : String(y)}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={exportCsv}
                    disabled={exporting}
                    className="ml-auto border border-ink bg-ink px-3 py-1.5 active:opacity-80 disabled:opacity-50"
                    accessibilityRole="button"
                    accessibilityLabel="Export earnings as a CSV file"
                  >
                    <Text className="font-mono-bold text-[9px] uppercase text-paper" style={{ letterSpacing: 1.5 }}>
                      {exporting ? "EXPORTING…" : "EXPORT CSV"}
                    </Text>
                  </Pressable>
                </View>
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
