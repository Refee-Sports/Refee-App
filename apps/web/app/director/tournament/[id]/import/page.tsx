"use client";

import { use } from "react";
import { ScheduleImport } from "@/components/schedule/ScheduleImport";

/** Director: import a tournament's games from a photo, PDF or CSV. */
export default function DirectorScheduleImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ScheduleImport tournamentId={id} backHref={`/director/tournament/${id}`} canEditTournament />;
}
