import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobDetail, JobListRow } from "./types";
import { mapDbJobToDetail, mapDbJobToListRow, type JobDbRow } from "./map-db-job";

export async function fetchOpenJobs(
  supabase: SupabaseClient
): Promise<{ jobs: JobListRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*, hirers(org_name, is_verified)")
    .in("status", ["open", "partially_filled"])
    .order("starts_at", { ascending: true });

  if (error) {
    return { jobs: [], error: new Error(error.message) };
  }
  const rows = (data ?? []) as JobDbRow[];
  return {
    jobs: rows.map(mapDbJobToListRow),
    error: null,
  };
}

export async function fetchJobById(
  supabase: SupabaseClient,
  id: string
): Promise<{ job: JobDetail | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*, hirers(org_name, is_verified)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { job: null, error: new Error(error.message) };
  }
  if (!data) {
    return { job: null, error: null };
  }
  return { job: mapDbJobToDetail(data as JobDbRow), error: null };
}
