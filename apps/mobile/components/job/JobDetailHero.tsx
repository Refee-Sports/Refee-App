import { Text, View } from "react-native";
import type { JobDetail } from "@/lib/jobs/types";

type Props = {
  job: JobDetail;
};

export function JobDetailHero({ job }: Props) {
  const titleLines = job.title.includes("\n") ? job.title.split("\n") : [job.title];

  return (
    <View className="border-[1.5px] border-ink bg-chalk mb-3 overflow-hidden">
      <View className="flex-row justify-between items-center px-3.5 py-2.5 border-b border-ink bg-ink">
        <Text
          className="text-paper font-mono-bold text-[9px] uppercase flex-1 pr-2"
          style={{ letterSpacing: 1.4 }}
        >
          {job.heroTag}
        </Text>
        <Text
          className="text-paper/60 font-mono text-[9px] uppercase"
          style={{ letterSpacing: 1.2 }}
        >
          {job.jobCode}
        </Text>
      </View>

      <View className="flex-row justify-between items-end px-4 py-4 gap-3">
        <View className="flex-1">
          {titleLines.map((line, i) => (
            <Text
              key={i}
              className="text-ink font-display uppercase"
              style={{ fontSize: 30, lineHeight: 30, letterSpacing: -0.9 }}
            >
              {line}
            </Text>
          ))}
          <Text
            className="text-ink-60 font-mono-bold text-[10px] uppercase mt-2"
            style={{ letterSpacing: 1.4 }}
          >
            {job.org}
            {job.orgVerified ? <Text className="text-court"> ✓</Text> : null}
          </Text>
        </View>
        <View className="items-end">
          <View className="flex-row items-start">
            <Text
              className="text-ink-60 font-display"
              style={{ fontSize: 22, lineHeight: 28, marginTop: 4 }}
            >
              $
            </Text>
            <Text
              className="text-signal font-display"
              style={{ fontSize: 56, lineHeight: 48, letterSpacing: -2.8 }}
            >
              {job.payTotal}
            </Text>
          </View>
          <Text
            className="text-ink-60 font-mono-bold text-[9px] uppercase mt-1"
            style={{ letterSpacing: 1.8 }}
          >
            TOTAL EST.
          </Text>
        </View>
      </View>

      <View className="flex-row border-t border-ink bg-paper">
        {[
          ["PER GAME", `$${job.payPerGame}`, false],
          ["GAMES", String(job.numGames), false],
          ["PAYOUT", `${job.payoutHours}H`, true],
        ].map(([lab, val, court], i) => (
          <View
            key={lab as string}
            className={`flex-1 py-2.5 px-3 border-ink ${i < 2 ? "border-r" : ""}`}
          >
            <Text
              className="text-ink-60 font-mono-bold text-[8px] uppercase mb-0.5"
              style={{ letterSpacing: 1.8 }}
            >
              {lab}
            </Text>
            <Text
              className={`font-display uppercase ${court ? "text-court" : "text-ink"}`}
              style={{ fontSize: 16, letterSpacing: -0.3, fontWeight: "900" }}
            >
              {val}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
