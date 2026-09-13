import { Text, View } from "react-native";
import { DataCard } from "./DataCard";
import type { JobDetail } from "@/lib/jobs/types";

type Props = {
  job: JobDetail;
};

export function JobDetailGames({ job }: Props) {
  return (
    <DataCard tab={`GAMES · ${job.numGames} SCHEDULED`}>
      <View className="pt-5 pb-3 px-3.5">
        {Array.from({ length: job.numGames }).map((_, i) => (
          <View
            key={i}
            className="flex-row items-center py-2.5 border-b border-ink/10 last:border-b-0 gap-3"
          >
            <Text
              className="text-ink-60 font-mono text-[9px] uppercase w-6"
              style={{ letterSpacing: 1.4 }}
            >
              G{i + 1}
            </Text>
            <View className="flex-1 min-w-0">
              <Text
                className="text-ink font-display uppercase"
                style={{ fontSize: 16, letterSpacing: -0.3, lineHeight: 18 }}
              >
                {i === 0 ? job.whenSecondary.replace(" CT", "") : `GAME ${i + 1}`}
              </Text>
              <Text
                className="text-ink-80 font-mono text-[10px] uppercase mt-0.5"
                style={{ letterSpacing: 1 }}
              >
                {job.levelLabel} · {i === 0 ? "POOL A" : i === 1 ? "POOL B" : i === 2 ? "POOL A" : "BRACKET"}
              </Text>
            </View>
            <Text
              className="text-court font-display uppercase"
              style={{ fontSize: 16, letterSpacing: -0.3, fontWeight: "900" }}
            >
              ${job.payPerGame}
            </Text>
          </View>
        ))}
      </View>
    </DataCard>
  );
}
