import { useLocalSearchParams } from "expo-router";
import { ScheduleImporter } from "@/components/schedule/ScheduleImporter";

export default function AssignorScheduleImport() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  return <ScheduleImporter tournamentId={tournamentId} />;
}
