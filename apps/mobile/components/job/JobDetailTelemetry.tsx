import { Text, View } from "react-native";
import type { JobDetail } from "@/lib/jobs/types";

type Props = {
  job: JobDetail;
};

export function JobDetailTelemetry({ job }: Props) {
  const isLive = job.telemetryRight === "LIVE";

  return (
    <View className="flex-row justify-between items-center px-5 pb-3">
      {isLive ? (
        <View className="flex-row items-center gap-1.5 bg-hi-vis px-1.5 py-1 flex-shrink mr-2">
          <View className="w-1 h-1 rounded-full bg-ink" />
          <Text
            className="text-ink font-mono-bold text-[9px] uppercase flex-shrink"
            style={{ letterSpacing: 1.2 }}
            numberOfLines={2}
          >
            {job.telemetryLeft}
          </Text>
        </View>
      ) : (
        <Text
          className="text-ink-60 font-mono-bold text-[9px] uppercase flex-1 pr-2"
          style={{ letterSpacing: 1.2 }}
          numberOfLines={2}
        >
          {job.telemetryLeft}
        </Text>
      )}
      <Text
        className="text-ink font-mono-bold text-[9px] uppercase"
        style={{ letterSpacing: 1.6 }}
      >
        {job.telemetryRight}
      </Text>
    </View>
  );
}
