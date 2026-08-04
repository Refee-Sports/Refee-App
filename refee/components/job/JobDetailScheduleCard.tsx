import { Text, View } from "react-native";
import { DataCard } from "./DataCard";
import type { JobDetail } from "@/lib/jobs/types";

type Props = {
  job: JobDetail;
};

export function JobDetailScheduleCard({ job }: Props) {
  return (
    <DataCard tab="SCHEDULE">
      <View className="flex-row pt-5 pb-4 px-3.5">
        <View className="flex-1 pr-3 border-r border-ink/20">
          <Text
            className="text-ink-60 font-mono-bold text-[8px] uppercase mb-1"
            style={{ letterSpacing: 2 }}
          >
            WHEN
          </Text>
          <Text
            className="text-ink font-display uppercase"
            style={{ fontSize: 20, letterSpacing: -0.4, lineHeight: 22 }}
          >
            {job.whenPrimary}
          </Text>
          <Text
            className="text-ink-80 font-mono-bold text-[10px] uppercase mt-1"
            style={{ letterSpacing: 1.2 }}
          >
            {job.whenSecondary}
          </Text>
          <Text
            className="text-ink-60 font-mono text-[9px] uppercase mt-1"
            style={{ letterSpacing: 1.2 }}
          >
            {job.whenTertiary}
          </Text>
        </View>
        <View className="flex-1 pl-3">
          <Text
            className="text-ink-60 font-mono-bold text-[8px] uppercase mb-1"
            style={{ letterSpacing: 2 }}
          >
            WHERE
          </Text>
          <Text
            className="text-ink font-display uppercase"
            style={{ fontSize: 20, letterSpacing: -0.4, lineHeight: 22 }}
          >
            {job.wherePrimary}
          </Text>
          <Text
            className="text-ink-80 font-mono-bold text-[10px] uppercase mt-1"
            style={{ letterSpacing: 1.2 }}
          >
            {job.whereSecondary}
          </Text>
          <Text
            className="text-ink-60 font-mono text-[9px] uppercase mt-1"
            style={{ letterSpacing: 1.2 }}
          >
            {job.whereTertiary}
          </Text>
        </View>
      </View>
    </DataCard>
  );
}
