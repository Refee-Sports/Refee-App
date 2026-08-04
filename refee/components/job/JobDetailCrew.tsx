import { Text, View } from "react-native";
import { DataCard } from "./DataCard";
import type { AssignmentStatus, CrewProfile } from "@/lib/jobs/queries";
import type { JobDetail } from "@/lib/jobs/types";

type CrewRowProps = {
  initials: string;
  name: string;
  role: string;
  status: string;
  locked?: boolean;
  open?: boolean;
};

function CrewRow({ initials, name, role, status, locked, open }: CrewRowProps) {
  const isEmpty = initials === "?";
  return (
    <View className="flex-row items-center py-2.5 border-b border-ink/10">
      <View
        className={`w-9 h-9 border border-ink items-center justify-center mr-3 ${
          isEmpty ? "bg-transparent border-dashed border-ink/30" : "bg-ink"
        }`}
      >
        <Text
          className={`font-display uppercase ${
            isEmpty ? "text-ink-40 text-sm" : "text-paper text-sm"
          }`}
          style={{ fontWeight: "900" }}
        >
          {initials}
        </Text>
      </View>
      <View className="flex-1 min-w-0">
        <Text
          className={`text-[13px] uppercase ${
            name.toLowerCase().includes("open") ? "text-ink-40 italic font-medium" : "text-ink font-bold"
          }`}
          style={{ letterSpacing: -0.1 }}
        >
          {name}
        </Text>
        <Text
          className="text-ink-60 font-mono text-[9px] uppercase mt-0.5"
          style={{ letterSpacing: 1.4 }}
        >
          {role}
        </Text>
      </View>
      <Text
        className={`font-mono-bold text-[9px] uppercase ${
          open ? "text-ink bg-hi-vis px-1.5 py-0.5" : locked ? "text-court" : "text-ink-60"
        }`}
        style={{ letterSpacing: 1.4 }}
      >
        {status}
      </Text>
    </View>
  );
}

type Props = {
  job: JobDetail;
  assignmentStatus: AssignmentStatus;
  crewMembers: CrewProfile[];
};

export function JobDetailCrew({ job, assignmentStatus, crewMembers }: Props) {
  const meAccepted = crewMembers.find((m) => m.isMe && assignmentStatus === "accepted");
  const otherAccepted = crewMembers.filter((m) => !m.isMe && m.status.includes("LOCKED"));

  return (
    <DataCard tab={`CREW · ${job.crewSize}-PERSON`}>
      <View className="pt-5 pb-3 px-3.5">
        <CrewRow
          initials="JT"
          name="JEREMY T."
          role="CREW CHIEF · 4.94 ★"
          status="● LOCKED"
          locked
        />
        {meAccepted ? (
          <CrewRow
            initials={meAccepted.initials}
            name={meAccepted.displayName}
            role={`UMPIRE 1 · ${meAccepted.rating.toFixed(2)} ★`}
            status="● LOCKED"
            locked
          />
        ) : (
          <CrewRow
            initials="?"
            name="Open slot"
            role="UMPIRE 1 · APPLY"
            status="YOUR SPOT"
            open
          />
        )}
        {otherAccepted.map((member) => (
          <CrewRow
            key={member.refId}
            initials={member.initials}
            name={member.displayName}
            role={member.role}
            status={member.status}
            locked
          />
        ))}
        {job.crewSize > 2 && !meAccepted && otherAccepted.length === 0 ? (
          <CrewRow initials="?" name="Open slot" role="UMPIRE 2" status="OPEN" />
        ) : null}
        {job.crewSize > 2 && meAccepted && otherAccepted.length === 0 ? (
          <CrewRow initials="?" name="Open slot" role="UMPIRE 2" status="OPEN" />
        ) : null}
      </View>
    </DataCard>
  );
}
