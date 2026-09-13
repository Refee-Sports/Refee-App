import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { DataCard } from "./DataCard";
import { openVenueDirections } from "@/lib/jobs/open-directions";
import type { JobDetail } from "@/lib/jobs/types";

type Props = {
  job: JobDetail;
};

function MapGrid() {
  const lines = 8;
  return (
    <View className="absolute inset-0 overflow-hidden">
      {Array.from({ length: lines }).map((_, i) => (
        <View
          key={`h-${i}`}
          className="absolute left-0 right-0 border-t border-ink/10"
          style={{ top: `${(i / lines) * 100}%` }}
        />
      ))}
      {Array.from({ length: lines }).map((_, i) => (
        <View
          key={`v-${i}`}
          className="absolute top-0 bottom-0 border-l border-ink/10"
          style={{ left: `${(i / lines) * 100}%` }}
        />
      ))}
      <View
        className="absolute border border-signal/30 rounded-full"
        style={{
          width: 80,
          height: 80,
          top: "50%",
          left: "50%",
          marginLeft: -40,
          marginTop: -40,
        }}
      />
      <View
        className="absolute w-6 h-6 rounded-full bg-signal border-2 border-ink items-center justify-center"
        style={{
          top: "50%",
          left: "50%",
          marginLeft: -12,
          marginTop: -12,
        }}
      >
        <View className="w-2 h-2 rounded-full bg-ink" />
      </View>
    </View>
  );
}

export function JobDetailMapCard({ job }: Props) {
  return (
    <DataCard tab="LOCATION" className="overflow-hidden p-0">
      <View className="h-[140px] bg-paper-2 border-b border-ink relative mt-2">
        <MapGrid />
      </View>
      <View className="flex-row justify-between items-center px-3.5 py-3">
        <View className="flex-1 pr-2">
          <Text
            className="text-ink font-mono-bold text-[10px] uppercase"
            style={{ letterSpacing: 1.2 }}
          >
            {job.venueName}
          </Text>
          {job.venueAddress ? (
            <Text
              className="text-ink-60 font-mono text-[9px] uppercase mt-0.5"
              style={{ letterSpacing: 1 }}
            >
              {job.venueAddress}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            openVenueDirections(job.venueName, job.venueAddress);
          }}
          className="active:opacity-70"
        >
          <Text
            className="text-signal font-mono-bold text-[9px] uppercase"
            style={{ letterSpacing: 1.6 }}
          >
            DIRECTIONS →
          </Text>
        </Pressable>
      </View>
    </DataCard>
  );
}
