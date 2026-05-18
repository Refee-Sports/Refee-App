import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { ZebraRule } from "@/components/ui/ZebraRule";
import { useJobDetail } from "@/hooks/useJobsFeed";

const ACTION_BAR = 88;

export default function JobDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { job, loading, error } = useJobDetail(id);

  const onAccept = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Accept job", "Wire-up: create job_assignments row + notify hirer.");
  };

  const onDecline = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Decline", "Wire-up: update assignment or dismiss invite.");
  };

  if (loading) {
    return (
      <View className="flex-1 bg-paper items-center justify-center">
        <StatusBar style="dark" />
        <ActivityIndicator color="#1F4FCC" size="large" />
        <Text
          className="text-ink-60 font-mono-bold text-[10px] uppercase mt-4"
          style={{ letterSpacing: 2 }}
        >
          LOADING…
        </Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View className="flex-1 bg-paper">
        <StatusBar style="dark" />
        <View style={{ height: insets.top }} />
        <View className="px-5 pt-4">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70 mb-6"
          >
            <Feather name="chevron-left" size={20} color="#08111C" />
          </Pressable>
          <Text className="text-ink font-display uppercase" style={{ fontSize: 22, letterSpacing: -0.5 }}>
            JOB NOT FOUND
          </Text>
          <Text className="text-ink-60 font-mono text-xs uppercase mt-3">
            {error ?? `No job for id ${id ?? "—"}.`}
          </Text>
        </View>
      </View>
    );
  }

  const liveRight = job.telemetryRight === "LIVE";

  return (
    <View className="flex-1 bg-paper">
      <StatusBar style="dark" />
      <View style={{ height: insets.top }} />

      <View className="flex-row items-center justify-between px-4 py-2 border-b border-ink">
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70"
        >
          <Feather name="chevron-left" size={20} color="#08111C" />
        </Pressable>
        <View className="items-center flex-1 px-2">
          <Text
            className="text-ink-60 font-mono-bold text-[8px] uppercase"
            style={{ letterSpacing: 2 }}
          >
            JOB DETAIL
          </Text>
          <Text
            className="text-ink font-mono-bold text-[11px] uppercase mt-0.5"
            style={{ letterSpacing: 1 }}
          >
            JOB{job.jobCode}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => Haptics.selectionAsync()}
            className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70"
          >
            <Feather name="bookmark" size={14} color="#08111C" />
          </Pressable>
          <Pressable
            onPress={() => Haptics.selectionAsync()}
            className="w-9 h-9 border border-ink bg-chalk items-center justify-center active:opacity-70"
          >
            <Feather name="share-2" size={14} color="#08111C" />
          </Pressable>
        </View>
      </View>

      <View className="flex-row justify-between px-4 py-2 border-b border-ink items-center">
        <View className="flex-row items-center gap-2 flex-1 pr-2">
          {liveRight ? <View className="w-1.5 h-1.5 bg-hi-vis" /> : null}
          <Text
            className="text-ink font-mono-bold text-[9px] uppercase flex-shrink"
            style={{ letterSpacing: 1.2 }}
            numberOfLines={2}
          >
            {job.telemetryLeft}
          </Text>
        </View>
        <Text
          className="text-ink font-mono-bold text-[9px] uppercase"
          style={{ letterSpacing: 1.4 }}
        >
          {job.telemetryRight}
        </Text>
      </View>

      <ZebraRule variant="ink" thin />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + ACTION_BAR + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="border border-ink bg-chalk mb-4">
          <View className="flex-row justify-between px-3 pt-3 pb-2 border-b border-ink">
            <Text
              className="text-signal font-mono-bold text-[9px] uppercase flex-1 pr-2"
              style={{ letterSpacing: 1.2 }}
            >
              {job.heroTag}
            </Text>
            <Text
              className="text-ink-40 font-mono text-[9px] uppercase"
              style={{ letterSpacing: 1.2 }}
            >
              {job.jobCode}
            </Text>
          </View>
          <View className="flex-row justify-between items-end px-3 py-3 gap-3">
            <View className="flex-1">
              <Text
                className="text-ink font-display uppercase"
                style={{ fontSize: 22, lineHeight: 24, letterSpacing: -0.5 }}
              >
                {job.title}
              </Text>
              <Text
                className="text-signal font-mono-bold text-[9px] uppercase mt-2"
                style={{ letterSpacing: 1.2 }}
              >
                {job.org}
              </Text>
            </View>
            <View className="items-end">
              <View className="flex-row items-baseline">
                <Text className="text-signal font-display text-lg">$</Text>
                <Text
                  className="text-ink font-display"
                  style={{ fontSize: 32, lineHeight: 32, letterSpacing: -1 }}
                >
                  {job.payTotal}
                </Text>
              </View>
              <Text
                className="text-ink-60 font-mono-bold text-[8px] uppercase mt-0.5"
                style={{ letterSpacing: 1.5 }}
              >
                TOTAL EST.
              </Text>
            </View>
          </View>
          <View className="flex-row border-t border-ink">
            {[
              ["PER GAME", `$${job.payPerGame}`],
              ["GAMES", String(job.numGames)],
              ["PAYOUT", `${job.payoutHours}H`],
            ].map(([lab, val], i) => (
              <View
                key={lab}
                className={`flex-1 py-2.5 px-2 items-center border-ink ${i < 2 ? "border-r" : ""}`}
              >
                <Text
                  className="text-ink-60 font-mono-bold text-[8px] uppercase mb-1"
                  style={{ letterSpacing: 1.6 }}
                >
                  {lab}
                </Text>
                <Text
                  className={`font-mono-bold text-sm uppercase ${
                    lab === "PAYOUT" ? "text-court" : "text-ink"
                  }`}
                  style={{ letterSpacing: 0.5 }}
                >
                  {val}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View className="border border-ink bg-chalk mb-4">
          <Text
            className="text-ink font-mono-bold text-[9px] uppercase px-3 pt-3 pb-2 border-b border-ink"
            style={{ letterSpacing: 1.4 }}
          >
            SCHEDULE
          </Text>
          <View className="flex-row">
            <View className="flex-1 p-3 border-r border-ink">
              <Text
                className="text-ink-60 font-mono-bold text-[8px] uppercase mb-2"
                style={{ letterSpacing: 1.6 }}
              >
                WHEN
              </Text>
              <Text className="text-ink font-mono-bold text-sm uppercase">{job.whenPrimary}</Text>
              <Text className="text-ink-80 font-mono text-[11px] uppercase mt-1">{job.whenSecondary}</Text>
              <Text className="text-ink-60 font-mono text-[10px] uppercase mt-1">{job.whenTertiary}</Text>
            </View>
            <View className="flex-1 p-3">
              <Text
                className="text-ink-60 font-mono-bold text-[8px] uppercase mb-2"
                style={{ letterSpacing: 1.6 }}
              >
                WHERE
              </Text>
              <Text className="text-ink font-mono-bold text-sm uppercase">{job.wherePrimary}</Text>
              <Text className="text-ink-80 font-mono text-[11px] uppercase mt-1">{job.whereSecondary}</Text>
              <Text className="text-ink-60 font-mono text-[10px] uppercase mt-1">{job.whereTertiary}</Text>
            </View>
          </View>
        </View>

        <View className="border border-ink bg-chalk mb-4 overflow-hidden">
          <View className="h-[120px] bg-paper-2 border-b border-ink items-center justify-center">
            <Feather name="map" size={28} color="rgba(8,17,28,0.25)" />
            <Text
              className="text-ink-40 font-mono-bold text-[9px] uppercase mt-2"
              style={{ letterSpacing: 1.4 }}
            >
              MAP PREVIEW
            </Text>
          </View>
          <View className="flex-row justify-between items-center p-3">
            <View className="flex-1 pr-2">
              <Text
                className="text-ink font-mono-bold text-[10px] uppercase"
                style={{ letterSpacing: 1.2 }}
              >
                {job.venueName}
              </Text>
              {job.venueAddress ? (
                <Text
                  className="text-ink-60 font-mono text-[9px] uppercase mt-1"
                  style={{ letterSpacing: 1 }}
                >
                  {job.venueAddress}
                </Text>
              ) : null}
            </View>
            <Text
              className="text-signal font-mono-bold text-[9px] uppercase"
              style={{ letterSpacing: 1.4 }}
            >
              DIRECTIONS →
            </Text>
          </View>
        </View>

        <View className="border border-ink bg-chalk mb-4">
          <Text
            className="text-ink font-mono-bold text-[9px] uppercase px-3 pt-3 pb-2 border-b border-ink"
            style={{ letterSpacing: 1.4 }}
          >
            CREW · {job.crewSize}-PERSON
          </Text>
          <View className="px-0 py-1">
            <CrewRow initials="JT" name="JEREMY T." role="CREW CHIEF · 4.94 ★" status="● LOCKED" locked />
            <CrewRow initials="?" name="OPEN SLOT" role="UMPIRE 1 · APPLY" status="YOUR SPOT" open />
            {job.crewSize > 2 ? (
              <CrewRow initials="?" name="OPEN SLOT" role="UMPIRE 2" status="OPEN" />
            ) : null}
          </View>
        </View>

        <View className="border border-ink bg-chalk mb-4">
          <Text
            className="text-ink font-mono-bold text-[9px] uppercase px-3 pt-3 pb-2 border-b border-ink"
            style={{ letterSpacing: 1.4 }}
          >
            GAMES · {job.numGames} SCHEDULED
          </Text>
          {Array.from({ length: job.numGames }).map((_, i) => (
            <View
              key={i}
              className="flex-row items-center justify-between px-3 py-2.5 border-b border-ink last:border-b-0"
            >
              <Text className="text-signal font-mono-bold text-xs w-8">G{i + 1}</Text>
              <View className="flex-1 px-2">
                <Text className="text-ink font-mono-bold text-[11px] uppercase">
                  {i === 0 ? job.whenSecondary : `GAME ${i + 1}`}
                </Text>
                <Text className="text-ink-60 font-mono text-[9px] uppercase mt-0.5">
                  {job.levelLabel} · BLOCK {i + 1}
                </Text>
              </View>
              <Text className="text-ink font-mono-bold text-xs">${job.payPerGame}</Text>
            </View>
          ))}
        </View>

        <View className="border border-ink bg-chalk mb-4">
          <Text
            className="text-ink font-mono-bold text-[9px] uppercase px-3 pt-3 pb-2 border-b border-ink"
            style={{ letterSpacing: 1.4 }}
          >
            SPECS
          </Text>
          {[
            ["SPORT", job.sportLabel],
            ["LEVEL", job.levelLabel],
            ["RULESET", job.ruleset ?? "—"],
            ["GAME LENGTH", job.gameLength],
            ["UNIFORM", job.uniform ?? "—"],
            ["PARKING", job.parking ?? "—"],
          ].map(([k, v]) => (
            <View
              key={k}
              className="flex-row justify-between px-3 py-2 border-b border-ink last:border-b-0"
            >
              <Text
                className="text-ink-60 font-mono-bold text-[8px] uppercase"
                style={{ letterSpacing: 1.4 }}
              >
                {k}
              </Text>
              <Text
                className="text-ink font-mono-bold text-[9px] uppercase text-right flex-1 pl-4"
                style={{ letterSpacing: 0.8 }}
              >
                {v}
              </Text>
            </View>
          ))}
        </View>

        {job.hirerNote ? (
          <View className="border border-dashed border-ink-40 p-3 mb-6">
            <Text
              className="text-ink font-mono-bold text-[9px] uppercase mb-2"
              style={{ letterSpacing: 2 }}
            >
              ▸ NOTE FROM ORGANIZER
            </Text>
            <Text className="text-ink-80 text-[12px]" style={{ lineHeight: 18 }}>
              {job.hirerNote}
            </Text>
          </View>
        ) : (
          <View className="h-4" />
        )}
      </ScrollView>

      <View
        className="absolute left-0 right-0 border-t-[1.5px] border-ink bg-paper px-4 pt-3 flex-row gap-3"
        style={{ bottom: 0, paddingBottom: insets.bottom + 12 }}
      >
        <Pressable
          onPress={onDecline}
          className="flex-1 border-[1.5px] border-ink py-4 items-center justify-center active:opacity-80 bg-transparent"
        >
          <Text className="text-ink font-mono-bold text-xs uppercase" style={{ letterSpacing: 2 }}>
            DECLINE
          </Text>
        </Pressable>
        <Pressable
          onPress={onAccept}
          className="flex-[1.4] bg-ink py-4 items-center justify-center active:opacity-90 flex-row gap-2"
        >
          <Text className="text-paper font-mono-bold text-xs uppercase" style={{ letterSpacing: 2 }}>
            ACCEPT JOB
          </Text>
          <Text className="text-paper font-mono-bold text-base">→</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CrewRow({
  initials,
  name,
  role,
  status,
  locked,
  open,
}: {
  initials: string;
  name: string;
  role: string;
  status: string;
  locked?: boolean;
  open?: boolean;
}) {
  return (
    <View className="flex-row items-center px-3 py-2.5 border-b border-ink">
      <View
        className={`w-10 h-10 border border-ink items-center justify-center mr-3 ${
          initials === "?" ? "bg-paper-2" : "bg-ink"
        }`}
      >
        <Text
          className={`font-mono-bold text-[10px] uppercase ${initials === "?" ? "text-ink-40" : "text-paper"}`}
        >
          {initials}
        </Text>
      </View>
      <View className="flex-1">
        <Text
          className={`font-mono-bold text-[10px] uppercase ${name.includes("OPEN") ? "text-ink-40" : "text-ink"}`}
          style={{ letterSpacing: 1 }}
        >
          {name}
        </Text>
        <Text className="text-ink-60 font-mono text-[9px] uppercase mt-0.5" style={{ letterSpacing: 0.8 }}>
          {role}
        </Text>
      </View>
      <Text
        className={`font-mono-bold text-[8px] uppercase ${
          open ? "text-hi-vis" : locked ? "text-ink-60" : "text-ink-40"
        }`}
        style={{ letterSpacing: 1.2 }}
      >
        {status}
      </Text>
    </View>
  );
}
