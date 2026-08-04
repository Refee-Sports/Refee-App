import { Text, View } from "react-native";
import { DataCard } from "./DataCard";
import type { JobDetail } from "@/lib/jobs/types";

type Props = {
  job: JobDetail;
};

export function JobDetailSpecs({ job }: Props) {
  const rows: [string, string][] = [
    ["SPORT", job.sportLabel],
    ["LEVEL", job.levelLabel],
    ["RULESET", job.ruleset ?? "—"],
    ["GAME LENGTH", job.gameLength],
    ["UNIFORM", job.uniform ?? "—"],
    ["PARKING", job.parking ?? "—"],
  ];

  return (
    <DataCard tab="SPECS">
      <View className="pt-5 pb-3 px-3.5">
        {rows.map(([label, val]) => (
          <View
            key={label}
            className="flex-row justify-between items-center py-2.5 border-b border-ink/10 last:border-b-0"
          >
            <Text
              className="text-ink-60 font-mono-bold text-[10px] uppercase"
              style={{ letterSpacing: 1.6 }}
            >
              {label}
            </Text>
            <Text
              className="text-ink font-mono-bold text-[11px] uppercase text-right flex-1 pl-4"
              style={{ letterSpacing: 1 }}
            >
              {val}
            </Text>
          </View>
        ))}
      </View>
    </DataCard>
  );
}
