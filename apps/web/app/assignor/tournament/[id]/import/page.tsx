"use client";

import { use } from "react";
import { ScheduleImport } from "@/components/schedule/ScheduleImport";

/** Accepted assignor: import the tournament's games from a photo, PDF or CSV. */
export default function AssignorScheduleImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ScheduleImport tournamentId={id} backHref={`/assignor/tournament/${id}`} />;
}
