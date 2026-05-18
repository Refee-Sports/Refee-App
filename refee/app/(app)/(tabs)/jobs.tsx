import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { Badge } from "@/components/ui/Badge";
import { useJobsFeed } from "@/hooks/useJobsFeed";
import {
  activeRadiusMiles,
  applyJobFeedFilters,
  JOB_FEED_FILTERS,
  type JobFeedFilterId,
} from "@/lib/jobs/filters";
import type { FeedTab } from "@/lib/jobs/types";
import { SEED_JOB_IDS } from "@/lib/jobs/mock-data";

function CardTopStripe({ variant }: { variant?: "hot" | "featured" }) {
  if (!variant) return null;
  const stripes = 28;
  return (
    <View className="flex-row overflow-hidden w-full" style={{ height: variant === "hot" ? 4 : 3 }}>
      {Array.from({ length: stripes }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: variant === "hot" ? 4 : 3,
            backgroundColor:
              variant === "hot"
                ? i % 2 === 0
                  ? "#08111C"
                  : "#C9F031"
                : i % 2 === 0
                  ? "#1F4FCC"
                  : "#E5E1D6",
          }}
        />
      ))}
    </View>
  );
}

export default function Jobs() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rowsForTab, counts, loading, error, usedMockForAvailable } = useJobsFeed();
  const [tab, setTab] = useState<FeedTab>("available");
  const [activeFilters, setActiveFilters] = useState<Set<JobFeedFilterId>>(new Set());

  const tabRows = useMemo(() => rowsForTab(tab), [rowsForTab, tab]);
  const visible = useMemo(
    () => applyJobFeedFilters(tabRows, activeFilters),
    [tabRows, activeFilters]
  );
  const filtersActive = activeFilters.size > 0;
  const radiusLabel = activeRadiusMiles(activeFilters);

  const pickTab = (t: FeedTab) => {
    Haptics.selectionAsync();
    setTab(t);
  };

  const toggleFilter = (id: JobFeedFilterId) => {
    Haptics.selectionAsync();
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    Haptics.selectionAsync();
    setActiveFilters(new Set());
  };

  const openJob = (id: string) => {
    Haptics.selectionAsync();
    router.push(`/(app)/job/${id}`);
  };

  const headerDate = useMemo(() => {
    const d = new Date();
    const w = d
      .toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Chicago" })
      .toUpperCase();
    const ymd = d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    return `${w} · ${ymd.replace(/-/g, ".")}`;
  }, []);

  return (
    <View className="flex-1 bg-paper">
      <StatusBar style="dark" />
      <View style={{ height: insets.top }} />

      <View className="flex-row items-end justify-between px-5 pt-3 pb-2">
        <View>
          <Text
            className="text-ink-60 font-mono text-[9px] uppercase mb-1"
            style={{ letterSpacing: 1.8 }}
          >
            {headerDate}
          </Text>
          <Text
            className="text-ink font-display uppercase"
            style={{ fontSize: 26, lineHeight: 26, letterSpacing: -1 }}
          >
            JOBS<Text className="text-signal">/</Text>FEED
          </Text>
        </View>
        <Pressable
          onPress={() => (filtersActive ? clearFilters() : Haptics.selectionAsync())}
          className={`w-9 h-9 border items-center justify-center active:opacity-70 ${
            filtersActive ? "border-signal bg-signal/10" : "border-ink bg-chalk"
          }`}
          accessibilityLabel={filtersActive ? "Clear filters" : "Filters"}
        >
          <Feather name="filter" size={14} color={filtersActive ? "#1F4FCC" : "#08111C"} />
        </Pressable>
      </View>

      <View className="flex-row justify-between px-5 py-2 border-y border-ink">
        <Text
          className="text-ink font-mono-bold text-[9px] uppercase flex-1"
          style={{ letterSpacing: 1.4 }}
        >
          <Text className="text-signal">{counts.available}</Text> NEW ·{" "}
          <Text className="text-signal">{counts.invited}</Text> INVITED
        </Text>
        <Text
          className="text-ink-60 font-mono-bold text-[9px] uppercase"
          style={{ letterSpacing: 1.4 }}
        >
          RADIUS{" "}
          <Text className="text-ink">{radiusLabel != null ? `${radiusLabel} MI` : "ANY"}</Text>
        </Text>
      </View>

      <ZebraRule variant="signal" thin />

      <ScrollView
        className="flex-1 px-5"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View className="items-center py-8 mb-2">
            <ActivityIndicator color="#1F4FCC" />
            <Text
              className="text-ink-60 font-mono-bold text-[10px] uppercase mt-3"
              style={{ letterSpacing: 2 }}
            >
              LOADING JOBS…
            </Text>
          </View>
        ) : null}

        {!loading && error && usedMockForAvailable && tab === "available" ? (
          <Text
            className="text-foul font-mono text-[10px] uppercase px-1 py-2 mb-2"
            style={{ letterSpacing: 1 }}
          >
            {error} — showing offline demo list.
          </Text>
        ) : null}

        <View className="flex-row border border-ink mb-3">
          {(
            [
              ["available", "Available", counts.available],
              ["invited", "Invited", counts.invited],
              ["saved", "Saved", counts.saved],
            ] as const
          ).map(([key, label, count]) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => pickTab(key)}
                className={`flex-1 py-2.5 items-center border-r border-ink last:border-r-0 ${
                  active ? "bg-ink" : "bg-chalk"
                }`}
              >
                <Text
                  className={`font-mono-bold text-[9px] uppercase ${
                    active ? "text-paper" : "text-ink-60"
                  }`}
                  style={{ letterSpacing: 1.2 }}
                >
                  {label}{" "}
                  <Text className={active ? "text-hi-vis" : "text-ink"}>{count}</Text>
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4 -mx-5 px-5"
          contentContainerStyle={{ gap: 8, paddingRight: 20 }}
          nestedScrollEnabled
        >
          {JOB_FEED_FILTERS.map((f) => {
            const on = activeFilters.has(f.id);
            return (
              <Pressable
                key={f.id}
                onPress={() => toggleFilter(f.id)}
                className={`border px-3 py-2 active:opacity-80 ${
                  on ? "bg-signal border-signal" : "border-ink bg-chalk"
                }`}
              >
                <Text
                  className={`font-mono-bold text-[9px] uppercase ${
                    on ? "text-paper" : "text-ink"
                  }`}
                  style={{ letterSpacing: 1.2 }}
                >
                  {f.showPin ? "📍 " : ""}
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {filtersActive && tabRows.length > 0 ? (
          <Text
            className="text-ink-60 font-mono-bold text-[9px] uppercase mb-3 px-0.5"
            style={{ letterSpacing: 1.4 }}
          >
            SHOWING {visible.length} OF {tabRows.length}
          </Text>
        ) : null}

        <View className="gap-2.5">
          {visible.length === 0 ? (
            <Text className="text-ink-60 font-mono text-xs uppercase px-1 py-6">
              {tabRows.length === 0
                ? "No jobs in this tab yet."
                : filtersActive
                  ? "No jobs match your filters. Try clearing one or tap the filter icon."
                  : "No jobs in this tab yet."}
            </Text>
          ) : null}
          {visible.map((job) => (
            <Pressable
              key={job.id}
              onPress={() => openJob(job.id)}
              className="border border-ink bg-chalk overflow-hidden active:opacity-90"
            >
              <CardTopStripe variant={job.variant === "default" ? undefined : job.variant} />

              <View className="flex-row justify-between items-center pt-3 px-3.5">
                {job.variant === "hot" && job.tagLeft ? (
                  <View className="flex-row items-center gap-1 bg-hi-vis px-1.5 py-0.5">
                    <View className="w-1 h-1 bg-ink" />
                    <Text
                      className="text-ink font-mono-bold text-[9px] uppercase"
                      style={{ letterSpacing: 1.2 }}
                    >
                      {job.tagLeft}
                    </Text>
                  </View>
                ) : (
                  <Text
                    className={`font-mono-bold text-[9px] uppercase ${
                      job.variant === "featured" ? "text-signal" : "text-ink-60"
                    }`}
                    style={{ letterSpacing: 1.4 }}
                  >
                    {job.tagLeft}
                  </Text>
                )}
                <Text
                  className="text-ink-40 font-mono text-[9px] uppercase"
                  style={{ letterSpacing: 1.2 }}
                >
                  {job.jobId}
                </Text>
              </View>

              <View className="flex-row justify-between items-end px-3.5 pt-2 pb-3 gap-3">
                <View className="flex-1">
                  <Text
                    className="text-ink font-display uppercase"
                    style={{ fontSize: 18, lineHeight: 20, letterSpacing: -0.5 }}
                  >
                    {job.title}
                  </Text>
                  <Text
                    className={`font-mono-bold text-[9px] uppercase mt-1 ${
                      job.orgVerified ? "text-signal" : "text-ink-60"
                    }`}
                    style={{ letterSpacing: 1.2 }}
                  >
                    {job.org}
                    {job.orgVerified ? " ✓" : ""}
                  </Text>
                </View>
                <View className="items-end">
                  <View className="flex-row items-baseline">
                    <Text className="text-signal font-display text-lg">$</Text>
                    <Text
                      className="text-ink font-display"
                      style={{ fontSize: 28, lineHeight: 28, letterSpacing: -1 }}
                    >
                      {job.pay}
                    </Text>
                  </View>
                  <Text
                    className="text-ink-60 font-mono-bold text-[8px] uppercase mt-0.5"
                    style={{ letterSpacing: 1.5 }}
                  >
                    {job.payUnit}
                  </Text>
                </View>
              </View>

              <View className="flex-row flex-wrap border-t border-ink">
                {[
                  ["DATE", job.date],
                  ["TIME", job.time],
                  ["CREW", job.crew],
                  ["DIST", job.dist],
                ].map(([lab, val], idx) => (
                  <View
                    key={lab}
                    className={`w-1/2 py-2 px-3.5 border-ink ${
                      idx < 2 ? "border-b" : ""
                    } ${idx % 2 === 0 ? "border-r" : ""}`}
                  >
                    <Text
                      className="text-ink-60 font-mono-bold text-[8px] uppercase mb-0.5"
                      style={{ letterSpacing: 1.6 }}
                    >
                      {lab}
                    </Text>
                    <Text
                      className="text-ink font-mono-bold text-[11px] uppercase"
                      style={{ letterSpacing: 0.8 }}
                    >
                      {lab === "TIME" && job.id === SEED_JOB_IDS.hot ? (
                        <>
                          {String(val).split("·")[0]?.trim()} ·{" "}
                          <Text className="text-signal">
                            {String(val).split("·")[1]?.trim() ?? ""}
                          </Text>
                        </>
                      ) : (
                        val
                      )}
                    </Text>
                  </View>
                ))}
              </View>

              <View className="flex-row justify-between items-center px-3.5 py-2.5 border-t border-ink bg-paper">
                <View className="flex-row flex-wrap gap-1.5">
                  {job.tags.map((t) => (
                    <Badge key={t} label={t} variant="neutral" />
                  ))}
                </View>
                <Text
                  className={`font-mono-bold text-[9px] uppercase ${
                    job.footerCtaTone === "signal"
                      ? "text-signal"
                      : job.footerCtaTone === "muted"
                        ? "text-ink-60"
                        : "text-ink"
                  }`}
                  style={{ letterSpacing: 1.4 }}
                >
                  {job.footerCta}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
